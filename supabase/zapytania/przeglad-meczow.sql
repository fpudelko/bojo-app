-- ============================================================
-- Bojo — PRZEGLĄD MECZÓW NA PRODUKCJI (tylko odczyt)
-- ============================================================
-- Po co: na produkcji wisi dużo meczów, które wyglądają na testowe (część
-- z czasów Lovable, sprzed markerów typu [TEST]), a publiczna lista meczów
-- z fikcyjnymi gierkami obniża wiarygodność aplikacji. `wyczysc-testowe.sql`
-- kasuje wyłącznie po markerze, więc tych meczów nie ruszy. Ten plik niczego
-- nie zmienia, tylko wypisuje materiał do decyzji, CO skasować.
--
-- Jak uruchomić: Supabase → SQL Editor. Edytor pokazuje wynik TYLKO
-- ostatniego zapytania, więc zaznacz sekcję A i uruchom (Run selected),
-- potem to samo z sekcją B. Wynik: przycisk „Export" → CSV.
--
-- Twoje konta (organizator z tej listy dostaje sygnał „moje konto"): edytuj
-- listę `moje` w obu sekcjach, jeśli dochodzi kolejne.
--
-- Kolumna `sygnaly` zbiera poszlaki testowości. To nie wyrok: mecz z pustą
-- listą sygnałów też może być testowy, a z sygnałem może być prawdziwy.
-- ============================================================


-- ── A. KTO ZAKŁADAŁ MECZE (jeden wiersz na organizatora) ───────────────
-- Najszybsza droga do decyzji: dane z generatora zwykle siedzą na kilku
-- kontach, więc często wystarczy powiedzieć „wszystko od tych kont".
WITH moje(email) AS (VALUES ('franekks@gmail.com'), ('franciszekpudelko@gmail.com')),
testowi AS (
  -- Wpisy kont testowych na mecz: @example.com (test1..10, gracz01..60)
  -- i @seed.bojo (seed-events.sql).
  SELECT ep.event_id, count(*) AS ile
  FROM event_participants ep
  JOIN profiles pp ON pp.id = ep.user_id
  WHERE pp.email LIKE '%@example.com' OR pp.email LIKE '%@seed.bojo'
  GROUP BY ep.event_id
)
SELECT
  coalesce(p.email, '(brak e-maila w profilu)')              AS email,
  (p.email IN (SELECT email FROM moje))                      AS moje_konto,
  coalesce(p.display_name, min(e.organizer_name))            AS nazwa,
  count(*)                                                   AS meczow,
  count(*) FILTER (WHERE e.visibility = 'public')            AS publicznych,
  count(*) FILTER (WHERE e.event_date >= CURRENT_DATE)       AS nadchodzacych,
  count(*) FILTER (WHERE e.visibility = 'public'
                     AND e.event_date >= CURRENT_DATE
                     AND e.status = 'active')                AS widac_na_liscie,
  count(*) FILTER (WHERE e.description LIKE '[%')            AS z_markerem,
  count(*) FILTER (WHERE t.ile > 0)                          AS z_testowymi_graczami,
  min(e.created_at)::date                                    AS pierwszy_zalozony,
  max(e.created_at)::date                                    AS ostatni_zalozony,
  e.organizer_id
FROM events e
LEFT JOIN profiles p ON p.id = e.organizer_id
LEFT JOIN testowi t ON t.event_id = e.id
GROUP BY e.organizer_id, p.email, p.display_name
ORDER BY widac_na_liscie DESC, meczow DESC;


-- ── B. MECZE PO KOLEI (publiczne i nadchodzące na górze) ───────────────
WITH moje(email) AS (VALUES ('franekks@gmail.com'), ('franciszekpudelko@gmail.com')),
uczestnicy AS (
  SELECT
    ep.event_id,
    count(*)                                            AS wpisow,
    count(DISTINCT ep.user_id)                          AS roznych_kont,
    count(*) FILTER (WHERE pp.email LIKE '%@example.com'
                        OR pp.email LIKE '%@seed.bojo') AS testowych,
    count(*) FILTER (WHERE pp.email IN (SELECT email FROM moje)) AS moich
  FROM event_participants ep
  LEFT JOIN profiles pp ON pp.id = ep.user_id
  GROUP BY ep.event_id
),
tytuly AS (
  SELECT lower(coalesce(title, '')) AS t, count(*) AS ile
  FROM events
  GROUP BY 1
)
SELECT
  left(e.id::text, 8)                                        AS id_krotkie,
  e.visibility                                               AS widocznosc,
  e.status,
  e.event_date                                               AS termin,
  CASE WHEN e.event_date >= CURRENT_DATE THEN 'nadchodzi' ELSE 'minął' END AS kiedy,
  e.sport,
  e.title                                                    AS tytul,
  coalesce(e.custom_location_name, e.field_name)             AS miejsce,
  coalesce(p.email, e.organizer_name)                        AS organizator,
  coalesce(u.wpisow, 0)                                      AS wpisow,
  coalesce(u.testowych, 0)                                   AS testowych_graczy,
  e.max_players                                              AS miejsc,
  e.created_at::date                                         AS zalozony,
  concat_ws(', ',
    CASE WHEN e.description LIKE '[%'                     THEN 'marker seeda' END,
    CASE WHEN p.email LIKE '%@seed.bojo'                  THEN 'konto @seed.bojo' END,
    CASE WHEN p.email LIKE '%@example.com'                THEN 'konto @example.com' END,
    CASE WHEN p.id IS NULL                                THEN 'organizator bez profilu' END,
    CASE WHEN p.email IN (SELECT email FROM moje)         THEN 'moje konto organizuje' END,
    CASE WHEN u.testowych > 0                             THEN 'testowi gracze ' || u.testowych || '/' || u.wpisow END,
    CASE WHEN u.wpisow > 0
          AND u.testowych + u.moich = u.wpisow            THEN 'zapisani tylko testowi i moi' END,
    CASE WHEN (coalesce(e.title, '') || ' ' || coalesce(e.description, ''))
              ~* '(test|demo|lorem|przyk[łl]ad|asdf|qwe|xxx|sample|dummy)'
                                                          THEN 'słowo testowe' END,
    CASE WHEN tt.ile >= 3                                 THEN 'tytuł powtórzony ' || tt.ile || '×' END,
    CASE WHEN coalesce(u.wpisow, 0) = 0                   THEN 'nikt nie zapisany' END,
    CASE WHEN coalesce(u.roznych_kont, 0) <= 1
          AND coalesce(u.wpisow, 0) > 1                   THEN 'sami goście' END,
    CASE WHEN e.field_id IS NULL
          AND e.custom_address IS NULL                    THEN 'brak boiska i adresu' END
  )                                                          AS sygnaly,
  left(regexp_replace(coalesce(e.description, ''), '\s+', ' ', 'g'), 80) AS opis_poczatek,
  '/wydarzenia/' || e.id                                     AS adres
FROM events e
LEFT JOIN profiles   p  ON p.id = e.organizer_id
LEFT JOIN uczestnicy u  ON u.event_id = e.id
LEFT JOIN tytuly     tt ON tt.t = lower(coalesce(e.title, ''))
ORDER BY
  (e.visibility = 'public' AND e.event_date >= CURRENT_DATE AND e.status = 'active') DESC,
  e.visibility = 'public' DESC,
  e.event_date DESC
LIMIT 500;
