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
--   [DWA]           seed_dwa_konta.sql
--   [TUR]           seed_turnieje.sql  (turnieje, nie mecze — patrz sekcja 2b)
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
-- MECZE BEZ MARKERA (Lovable, klikanie z własnych kont, audyty): patrz
-- `wyczysc-mecze-prod.sql`, który decyduje po KONCIE organizatora.
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
    WHEN description LIKE '[DWA]%'          THEN '[DWA] seed_dwa_konta'
  END                       AS skad,
  count(*)                  AS meczow,
  min(event_date)           AS od,
  max(event_date)           AS do
FROM events
WHERE description LIKE '[TEST]%' OR description LIKE '[TEST-G]%'
   OR description LIKE '[TEST-J]%' OR description LIKE '[REG]%'
   OR description LIKE '[TAK]%' OR description LIKE '[WIZ]%'
   OR description LIKE '[DEMO-LANDING]%' OR description LIKE '[PRZED]%'
   OR description LIKE '[DWA]%'
GROUP BY 1
ORDER BY 1;

-- Turnieje liczone osobno — inna tabela, inny marker.
SELECT
  left(opis, 20)  AS marker,
  count(*)        AS turniejow,
  min(data_startu) AS od,
  max(data_startu) AS do
FROM turnieje
WHERE opis LIKE '[TUR]%' OR opis LIKE '[TURNIEJ-TEST]%'
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
    OR description LIKE '[DEMO-LANDING]%' OR description LIKE '[PRZED]%'
    OR description LIKE '[DWA]%';

-- Ekipy z seedów. Nazwy, nie markery — grupy nie mają kolumny na opis testu
-- w tym samym kształcie, a te nazwy są jednoznaczne.
DELETE FROM groups WHERE name IN (
  '[PRZED] Ekipa testowa',
  '[DWA] Ekipa testowa',
  'Czwartkowa Ekipa', 'Poranne Bieganie', 'Koszykarze z Wildy', 'Siatkarze Poznań'
);

-- Rozmowa prywatna z seed_dwa_konta.sql — jedyny seed, który dokłada DM;
-- content, nie description (dm_messages nie ma osobnej kolumny na opis testu).
DELETE FROM dm_messages WHERE content LIKE '[DWA]%';

-- 2b. TURNIEJE (seed_turnieje.sql, migracja 145). Osobne zapytanie, bo turniej
-- NIE jest meczem: `turnieje` to własna tabela, a kasowanie po `events` nigdy
-- ich nie ruszy. Drużyny, składy, mecze turniejowe, zdarzenia i ogłoszenia
-- lecą kaskadą razem z turniejem.
DELETE FROM turnieje WHERE opis LIKE '[TUR]%' OR opis LIKE '[TURNIEJ-TEST]%';

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


-- ── 3b. CO ZOSTAŁO: TURNIEJE bez markera ────────────────────────────────
-- Sekcja 3 pytała wyłącznie o `events`, więc turniej zrobiony ręcznie przy
-- klikaniu nie pokazywał się NIGDZIE: ani w podglądzie (sekcja 1 liczy po
-- markerze), ani tutaj. Wyszło przy audycie UX, który zostawił na produkcji
-- turniej „AUDYT TEST do usuniecia" wraz z drużyną, i nic go nie zgłosiło.
--
-- `SHOW_TURNIEJE` chowa wejścia w nawigacji, nie trasy, więc taki turniej jest
-- publicznie dostępny pod swoim adresem tak samo jak prawdziwy.
SELECT
  t.nazwa,
  t.status,
  t.data_startu                                                       AS termin,
  coalesce(p.display_name, '(brak profilu)')                          AS organizator,
  (SELECT count(*) FROM turniej_druzyny d WHERE d.turniej_id = t.id)  AS druzyn,
  '/turnieje/' || t.id                                                AS adres
FROM turnieje t
LEFT JOIN profiles p ON p.id = t.organizator_id
WHERE coalesce(t.opis, '') NOT LIKE '[%'
ORDER BY t.created_at DESC
LIMIT 100;

-- Kasowanie pojedynczego turnieju z listy wyżej (drużyny, składy, mecze,
-- zdarzenia i ogłoszenia lecą kaskadą):
--   DELETE FROM turnieje WHERE id = 'WKLEJ-TU-ID';
