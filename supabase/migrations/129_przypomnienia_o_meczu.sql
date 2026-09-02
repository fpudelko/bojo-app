-- 129: Przypomnienia — pierwsze powiadomienia w Bojo oparte o CZAS, nie o klik.
--
-- PO CO. Do tej migracji w całym Bojo nie było ANI JEDNEGO powiadomienia,
-- które powstaje samo. Wszystkie (`025`, `062`, `065`, `067`, `070`, `072`,
-- `076`, `079`, `113`, `114`, `116`) są reakcją na czyjeś kliknięcie; jedyny
-- `cron.schedule` w repo dotyczy serii (`073`), a te są za wyłączoną flagą.
-- W praktyce znaczyło to:
--
--   • nikt nie dostaje „jutro grasz o 20:00",
--   • organizator nie dostaje „jutro mecz, brakuje 2 osób" — czyli traci
--     ostatni moment, w którym da się jeszcze kogoś dociągnąć,
--   • po meczu nic nie prosi o wynik ani o rozliczenie. Dane produkcyjne
--     z audytu (2026-08-13): 122 rozegrane mecze, 6 zapisanych wyników,
--     45 nierozliczonych płatnych meczów. Bojo umie jedno i drugie — tylko
--     nic o to nie prosiło we właściwej chwili.
--
-- Przypominanie to jest ta czynność, którą organizator wykonuje co tydzień
-- RĘCZNIE na WhatsAppie („przypominam, jutro gramy", „panowie, BLIK").
-- Dopóki Bojo tego nie robi, grupa na WhatsAppie zostaje — a razem z nią cała
-- reszta rozmowy o meczu.
--
-- CZEGO TU NIE MA, BO JUŻ JEST. To nie jest nowy system powiadomień, tylko
-- nowy POWÓD wstawienia wiersza do `notifications`:
--   • push jedzie za darmo — wyzwalacz `trg_wyslij_push` (`102`) łapie każdy
--     INSERT do tej tabeli,
--   • wyłączenie działa za darmo — `109` filtruje po TYPIE, a lista trzyma
--     wyłączone, nie włączone (nowy typ jest domyślnie włączony),
--   • dzwonek i trasy w aplikacji obsługują nieznane typy przez `event_id`.
--
-- IDEMPOTENTNA. `NOT EXISTS` na (użytkownik, mecz, typ) sprawia, że drugie
-- uruchomienie tego samego dnia nie wyśle niczego drugi raz. To nie jest
-- higiena na zapas: zadanie cron potrafi wystartować dwa razy przy restarcie
-- bazy, a duplikat powiadomienia o meczu czyta się jak zmiana w meczu.
--
-- STREFA CZASOWA. Wszystkie daty liczone `AT TIME ZONE 'Europe/Warsaw'`,
-- wzorem `073`. Baza stoi na UTC (sprawdzone na produkcji: `SHOW timezone`
-- zwraca `UTC`), więc gołe `current_date` po 22:00 czasu polskiego wskazuje
-- jeszcze dzień poprzedni — a przy zadaniu, które ma trafić w „jutro",
-- pomyłka o dzień znaczy „przypomnienie o niewłaściwym meczu".

-- ---------------------------------------------------------------------------
-- 1. Funkcja
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_przypomnienia()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dzis  date := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_ile   integer := 0;
  v_teraz integer;
