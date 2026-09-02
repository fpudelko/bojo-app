-- 131: „1 osób jeszcze nie oddało" — odmiana w powiadomieniu po meczu.
--
-- CO BYŁO ŹLE. Migracja `129` sklejała liczbę z twardym „osób":
--
--     … || (SELECT count(*) …) || ' osób jeszcze nie oddało'
--
-- Przy jednej osobie dawało to „1 osób jeszcze nie oddało", przy dwóch
-- „2 osób". Zauważone na PRODUKCJI, w powiadomieniu, które już poszło ludziom
-- na telefony — pierwsze uruchomienie `wyslij_przypomnienia()` wysłało trzy
-- takie prośby o domknięcie meczu.
--
-- To jest dokładnie ta pułapka, którą repo ma opisaną po stronie TypeScriptu:
-- `withCount()` w `lib/plural.ts` powstało, bo reguła „n < 5" myli się
-- na 12–14, a `eventShareText` ma o tym osobny komentarz. Po stronie SQL-a
-- takiego pomocnika nie było, więc `129` odtworzyła błąd, przed którym
-- reszta kodu się broni od dawna.
--
-- ODMIENIA SIĘ TEŻ CZASOWNIK, nie tylko rzeczownik: „osoba nie oddała",
-- „osoby nie oddały", „osób nie oddało". Dlatego pomocnik zwraca cały człon,
-- a nie samo słowo — inaczej wołający musiałby pamiętać o drugiej odmianie
-- i połowa wywołań by ją zgubiła.

-- ---------------------------------------------------------------------------
-- 1. Pomocnik odmiany
-- ---------------------------------------------------------------------------
-- Reguła polska: 1 → pojedyncza; końcówki 2-4 POZA 12-14 → mnoga „lekka";
-- reszta (0, 5-21, 25-31…) → dopełniacz. Wyjątek na 12-14 jest tu sednem,
-- nie ozdobnikiem: bez niego „12 osoby", „13 osoby", „14 osoby".
CREATE OR REPLACE FUNCTION odmien_nie_oddalo(n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT n || CASE
    WHEN n = 1 THEN ' osoba jeszcze nie oddała'
    WHEN n % 10 BETWEEN 2 AND 4 AND n % 100 NOT BETWEEN 12 AND 14
      THEN ' osoby jeszcze nie oddały'
    ELSE ' osób jeszcze nie oddało'
  END;
$$;

COMMENT ON FUNCTION odmien_nie_oddalo(integer) IS
  'Odmieniony człon „N osób jeszcze nie oddało" do treści powiadomienia po meczu. Odpowiednik withCount() z frontend/src/lib/plural.ts — razem z czasownikiem, bo ten też się odmienia.';

-- ---------------------------------------------------------------------------
-- 2. wyslij_przypomnienia — ciało z `129`, zmieniony WYŁĄCZNIE ten jeden człon
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
  -- A. JUTRO GRASZ — do wszystkich, którzy mają miejsce w składzie
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

  -- B. ORGANIZATOR, KTÓRY JUTRO GRA, ALE NIE MA SIEBIE W SKŁADZIE
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

  -- C. PO MECZU — tylko organizator i tylko wtedy, gdy JEST co domknąć
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'po_meczu_do_domkniecia',
         coalesce(e.title, e.sport),
         'Mecz rozegrany. ' || array_to_string(
           array_remove(ARRAY[
             CASE WHEN e.track_results
                   AND NOT EXISTS (SELECT 1 FROM match_results r WHERE r.event_id = e.id)
                  THEN 'Wpisz wynik' END,
             -- TU BYŁA POPRAWKA (`131`): odmiana zamiast twardego „osób".
             CASE WHEN e.cost_grosz > 0 AND (
                    SELECT count(*) FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE) > 0
                  THEN 'odhacz wpłaty — ' || odmien_nie_oddalo((
                    SELECT count(*)::int FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE)) END
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

REVOKE ALL ON FUNCTION wyslij_przypomnienia() FROM public;
REVOKE ALL ON FUNCTION wyslij_przypomnienia() FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Naprawa treści, które już wyszły
-- ---------------------------------------------------------------------------
-- Trzy powiadomienia zdążyły pójść ze złą odmianą, zanim to wyszło na jaw.
-- Push już poleciał i tego się nie cofnie, ale pod dzwonkiem te wiersze wiszą
-- dalej — a tam da się je poprawić. `UPDATE` jest bezpieczny: wyzwalacz
-- `trg_wyslij_push` (`102`) łapie wyłącznie `INSERT`, więc nikomu nie zabrzmi
-- telefon drugi raz (ta sama własność, na której opiera się `122`).
UPDATE notifications
   SET body = replace(body, '— 1 osób jeszcze nie oddało', '— 1 osoba jeszcze nie oddała')
 WHERE type = 'po_meczu_do_domkniecia'
   AND body LIKE '%— 1 osób jeszcze nie oddało%';

UPDATE notifications
   SET body = regexp_replace(body,
        '— ([2-4]) osób jeszcze nie oddało', '— \1 osoby jeszcze nie oddały')
 WHERE type = 'po_meczu_do_domkniecia'
   AND body ~ '— [2-4] osób jeszcze nie oddało'
   -- 12-14 zostają w dopełniaczu i NIE mogą wpaść w regułę wyżej.
   AND body !~ '— 1[2-4] osób jeszcze nie oddało';
