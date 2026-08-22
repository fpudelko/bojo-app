-- ============================================================
-- Bojo — SPRZĄTANIE DANYCH TESTOWYCH
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
--
-- PO CO. Seedy w tym repo są pisane do wklejania wprost na produkcję i każdy
-- zostawia po sobie kilkadziesiąt meczów. Zanim wpuścisz do aplikacji ludzi,
-- ktoś musi je stamtąd usunąć — inaczej pierwsze, co zobaczą, to lista
-- fikcyjnych gierek na boiskach, których nie ma.
--
-- CO KASUJE. Wyłącznie wiersze z MARKEREM w opisie — nie „wszystko, co
-- wygląda na testowe". Marker jest jedyną rzeczą, która odróżnia dane seeda
-- od prawdziwego meczu, więc jest też jedynym bezpiecznym warunkiem:
--
--   [TEST]          seed_test_data.sql
--   [TEST-G]        seed_test_groups.sql
--   [TEST-J]        seed_test_jan.sql
--   [REG]           seed_regresja.sql
--   [TAK]           seed_taktyka.sql
--   [WIZ]           seed_wizualne.sql  (normalnie tylko lokalnie)
--   [DEMO-LANDING]  seed_landing_demo.sql
--   [PRZED]         seed_przedpremiera.sql
--
-- Uczestnicy, rozmowy, wyniki, numery BLIK i wpisy w kolejce znikają razem
-- z meczem (`ON DELETE CASCADE`) — nie trzeba ich kasować osobno.
--
-- CZEGO NIE KASUJE, świadomie:
--   • KONT testowych (`test1..test10@example.com`) — kasowanie kont to osobna
--     decyzja i osobne ryzyko; jeśli chcesz je usunąć, zrób to w panelu
--     Supabase → Authentication, patrząc na listę,
--   • katalogu boisk — to prawdziwe dane z OpenStreetMap, nie test,
--   • Twoich własnych meczów bez markera — nawet jeśli powstały przy okazji
--     klikania. Te musisz przejrzeć okiem; zapytanie na dole je wypisuje.
--
-- NAJPIERW PODGLĄD. Sekcja 1 tylko liczy. Uruchom ją, zobacz liczby, i dopiero
-- potem odkomentuj sekcję 2.
-- ============================================================

-- ── 1. PODGLĄD: co zniknie ──────────────────────────────────────────────
SELECT
  CASE
    WHEN description LIKE '[TEST]%'         THEN '[TEST] seed_test_data'
    WHEN description LIKE '[TEST-G]%'       THEN '[TEST-G] seed_test_groups'
    WHEN description LIKE '[TEST-J]%'       THEN '[TEST-J] seed_test_jan'
    WHEN description LIKE '[REG]%'          THEN '[REG] seed_regresja'
    WHEN description LIKE '[TAK]%'          THEN '[TAK] seed_taktyka'
    WHEN description LIKE '[WIZ]%'          THEN '[WIZ] seed_wizualne'
    WHEN description LIKE '[DEMO-LANDING]%' THEN '[DEMO-LANDING] seed_landing_demo'
    WHEN description LIKE '[PRZED]%'        THEN '[PRZED] seed_przedpremiera'
  END                       AS skad,
  count(*)                  AS meczow,
  min(event_date)           AS od,
  max(event_date)           AS do
FROM events
WHERE description LIKE '[TEST]%' OR description LIKE '[TEST-G]%'
   OR description LIKE '[TEST-J]%' OR description LIKE '[REG]%'
   OR description LIKE '[TAK]%' OR description LIKE '[WIZ]%'
   OR description LIKE '[DEMO-LANDING]%' OR description LIKE '[PRZED]%'
GROUP BY 1
ORDER BY 1;

-- ── 2. KASOWANIE ────────────────────────────────────────────────────────
-- Odkomentuj (usuń `/*` i `*/`) i uruchom ponownie.
/*
BEGIN;

DELETE FROM events
 WHERE description LIKE '[TEST]%' OR description LIKE '[TEST-G]%'
    OR description LIKE '[TEST-J]%' OR description LIKE '[REG]%'
    OR description LIKE '[TAK]%' OR description LIKE '[WIZ]%'
    OR description LIKE '[DEMO-LANDING]%' OR description LIKE '[PRZED]%';

-- Ekipy z seedów. Nazwy, nie markery — grupy nie mają kolumny na opis testu
-- w tym samym kształcie, a te nazwy są jednoznaczne.
DELETE FROM groups WHERE name IN (
  '[PRZED] Ekipa testowa',
  'Czwartkowa Ekipa', 'Poranne Bieganie', 'Koszykarze z Wildy', 'Siatkarze Poznań'
);

COMMIT;
*/

-- ── 3. CO ZOSTAŁO: mecze bez markera, do przejrzenia okiem ──────────────
-- Tu wylądują Twoje własne mecze zrobione „przy okazji" podczas klikania.
-- Aplikacja nie ma jak odróżnić ich od prawdziwych — decyzja jest Twoja.
SELECT
  e.title,
  e.event_date                                   AS termin,
  e.visibility                                   AS widocznosc,
  coalesce(p.display_name, e.organizer_name)     AS organizator,
  (SELECT count(*) FROM event_participants x WHERE x.event_id = e.id) AS wpisow,
  '/wydarzenia/' || e.id                         AS adres
FROM events e
LEFT JOIN profiles p ON p.id = e.organizer_id
WHERE coalesce(e.description, '') NOT LIKE '[%'
ORDER BY e.event_date DESC
LIMIT 100;
