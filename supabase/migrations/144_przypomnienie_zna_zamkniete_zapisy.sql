-- 144 — przypomnienie dla organizatora zna zamknięte zapisy i widzi rezerwę
--
-- DLACZEGO. `wyslij_przypomnienia()` (`129`) powstała PRZED zamykaniem zapisów
-- (`141`) i nigdy do niej nie wróciła — `zapisy_zamkniete` nie pada w niej ani
-- razu. Sprawdzone zapytaniem na bazie (audyt 2026-09-12, ustalenie `S-3`):
-- mecz jutro, 14 miejsc, organizator ZAMKNĄŁ zapisy przy 3 osobach, a na
-- rezerwie stoją 2 chętne osoby. Przypomnienie mówiło:
--
--     Jutro 20:00 · Orlik Testowy · brakuje 11 (3/14)
--
-- Dwie osobne nieprawdy w jednym zdaniu:
--
--   1. „brakuje 11" na meczu, który organizator SAM zamknął słowami „gramy
--      w tym składzie" — aplikacja kłóci się z jego własną decyzją, i to
--      w chwili, w której jeszcze zdąży zgłupieć (18:00 dnia poprzedniego).
--   2. Rezerwa jest niewidzialna. „Brakuje 11" przy dwóch osobach czekających
--      na ławce to nie jest informacja, tylko zgadywanka — organizator szuka
--      na WhatsAppie ludzi, których ma w aplikacji.
--
-- JAK. Trzy warianty zamiast dwóch, dla obu bloków (organizator gra / nie gra):
--
--   * zapisy zamknięte      → „… · zapisy zamknięte (3/14)", bez „brakuje";
--   * brakuje, ktoś czeka   → „… · brakuje 11 (3/14) · 2 osoby czekają na rezerwie";
--   * brakuje, pusta rezerwa → „… · brakuje 11 (3/14)" (bez zmian);
--   * komplet                → „… " bez dopisku (bez zmian).
--
-- Rezerwa liczona TYM SAMYM filtrem co „kto realnie czeka w kolejce" w `079`
-- (`komplet_skladu`/`zwolnilo_sie_miejsce`): bez obserwujących, bez czekających
-- na akceptację, bez tych, którzy raz już oferty odpuścili.
--
-- Blok C („po meczu") zostaje NIETKNIĘTY.

-- ---------------------------------------------------------------------------
-- 1. Pomocnik odmiany — wzorem `odmien_nie_oddalo()` z migracji `131`
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION odmien_czeka_na_rezerwie(n integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT n || CASE
    WHEN n = 1 THEN ' osoba czeka na rezerwie'
    WHEN n % 10 BETWEEN 2 AND 4 AND n % 100 NOT BETWEEN 12 AND 14
      THEN ' osoby czekają na rezerwie'
    ELSE ' osób czeka na rezerwie'
  END;
$$;

COMMENT ON FUNCTION odmien_czeka_na_rezerwie(integer) IS
  'Odmieniony człon „N osób czeka na rezerwie" do treści przypomnienia dzień przed meczem. Odpowiednik odmien_nie_oddalo() z migracji 131 — ta sama reguła (wyjątek 12-14), inny czasownik.';

-- ---------------------------------------------------------------------------
-- 2. wyslij_przypomnienia — ciało z `131`, zmienione w blokach A i B
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
           e.zapisy_zamkniete,
           count(*) FILTER (
             WHERE p.pending_approval IS NOT TRUE
               AND p.rsvp <> 'maybe'
               AND p.is_reserve IS NOT TRUE)                              AS w_skladzie,
           -- Kto realnie czeka w kolejce — ten sam filtr co `079`
           -- (`komplet_skladu`/`zwolnilo_sie_miejsce`): bez obserwujących,
           -- bez czekających na akceptację, bez tych, którzy oferty odpuścili.
           count(*) FILTER (
             WHERE p.is_reserve
               AND p.pending_approval IS NOT TRUE
               AND p.rsvp <> 'maybe'
               AND p.claim_passed IS NOT TRUE)                            AS na_rezerwie
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
         -- Organizatorowi dokładamy to, co jest dla niego decyzją: zamknięte
         -- zapisy, ilu brakuje i ilu czeka na rezerwie. Reszcie sama
         -- informacja o terminie — braki nie są ich sprawą i zamieniłyby
         -- przypomnienie w prośbę o pomoc wysłaną do wszystkich.
         CASE
           WHEN p.user_id = s.organizer_id AND s.zapisy_zamkniete
             THEN 'Jutro ' || s.godzina || ' · ' || s.miejsce
                  || ' · zapisy zamknięte (' || s.w_skladzie || '/' || s.max_players || ')'
           WHEN p.user_id = s.organizer_id AND s.w_skladzie < s.max_players
             THEN 'Jutro ' || s.godzina || ' · ' || s.miejsce
                  || ' · brakuje ' || (s.max_players - s.w_skladzie)
                  || ' (' || s.w_skladzie || '/' || s.max_players || ')'
                  || CASE WHEN s.na_rezerwie > 0
                          THEN ' · ' || odmien_czeka_na_rezerwie(s.na_rezerwie::int)
                          ELSE '' END
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
  -- niego „jutro" jest informacją co najmniej tak samo ważną, więc dostaje
  -- TE SAME TRZY WARIANTY co w bloku A.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT e.organizer_id,
         'przypomnienie_o_meczu',
         coalesce(e.title, e.sport),
         CASE
           WHEN e.zapisy_zamkniete
             THEN 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                  || coalesce(e.field_name, e.custom_location_name, 'boisko')
                  || ' · zapisy zamknięte (' || w.w_skladzie || '/' || e.max_players || ')'
           WHEN w.w_skladzie < e.max_players
             THEN 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                  || coalesce(e.field_name, e.custom_location_name, 'boisko')
                  || ' · brakuje ' || (e.max_players - w.w_skladzie)
                  || ' (' || w.w_skladzie || '/' || e.max_players || ')'
                  || CASE WHEN w.na_rezerwie > 0
                          THEN ' · ' || odmien_czeka_na_rezerwie(w.na_rezerwie::int)
                          ELSE '' END
           ELSE 'Jutro ' || to_char(e.event_time, 'HH24:MI') || ' · '
                || coalesce(e.field_name, e.custom_location_name, 'boisko')
         END,
         e.id
    FROM events e
    CROSS JOIN LATERAL (
      SELECT
        count(*) FILTER (
          WHERE x.pending_approval IS NOT TRUE
            AND x.rsvp <> 'maybe'
            AND x.is_reserve IS NOT TRUE)                                AS w_skladzie,
        count(*) FILTER (
          WHERE x.is_reserve
            AND x.pending_approval IS NOT TRUE
            AND x.rsvp <> 'maybe'
            AND x.claim_passed IS NOT TRUE)                              AS na_rezerwie
        FROM event_participants x WHERE x.event_id = e.id
    ) w
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
  -- NIETKNIĘTE względem `131` — ta runda dotyczy wyłącznie przypomnienia
  -- PRZED meczem.
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
