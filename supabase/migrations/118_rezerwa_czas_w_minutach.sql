-- 118: Czas na decyzję z rezerwy w minutach, nie w godzinach.
--
-- PO CO: `reserve_claim_hours` (migracja `058`) był SMALLINT liczonym w PEŁNYCH
-- godzinach, `CHECK BETWEEN 1 AND 72` — najkrótszy możliwy czas to godzina.
-- Zgłoszone wprost: wybór jest „mocno ograniczony", potrzeba więcej wartości
-- w przedziale 30 minut – 3 godziny (typowy czas reakcji na telefon), a nie
-- tylko pełne godziny w górę. Godzina jako jednostka fizycznie nie mieści
-- „30 minut" — stąd zmiana jednostki, nie tylko dołożenie opcji do listy.
--
-- PRZENUMEROWANIE: kolumna zmienia NAZWĘ i JEDNOSTKĘ w jednej migracji,
-- zamiast dokładać drugą kolumnę obok — dwie kolumny o tym samym znaczeniu
-- (`reserve_claim_hours` i `reserve_claim_minutes`) to gwarantowany rozjazd,
-- który ktoś prędzej czy później przeczyta z niewłaściwej. Istniejące wartości
-- (pełne godziny) mnożymy razy 60 — zero zmiany faktycznego czasu dla już
-- ustawionych meczów.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ — i to nie jest higiena na zapas. Pierwsza wersja
-- tej migracji zaczynała się gołym `ALTER TABLE … RENAME COLUMN`, więc
-- każde kolejne uruchomienie wywracało się na pierwszej linijce i NIE dochodziło
-- do reszty. Kosztowało to prawdziwą bazę w stanie połowicznym: ktoś puszcza
-- seed, dostaje „column reserve_claim_minutes does not exist", puszcza z ręki
-- SAMĄ zmianę nazwy żeby się odblokować — i zostaje z kolumną o nowej nazwie,
-- ale ze STARYM ograniczeniem `CHECK 1..72`, starą wartością domyślną `3`
-- i wartościami nadal w godzinach. Następny błąd brzmi już
-- „violates check constraint events_reserve_claim_hours_check".
--
-- Stąd każdy krok niżej jest warunkowy, a całość rozpoznaje trzy stany:
-- przed migracją, po połowicznej migracji i po pełnej.
DO $mig118$
DECLARE
  -- Stan sprzed migracji: kolumna nazywa się jeszcze po staremu.
  stara_kolumna boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'reserve_claim_hours');
  -- Ograniczenie z `058` PRZEŻYWA zmianę nazwy kolumny — Postgres zmienia
  -- nazwę kolumny, nie nazwę ograniczenia. Dlatego jego obecność jest
  -- jedynym pewnym znakiem, że w kolumnie siedzą jeszcze GODZINY: dopóki
  -- `CHECK 1..72` wisi na tabeli, nic większego niż 72 nie miało prawa wejść.
  stary_check boolean := EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.events'::regclass
       AND conname = 'events_reserve_claim_hours_check');
  przeliczone integer := 0;
BEGIN
  IF stara_kolumna THEN
    ALTER TABLE events RENAME COLUMN reserve_claim_hours TO reserve_claim_minutes;
  END IF;

  -- Stare ograniczenie musi zniknąć PRZED przeliczeniem: 3 godziny to 180
  -- minut, a 180 nie mieści się w `1..72`.
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reserve_claim_hours_check;

  -- Mnożenie razy 60 wykonuje się DOKŁADNIE RAZ — drugie zamieniłoby trzy
  -- godziny w sto osiemdziesiąt.
  IF stara_kolumna OR stary_check THEN
    UPDATE events SET reserve_claim_minutes = reserve_claim_minutes * 60;
    GET DIAGNOSTICS przeliczone = ROW_COUNT;
  END IF;

  RAISE NOTICE 'Migracja 118: przeliczono % wierszy z godzin na minuty.', przeliczone;
END
$mig118$;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reserve_claim_minutes_check;
ALTER TABLE events ADD CONSTRAINT events_reserve_claim_minutes_check
  CHECK (reserve_claim_minutes BETWEEN 15 AND 4320);  -- 15 min .. 72 h (górna granica bez zmian)
ALTER TABLE events ALTER COLUMN reserve_claim_minutes SET DEFAULT 180;  -- było DEFAULT 3 (godziny)

COMMENT ON COLUMN events.reserve_claim_minutes IS
  'Ile minut ma rezerwowy na przyjęcie zwolnionego miejsca, zanim przejdzie do kolejnej osoby (sync_reserve_claim). Do migracji 118 kolumna nazywała się reserve_claim_hours i liczyła pełne godziny — istniejące wartości przemnożone razy 60 przy przenumerowaniu.';

-- ---------------------------------------------------------------------------
-- sync_reserve_claim: ciało skopiowane z migracji `110` (ostatnia definicja) —
-- zmienione WYŁĄCZNIE odczyt kolumny (`v_hours`→`v_minutes`), budowa interwału
-- (`' hours'`→`' minutes'`) i tekst powiadomienia (dostaje czytelny format,
-- nie gołą liczbę minut przy krótkich oknach — „Masz 30 min." zamiast
-- mylącego „Masz 0 godz.").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_czas text;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_minutes, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_minutes, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_minutes IS NULL OR v_started THEN RETURN; END IF;

  v_czas := CASE
    WHEN v_minutes < 60 THEN v_minutes || ' min.'
    WHEN v_minutes % 60 = 0 THEN (v_minutes / 60) || ' godz.'
    ELSE (v_minutes / 60) || ' godz. ' || (v_minutes % 60) || ' min.'
  END;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_minutes || ' minutes')::interval <= now();

  -- Zawodnicy z pola
  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_czas || ' na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Bramkarze — osobna kolejka. Pytanie zadajemy PONOWNIE, bo powyższa oferta
  -- mogła właśnie zająć ostatnie miejsce ze wspólnej puli (tryb `077`).
  IF v_gk_enabled AND NOT czy_na_rezerwe(p_event_id, true) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_czas || ' na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
