-- 110: `zapisano_at` — moment, od którego liczy się miejsce w kolejce rezerwowej.
--
-- PO CO. `event_participants.created_at` pełnił dotąd dwie role naraz: znacznik
-- „kiedy powstał wiersz" (do etykiety pod nazwiskiem) i klucz sortowania kolejki
-- rezerwowej (`sync_reserve_claim`, migracja `078`, `ORDER BY created_at`).
--
-- „Obserwuję" nie jest osobną tabelą — to ten sam wiersz w `event_participants`
-- z `rsvp = 'maybe'` (migracja `049`). Kliknięcie „Obserwuj" tworzy wiersz od
-- razu. Późniejsze „Dołącz" nie tworzy nowego wiersza (drugi INSERT tego
-- samego użytkownika na ten sam mecz rzuciłby „Jesteś już zapisany") — tylko
-- aktualizuje `rsvp` z 'maybe' na 'yes' (`confirmFromMaybe`). `created_at`
-- zostaje z chwili kliknięcia „Obserwuj", która mogła paść wiele godzin
-- wcześniej.
--
-- Skutek zgłoszony wprost: gracz zaczął obserwować wczoraj o 00:06, dołączył
-- dziś o 6:35 — a lista uczestników pokazywała „wczoraj 00:06". Gorsze niż
-- sama etykieta: w kolejce rezerwowej taka osoba stała PRZED wszystkimi, którzy
-- zapisali się w międzyczasie, i to ona dostawałaby każde zwolnione miejsce.
--
-- ROZWIĄZANIE. Osobna kolumna o jednej, jasnej roli: moment, od którego liczy
-- się miejsce w kolejce. Nie nadpisujemy `created_at` — ono nadal ma znaczyć
-- „kiedy powstał wiersz" (i to jest właściwa informacja dla „obserwuję od").
-- Trigger ustawia `zapisano_at = now()` WYŁĄCZNIE przy przejściu 'maybe' → 'yes'
-- — zegar serwera, nie telefonu, żeby spieszący się zegar klienta nie dawał
-- przewagi w kolejce.
--
-- Backfill: `zapisano_at = created_at` dla istniejących wierszy. Dla kogoś, kto
-- już dziś ma zafałszowany znacznik (obserwował, potem dołączył), backfill
-- NIE odtwarza prawdziwego momentu potwierdzenia — nigdzie nie był zapisany.
-- Kolejka tych osób zostaje z dotychczasową, niesprawiedliwą datą; naprawia się
-- to wyłącznie dla zapisów od tej migracji w przód.

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS zapisano_at TIMESTAMPTZ;
UPDATE event_participants SET zapisano_at = created_at WHERE zapisano_at IS NULL;
ALTER TABLE event_participants ALTER COLUMN zapisano_at SET DEFAULT now();
ALTER TABLE event_participants ALTER COLUMN zapisano_at SET NOT NULL;

COMMENT ON COLUMN event_participants.zapisano_at IS
  'Moment, od którego liczy się miejsce w kolejce rezerwowej. Przy zwykłym '
  'dołączeniu równy created_at; dla kogoś, kto najpierw obserwował (rsvp maybe) '
  'i potem dołączył, to moment potwierdzenia, nie moment kliknięcia "Obserwuj". '
  'Ustawiany przez trg_moment_zapisu, nigdy z przeglądarki.';

CREATE INDEX IF NOT EXISTS idx_event_participants_kolejka
  ON event_participants (event_id, zapisano_at);

CREATE OR REPLACE FUNCTION ustaw_moment_zapisu()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Obserwujący ma wiersz od chwili kliknięcia "Obserwuj". Prawdziwy zapis to
  -- dopiero przejście na 'yes' — i to on ma ustawiać kolejkę.
  IF OLD.rsvp = 'maybe' AND NEW.rsvp = 'yes' THEN
    NEW.zapisano_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moment_zapisu ON event_participants;
CREATE TRIGGER trg_moment_zapisu
  BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION ustaw_moment_zapisu();

-- ---------------------------------------------------------------------------
-- sync_reserve_claim: kolejka zwolnionych miejsc sortuje się teraz po
-- zapisano_at, nie po created_at. Ciało skopiowane z migracji `078`
-- (ten sam wzorzec, którym `078` zastąpiło `075`/`077`) — zmienione są
-- WYŁĄCZNIE dwie linie ORDER BY, jedna dla kolejki pola, jedna dla bramkarzy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_hours, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_hours, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_hours IS NULL OR v_started THEN RETURN; END IF;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

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
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
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
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;