BEGIN
  -- =========================================================================
  -- A. JUTRO GRASZ — do wszystkich, którzy mają miejsce w składzie
  -- =========================================================================
  -- Rezerwowi i oczekujący na akceptację celowo POZA: „jutro grasz" jest dla
  -- nich nieprawdą, a przypomnienie o meczu, w którym się nie gra, to hałas.
  -- Obserwujący (`rsvp = 'maybe'`) odpadają tą samą regułą.
  --
  -- Organizator dostaje TĘ SAMĄ jedną wiadomość, tylko z dopiskiem o brakach —
  -- osobny wiersz dla niego znaczyłby dwa powiadomienia o tym samym meczu dla
  -- kogoś, kto w nim gra.
  WITH sklad AS (
    SELECT e.id AS event_id,
           e.organizer_id,
           coalesce(e.title, e.sport)                                     AS tytul,
           to_char(e.event_time, 'HH24:MI')                               AS godzina,
           coalesce(e.field_name, e.custom_location_name, 'boisko')       AS miejsce,
           e.max_players,
           count(*) FILTER (
             WHERE p.pending_approval IS NOT TRUE
               AND p.rsvp <> 'maybe'
               AND p.is_reserve IS NOT TRUE)                              AS w_skladzie
      FROM events e
      JOIN event_participants p ON p.event_id = e.id
     WHERE e.event_date = v_dzis + 1
       AND e.status = 'active'
     GROUP BY e.id
  )
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT p.user_id,
         'przypomnienie_o_meczu',
         s.tytul,
         -- Organizatorowi dokładamy to, co jest dla niego decyzją: ilu ludzi
         -- brakuje. Reszcie sama informacja — „brakuje 2" nie jest ich sprawą
         -- i zamieniłoby przypomnienie w prośbę o pomoc wysłaną do wszystkich.
         CASE
           WHEN p.user_id = s.organizer_id AND s.w_skladzie < s.max_players
             THEN 'Jutro ' || s.godzina || ' · ' || s.miejsce
                  || ' · brakuje ' || (s.max_players - s.w_skladzie)
                  || ' (' || s.w_skladzie || '/' || s.max_players || ')'
           ELSE 'Jutro ' || s.godzina || ' · ' || s.miejsce
         END,
         s.event_id
    FROM sklad s
    JOIN event_participants p ON p.event_id = s.event_id
   WHERE p.user_id IS NOT NULL
     AND p.pending_approval IS NOT TRUE
     AND p.rsvp <> 'maybe'
     AND p.is_reserve IS NOT TRUE
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = p.user_id
              AND n.event_id = s.event_id
              AND n.type = 'przypomnienie_o_meczu');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  -- =========================================================================
  -- B. ORGANIZATOR, KTÓRY JUTRO GRA, ALE NIE MA SIEBIE W SKŁADZIE
  -- =========================================================================
  -- Organizator nie musi grać w meczu, który organizuje — i wtedy wypada
  -- z zapytania wyżej, mimo że to on odpowiada za skład i za wynajem. Dla
  -- niego „jutro" jest informacją co najmniej tak samo ważną.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'przypomnienie_o_meczu',
         coalesce(e.title, e.sport),
         'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
           || coalesce(e.field_name, e.custom_location_name, 'boisko')
           || ' · ' || (
             SELECT count(*) FROM event_participants x
              WHERE x.event_id = e.id AND x.pending_approval IS NOT TRUE
                AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE
           ) || '/' || e.max_players || ' w składzie',
         e.id
    FROM events e
   WHERE e.event_date = v_dzis + 1
     AND e.status = 'active'
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = e.organizer_id
              AND n.event_id = e.id
              AND n.type = 'przypomnienie_o_meczu');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  -- =========================================================================
  -- C. PO MECZU — tylko organizator i tylko wtedy, gdy JEST co domknąć
  -- =========================================================================
  -- Warunek „jest co domknąć" jest istotą tego powiadomienia. Przypomnienie
  -- wysyłane po każdym meczu, także w pełni rozliczonym, jest wyłącznie
  -- hałasem — a wyłączony kanał nie dowozi już niczego, łącznie z tym, co
  -- ważne. Stąd sprawdzamy stan: brak wyniku (gdy mecz go w ogóle prowadzi)
  -- albo ktoś nie oddał kasy.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'po_meczu_do_domkniecia',
         coalesce(e.title, e.sport),
         'Mecz rozegrany. ' || array_to_string(
           array_remove(ARRAY[
             CASE WHEN e.track_results
                   AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.event_id = e.id)
                  THEN 'Wpisz wynik' END,
             CASE WHEN e.cost_grosz > 0 AND (
                    SELECT count(*) FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE) > 0
                  THEN 'odhacz wpłaty — ' || (
                    SELECT count(*) FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE)
                    || ' osób jeszcze nie oddało' END
           ], NULL), ', ') || '.',
         e.id
    FROM events e
   WHERE e.event_date = v_dzis - 1
     AND e.status = 'active'
     AND (
       (e.track_results AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.event_id = e.id))
       OR (e.cost_grosz > 0 AND EXISTS (
             SELECT 1 FROM event_participants x
              WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                AND x.is_reserve IS NOT TRUE))
     )
     AND NOT EXISTS (
           SELECT 1 FROM notifications n
            WHERE n.user_id = e.organizer_id
              AND n.event_id = e.id
              AND n.type = 'po_meczu_do_domkniecia');

  GET DIAGNOSTICS v_teraz = ROW_COUNT;
  v_ile := v_ile + v_teraz;

  RETURN v_ile;
END;
$$;

-- Wołana WYŁĄCZNIE przez zadanie w bazie. Z przeglądarki nie ma jej po co
-- ruszać, a dostępna dla `anon` byłaby zaproszeniem do rozsyłania powiadomień
-- cudzym ekipom.
REVOKE ALL ON FUNCTION wyslij_przypomnienia() FROM public;
REVOKE ALL ON FUNCTION wyslij_przypomnienia() FROM anon, authenticated;

COMMENT ON FUNCTION wyslij_przypomnienia() IS
  'Przypomnienia oparte o czas: „jutro grasz" dla składu i organizatora oraz „po meczu" (wynik/rozliczenie) dla organizatora, gdy jest co domknąć. Idempotentna — drugie uruchomienie tego samego dnia nie dubluje wierszy. Cel zadania pg_cron; działa też wywołana ręcznie.';

-- ---------------------------------------------------------------------------
-- 2. Zadanie w bazie
-- ---------------------------------------------------------------------------
-- 16:00 UTC = 18:00 czasu polskiego latem, 17:00 zimą. Godzina wybrana tak,
-- żeby przypomnienie o jutrzejszym meczu trafiało w porę, w której jeszcze da
-- się zareagować (znaleźć kogoś, odwołać, dopłacić), a nie w środku nocy.
--
-- Owinięte w DO wzorem `073`: samo `cron.schedule` na bazie bez `pg_cron`
-- wywraca całą migrację. Na produkcji rozszerzenie JEST włączone (sprawdzone
-- 2026-09-02), ale `baza-testowa.sh` stawia goły Postgres bez niego.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- `unschedule` przed `schedule`: bez tego drugie uruchomienie migracji
    -- wywala się na duplikacie nazwy zadania.
    PERFORM cron.unschedule('bojo-przypomnienia')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bojo-przypomnienia');
    PERFORM cron.schedule(
      'bojo-przypomnienia',
      '0 16 * * *',
      'SELECT wyslij_przypomnienia()'
    );
    RAISE NOTICE 'Zadanie bojo-przypomnienia ustawione na 16:00 UTC (18:00 czasu polskiego latem).';
  ELSE
    RAISE NOTICE 'pg_cron niewłączony — przypomnienia NIE będą wychodzić. Włącz: Database → Extensions → pg_cron, potem uruchom ten blok ponownie.';
  END IF;
END
$$;

-- SPRAWDZENIE PO URUCHOMIENIU (wkleić w SQL Editorze):
--   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'bojo-przypomnienia';
--   SELECT wyslij_przypomnienia();   -- ręczne wywołanie: zwraca liczbę wysłanych
