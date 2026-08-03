-- ============================================================================
-- BOJO — przywrócenie ręcznie dobranych współrzędnych boisk
-- ============================================================================
-- Plik generowany: node scripts/build-restore-coords.mjs — nie edytuj ręcznie.
--
-- Co naprawia: 2026-06-13 workflow "Fix GPS Coordinates" przeliczył lat/lng
-- z adresu przez Nominatim dla obiektów source=manual (log: Fixed 59, OK 7,
-- Errors 2). Adres wskazuje budynek albo wjazd, nie płytę boiska, więc
-- pinezki przesunęły się o setki metrów do 3 km.
--
-- Zawiera 63 obiektów z plików: seed.sql, seed-orliki.sql, seed-rental-venues.sql, seed-beach-volleyball.sql.
-- UPDATE po ID — nie tworzy nic nowego, nie rusza obiektów z OSM.
--
-- NAJPIERW podgląd: odkomentuj sekcję "PRZED" na dole, żeby zobaczyć,
-- o ile każdy pin się ruszy, zanim cokolwiek zapiszesz.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE seed_coords (id UUID PRIMARY KEY, name TEXT, lat NUMERIC, lng NUMERIC) ON COMMIT DROP;

INSERT INTO seed_coords (id, name, lat, lng) VALUES
  ('b1a2c3d4-0001-0001-0001-000000000001', 'Boisko Sportowe ul. Dąbrowskiego', 52.4234, 16.9012),
  ('b1a2c3d4-0002-0002-0002-000000000002', 'Hala Arena Poznań — Sale Boczne', 52.3932, 16.9271),
  ('b1a2c3d4-0003-0003-0003-000000000003', 'Korty Tenisowe Olimpia', 52.4512, 16.9445),
  ('b1a2c3d4-0004-0004-0004-000000000004', 'Boisko Wielofunkcyjne Malta', 52.4068, 16.9780),
  ('b1a2c3d4-0005-0005-0005-000000000005', 'Hala Widowiskowo-Sportowa UAM', 52.4088, 16.9155),
  ('ab000001-0000-0000-0000-000000000001', 'Orlik — ZST Golęcin', 52.42330, 16.88310),
  ('ab000002-0000-0000-0000-000000000002', 'Orlik — Ogród Jordanowski nr 2', 52.38940, 16.89890),
  ('ab000003-0000-0000-0000-000000000003', 'Orlik — ul. Żonkilowa', 52.42560, 16.84810),
  ('ab000004-0000-0000-0000-000000000004', 'Orlik — MDK nr 1 Dębina', 52.40310, 17.00420),
  ('ab000005-0000-0000-0000-000000000005', 'Orlik — SP nr 34 os. Śmiałe', 52.41590, 16.96230),
  ('ab000006-0000-0000-0000-000000000006', 'Orlik — SP nr 17 os. Chrobrego', 52.44810, 16.92530),
  ('ab000007-0000-0000-0000-000000000007', 'Orlik — SP nr 51 os. Lecha', 52.43300, 17.04320),
  ('ab000008-0000-0000-0000-000000000008', 'Orlik — SP nr 6 os. Rusa', 52.43950, 16.98850),
  ('ab000009-0000-0000-0000-000000000009', 'Orlik POSiR — os. Piastowskie', 52.39600, 16.97950),
  ('ab000010-0000-0000-0000-000000000010', 'Orlik — V LO ul. Zmartwychwstańców', 52.40680, 16.96810),
  ('ab000011-0000-0000-0000-000000000011', 'Orlik — ZSB ul. Grunwaldzka', 52.40950, 16.90030),
  ('ab000012-0000-0000-0000-000000000012', 'Orlik — SP nr 33 ul. Wyspiańskiego', 52.41270, 16.92080),
  ('ab000013-0000-0000-0000-000000000013', 'Orlik — SP nr 78 ul. Hetmańska', 52.39590, 16.87380),
  ('ab000014-0000-0000-0000-000000000014', 'Orlik — SP nr 5 os. Mielżyńskiego Swarzędz', 52.41270, 17.08260),
  ('ab000015-0000-0000-0000-000000000015', 'Orlik — os. Raczyńskiego Swarzędz', 52.40980, 17.07910),
  ('ab000016-0000-0000-0000-000000000016', 'Orlik — Bogucin ul. Wrzosowa', 52.43580, 17.10540),
  ('ab000017-0000-0000-0000-000000000017', 'Orlik — ZS Mosina ul. Topolowa', 52.23870, 16.84880),
  ('ab000018-0000-0000-0000-000000000018', 'Orlik — SP nr 4 Luboń ul. Dojazdowa', 52.34190, 16.87020),
  ('ab000019-0000-0000-0000-000000000019', 'Orlik — Raduszyn ul. Mściszewska', 52.57320, 17.00620),
  ('ab000020-0000-0000-0000-000000000020', 'Orlik — OSiR Tarnowo Podgórne ul. Ogrodowa', 52.46260, 16.68430),
  ('ab000021-0000-0000-0000-000000000021', 'Orlik — Baranowo (gm. Tarnowo Podgórne)', 52.43940, 16.71260),
  ('ab000022-0000-0000-0000-000000000022', 'Orlik — AKWEN Koziegłowy ul. Wojciecha', 52.47410, 16.97840),
  ('ab000023-0000-0000-0000-000000000023', 'Orlik — GOS Suchy Las', 52.47480, 16.89720),
  ('ab000024-0000-0000-0000-000000000024', 'Orlik — Kostrzyn Wlkp. ul. Powstańców', 52.39590, 17.22470),
  ('ab000025-0000-0000-0000-000000000025', 'Orlik — OAZA Kórnik ul. Leśna', 52.23710, 17.09110),
  ('ab000026-0000-0000-0000-000000000026', 'Orlik — SP Dobieżyn (gm. Buk)', 52.36170, 16.52840),
  ('ab000027-0000-0000-0000-000000000027', 'Orlik — OSiR Pobiedziska ul. Kiszkowska', 52.48170, 17.29160),
  ('ab000028-0000-0000-0000-000000000028', 'Orlik — Puszczykowo Nowe Osiedle', 52.29860, 16.85630),
  ('ab000029-0000-0000-0000-000000000029', 'Orlik — LO Puszczykowo ul. Libelta', 52.29510, 16.85790),
  ('ab000030-0000-0000-0000-000000000030', 'Orlik — SP Skórzewo ul. Kozierowskiego', 52.39290, 16.81560),
  ('ab000031-0000-0000-0000-000000000031', 'Orlik — GOSiR Dopiewo ul. Polna', 52.36790, 16.73470),
  ('ab000032-0000-0000-0000-000000000032', 'Orlik — GOKiS Kleszczewo ul. Poznańska', 52.33240, 17.14560),
  ('ab000033-0000-0000-0000-000000000033', 'Orlik — Tulce (gm. Kleszczewo)', 52.34880, 17.11670),
  ('ab000034-0000-0000-0000-000000000034', 'Orlik — Stęszew ul. Trzebawska', 52.26090, 16.69810),
  ('cc000001-0000-0000-0000-000000000001', 'Sportwin Arena Dębiec — Balon Piłkarski', 52.37850, 16.95250),
  ('cc000002-0000-0000-0000-000000000002', 'Centrum Plek — Zadaszony Kompleks Sportowy', 52.41280, 16.81650),
  ('cc000003-0000-0000-0000-000000000003', 'WTKKF — Boiska Sportowe Winogrady', 52.43750, 16.92600),
  ('cc000004-0000-0000-0000-000000000004', 'POSiR Golęcin — Boiska Piłkarskie', 52.42722, 16.88833),
  ('cc000005-0000-0000-0000-000000000005', 'POSiR Chwiałka — Hale Sportowe', 52.42100, 16.94800),
  ('cc000006-0000-0000-0000-000000000006', 'PUT CSPP — Hala Sportowa Piotrowo', 52.40260, 16.94830),
  ('cc000007-0000-0000-0000-000000000007', 'CKF UP — Hala Sportowa Wojska Polskiego', 52.40420, 16.92400),
  ('cc000008-0000-0000-0000-000000000008', 'POSiR Malta — Boisko Piłkarskie', 52.39520, 16.99560),
  ('bb000001-0000-0000-0000-000000000001', 'POSiR Rusałka — Boiska Siatkówki Plażowej', 52.42640, 16.87670),
  ('bb000002-0000-0000-0000-000000000002', 'Piach i Podróże — Boiska Plażowe', 52.39600, 16.97950),
  ('bb000003-0000-0000-0000-000000000003', 'Beach Arena — Beach Volleyball Academy', 52.40980, 16.92350),
  ('bb000004-0000-0000-0000-000000000004', 'POSiR Chwiałka — Boiska Siatkówki Plażowej', 52.42190, 16.94780),
  ('bb000005-0000-0000-0000-000000000005', 'POSiR Strzeszynek — Boiska Siatkówki Plażowej', 52.43500, 16.83120),
  ('bb000006-0000-0000-0000-000000000006', 'Oaza Strzeszynek — Boiska Plażowe', 52.43500, 16.83050),
  ('bb000007-0000-0000-0000-000000000007', 'POSiR MOS — Boiska Siatkówki Plażowej', 52.40030, 16.91010),
  ('bb000008-0000-0000-0000-000000000008', 'CSPP Politechnika Poznańska — Boisko Plażowe', 52.40260, 16.94800),
  ('bb000009-0000-0000-0000-000000000009', 'CKF Uniwersytet Przyrodniczy — Boiska Plażowe', 52.40420, 16.92400),
  ('bb000010-0000-0000-0000-000000000010', 'OAZA Kórnickie Centrum Rekreacji — Boiska Plażowe', 52.24190, 17.08820),
  ('bb000011-0000-0000-0000-000000000011', 'AKWEN Centrum Sportu — Boisko Siatkówki Plażowej', 52.47470, 17.01160),
  ('bb000012-0000-0000-0000-000000000012', 'Boisko Siatkówki Plażowej — ul. Poziomkowa', 52.47010, 16.88600),
  ('bb000013-0000-0000-0000-000000000013', 'Boisko Siatkówki Plażowej — ul. Szkółkarska', 52.46160, 16.89520),
  ('bb000014-0000-0000-0000-000000000014', 'GOKiS Tulce — Boisko Siatkówki Plażowej', 52.33710, 17.12310),
  ('bb000015-0000-0000-0000-000000000015', 'OSiR Mosina — Boiska Siatkówki Plażowej', 52.24240, 16.85100),
  ('bb000016-0000-0000-0000-000000000016', 'OSiR Buk — Boiska Siatkówki Plażowej', 52.35850, 16.52300);

-- Ile obiektów faktycznie odjechało i jak daleko (w metrach).
SELECT
  s.name,
  round((
    6371000 * sqrt(
      power(radians(f.lat - s.lat), 2) +
      power(radians(f.lng - s.lng) * cos(radians((f.lat + s.lat) / 2)), 2)
    )
  )::numeric) AS przesuniecie_m,
  f.lat AS teraz_lat, f.lng AS teraz_lng,
  s.lat AS seed_lat,  s.lng AS seed_lng
FROM seed_coords s
JOIN fields f ON f.id = s.id
WHERE f.lat IS DISTINCT FROM s.lat OR f.lng IS DISTINCT FROM s.lng
ORDER BY przesuniecie_m DESC;

-- Właściwe przywrócenie.
UPDATE fields f
SET lat = s.lat, lng = s.lng
FROM seed_coords s
WHERE f.id = s.id
  AND (f.lat IS DISTINCT FROM s.lat OR f.lng IS DISTINCT FROM s.lng);

-- Zadowolony z listy powyżej? Zamień na COMMIT.
ROLLBACK;
