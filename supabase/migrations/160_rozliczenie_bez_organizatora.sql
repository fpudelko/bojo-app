-- 160 — organizator nie jest swoim dłużnikiem (F-1, docs/faza1-organizator-plan.md)
--
-- DLACZEGO. Organizator, który gra we własnym meczu, siedzi w
-- `event_participants` jak każdy inny — jego wiersz ma `has_paid = false`,
-- dopóki nikt go nie odhaczy. `wyslij_przypomnienia()` (blok C, „po meczu")
-- liczy zaległości ze WSZYSTKICH nieopłaconych wierszy składu, więc na meczu,
-- w którym zapłacił każdy poza samym organizatorem, przypomnienie i tak
-- mówiło mu „odhacz wpłaty — 1 osoba jeszcze nie oddała". Sprawdzone
-- zapytaniem na lokalnej bazie: mecz płatny z samym organizatorem w składzie
-- (`has_paid = false`) → dokładnie ten tekst.
--
-- Ten sam warunek naprawia jednocześnie panel „Podział kosztów", tekst
-- „Wyślij rozliczenie ekipie" i kartę „Po meczu" po stronie frontendu
-- (`winienWplate()` w `lib/payments.ts`) — migracja jest lustrem tamtej
-- funkcji dla jedynego miejsca w bazie, które liczy to samo.
--
-- CO SIĘ ZMIENIA. Ciało funkcji skopiowane z `144` SŁOWO W SŁOWO. Bloki A
-- (jutro grasz) i B (organizator bez siebie w składzie) NIETKNIĘTE — nie mają
-- nic wspólnego z zaległościami. W bloku C dopisane
-- `AND x.user_id IS DISTINCT FROM e.organizer_id` do wszystkich trzech
-- podzapytań liczących nieopłaconych: dwóch w treści komunikatu (warunek
-- CASE + argument `odmien_nie_oddalo()`) i jednego w WHERE, które decyduje,
-- czy powiadomienie w ogóle powstaje. Pominięcie któregokolwiek z trzech
-- rozjeżdżałoby liczbę w treści z warunkiem wysyłki.
--
-- ODRZUCONE PRZY TEJ OKAZJI: przeliczanie kosztu obiektu na faktyczny skład
-- (dawne „F-2"). `event_participants` jest listą ludzi zapisanych PRZEZ Bojo,
-- nie listą ludzi na boisku — mogą grać osoby, których nikt nie dopisał do
-- żadnego meczu. Ta migracja NIE dokłada żadnej kolumny ani żadnego pola do
-- `events`; jedyna zmiana to ciało jednej funkcji.

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
  -- Jedyna zmiana względem `144` w całej funkcji: trzy podzapytania liczące
  -- nieopłaconych dostają `AND x.user_id IS DISTINCT FROM e.organizer_id`.
  -- Organizator płaci za obiekt i zbiera od reszty — jego własny wiersz nigdy
  -- nie jest zaległością, choć w bazie wygląda tak samo jak każdy inny
  -- nieopłacony wpis.
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
                       AND x.is_reserve IS NOT TRUE
                       AND x.user_id IS DISTINCT FROM e.organizer_id) > 0
                  THEN 'odhacz wpłaty — ' || odmien_nie_oddalo((
                    SELECT count(*)::int FROM event_participants x
                     WHERE x.event_id = e.id AND x.has_paid IS NOT TRUE
                       AND x.pending_approval IS NOT TRUE AND x.rsvp <> 'maybe'
                       AND x.is_reserve IS NOT TRUE
                       AND x.user_id IS DISTINCT FROM e.organizer_id)) END
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
                AND x.is_reserve IS NOT TRUE
                AND x.user_id IS DISTINCT FROM e.organizer_id))
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
