-- ============================================================================
-- BOJO — seedy (boiska, konta, wydarzenia testowe)
-- ============================================================================
-- Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.
-- URUCHOM DOPIERO PO wszystkich trzech częściach migracji.
-- 
-- Zawiera:
--   1. boiska (seed-orliki.sql)
--   2. konta testowe test1..test10@example.com, hasło test1234
--   3. konta organizatorów (hasło test1234) — tylko dla bazy deweloperskiej
--   4. 25 wydarzeń testowych pokrywających przepływy aplikacji
-- 
-- Bezpieczny do wielokrotnego uruchamiania: istniejące konta są pomijane,
-- a wydarzenia oznaczone [TEST] kasowane i tworzone od nowa.
-- 
-- Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- seed-orliki.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Boiska Orlik 2012 — Poznań i powiat poznański (~31 obiektów)
-- Źródło: poznan.pl, posir.poznan.pl, strony gmin, powiat.poznan.pl
-- GPS przybliżone — zweryfikować przed produkcją
-- ============================================================

INSERT INTO fields (
  id, name, address, lat, lng,
  sport, available, surface, is_indoor,
  phone, website, source,
  operator, description, opening_hours,
  fee, has_changing_rooms, has_shower, has_toilets,
  pitch_count, venue_type, access_type,
  district, postcode, is_verified_venue, condition
) VALUES

-- ── POZNAŃ (13 obiektów) ─────────────────────────────────────

-- 1. Orlik Golęcin (ZST) — pierwszy Orlik w Poznaniu (2008)
(
  'ab000001-0000-0000-0000-000000000001',
  'Orlik — ZST Golęcin',
  'ul. Golęcińska 9G, 60-963 Poznań',
  52.42330, 16.88310,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, 'https://www.poznan.pl/mim/sport/boiska-orlik-2012,poi,4325,39787/',
  'manual', 'Zespół Szkół Technicznych',
  'Pierwszy Orlik w Poznaniu, otwarty 2008. Boisko do piłki nożnej (sztuczna trawa) + wielofunkcyjne (koszykówka/siatkówka).',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Jeżyce', '60-963', true, 'good'
),

-- 2. Orlik Kwiatowe / Ogród Jordanowski nr 2
(
  'ab000002-0000-0000-0000-000000000002',
  'Orlik — Ogród Jordanowski nr 2',
  'ul. Przybyszewskiego 30a, 60-406 Poznań',
  52.38940, 16.89890,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, 'https://www.poznan.pl/mim/sport/boiska-orlik-2012,poi,4325,39787/',
  'manual', 'POSiR Poznań',
  'Orlik przy Ogrodzie Jordanowskim nr 2. Animator sportu w soboty 11–16.',
  'Mo-Fr 09:00-20:00; Sa 10:00-20:00',
  false, false, false, true,
  2, 'orlik', 'public', 'Grunwald', '60-406', true, 'good'
),

-- 3. Orlik Żonkilowa (os. Kwiatowe)
(
  'ab000003-0000-0000-0000-000000000003',
  'Orlik — ul. Żonkilowa',
  'ul. Żonkilowa 34, 60-175 Poznań',
  52.42560, 16.84810,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', NULL,
  'Orlik na os. Kwiatowe.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', 'Piątkowo', '60-175', true, 'good'
),

-- 4. Orlik MDK nr 1 / Dębina
(
  'ab000004-0000-0000-0000-000000000004',
  'Orlik — MDK nr 1 Dębina',
  'ul. Droga Dębińska 21, 61-555 Poznań',
  52.40310, 17.00420,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'MDK nr 1 Poznań',
  'Orlik przy Młodzieżowym Domu Kultury nr 1 na Dębinie.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Nowe Miasto', '61-555', true, 'good'
),

-- 5. Orlik SP 34 / Śmiałe
(
  'ab000005-0000-0000-0000-000000000005',
  'Orlik — SP nr 34 os. Śmiałe',
  'os. Bolesława Śmiałego 107, 60-682 Poznań',
  52.41590, 16.96230,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 34',
  'Orlik przy Szkole Podstawowej nr 34 na os. Śmiałe.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Rataje', '60-682', true, 'good'
),

-- 6. Orlik SP 17 / Piątkowo
(
  'ab000006-0000-0000-0000-000000000006',
  'Orlik — SP nr 17 os. Chrobrego',
  'os. Bolesława Chrobrego 105, 60-681 Poznań',
  52.44810, 16.92530,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 17',
  'Orlik przy SP nr 17 na Piątkowie.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Piątkowo', '60-681', true, 'good'
),

-- 7. Orlik SP 51 / os. Lecha
(
  'ab000007-0000-0000-0000-000000000007',
  'Orlik — SP nr 51 os. Lecha',
  'os. Lecha 37, 61-294 Poznań',
  52.43300, 17.04320,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 51',
  'Orlik przy SP nr 51 na os. Lecha.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Nowe Miasto', '61-294', true, 'good'
),

-- 8. Orlik SP 6 / os. Rusa
(
  'ab000008-0000-0000-0000-000000000008',
  'Orlik — SP nr 6 os. Rusa',
  'os. Rusa 43, 61-245 Poznań',
  52.43950, 16.98850,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 6',
  'Orlik przy SP nr 6 na os. Rusa.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Nowe Miasto', '61-245', true, 'good'
),

-- 9. Orlik Piastowskie (POSiR) — komercyjny, czynny 7–22
(
  'ab000009-0000-0000-0000-000000000009',
  'Orlik POSiR — os. Piastowskie',
  'os. Piastowskie 106A, 61-164 Poznań',
  52.39600, 16.97950,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 871 06 42',
  'https://posir.poznan.pl/obiekty/rataje/boiska-orlik',
  'manual', 'POSiR Poznań',
  'Orlik zarządzany przez POSiR. Sztuczna trawa + wielofunkcyjne. Czynny codziennie 7–22.',
  'Mo-Su 07:00-22:00',
  false, true, false, true,
  2, 'orlik', 'public', 'Nowe Miasto', '61-164', true, 'good'
),

-- 10. Orlik V LO / Zmartwychwstańców
(
  'ab000010-0000-0000-0000-000000000010',
  'Orlik — V LO ul. Zmartwychwstańców',
  'ul. Zmartwychwstańców 10, 61-063 Poznań',
  52.40680, 16.96810,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'V LO Poznań',
  'Orlik przy V Liceum Ogólnokształcącym.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Rataje', '61-063', true, 'good'
),

-- 11. Orlik ZSB / Grunwaldzka
(
  'ab000011-0000-0000-0000-000000000011',
  'Orlik — ZSB ul. Grunwaldzka',
  'ul. Grunwaldzka 154, 60-309 Poznań',
  52.40950, 16.90030,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'Zespół Szkół Budowlanych',
  'Orlik przy Zespole Szkół Budowlanych na Grunwaldzie.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Grunwald', '60-309', true, 'good'
),

-- 12. Orlik SP 33 / Wyspiańskiego
(
  'ab000012-0000-0000-0000-000000000012',
  'Orlik — SP nr 33 ul. Wyspiańskiego',
  'ul. Stanisława Wyspiańskiego 27, 60-751 Poznań',
  52.41270, 16.92080,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 33 / XXXIII LO',
  'Orlik przy SP nr 33 i XXXIII LO.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Grunwald', '60-751', true, 'good'
),

-- 13. Orlik Hetmańska (SP 78)
(
  'ab000013-0000-0000-0000-000000000013',
  'Orlik — SP nr 78 ul. Hetmańska',
  'ul. Hetmańska 54, 60-252 Poznań',
  52.39590, 16.87380,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 78',
  'Orlik przy SP nr 78. Nawierzchnia syntetyczna, brak oświetlenia.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', 'Grunwald', '60-252', true, 'fair'
),

-- ── SWARZĘDZ (3 obiekty) ─────────────────────────────────────

-- 14. Orlik Swarzędz — os. Mielżyńskiego (SP 5)
(
  'ab000014-0000-0000-0000-000000000014',
  'Orlik — SP nr 5 os. Mielżyńskiego Swarzędz',
  'os. Mielżyńskiego 3a, 62-020 Swarzędz',
  52.41270, 17.08260,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, 'https://swarzedz.pl/index.php?id=311', 'manual', 'SP nr 5 Swarzędz',
  'Orlik przy SP nr 5 im. prof. A. Wodziczki. Otwarty 2009.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '62-020', true, 'good'
),

-- 15. Orlik Swarzędz — os. Raczyńskiego
(
  'ab000015-0000-0000-0000-000000000015',
  'Orlik — os. Raczyńskiego Swarzędz',
  'os. Edwarda Raczyńskiego, 62-020 Swarzędz',
  52.40980, 17.07910,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, 'https://swarzedz.pl/index.php?id=311', 'manual', 'Gmina Swarzędz',
  'Drugi Orlik gminy Swarzędz, otwarty ok. 2010.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-020', true, 'good'
),

-- 16. Orlik Bogucin (gm. Swarzędz)
(
  'ab000016-0000-0000-0000-000000000016',
  'Orlik — Bogucin ul. Wrzosowa',
  'ul. Wrzosowa, Bogucin, 62-020 Swarzędz',
  52.43580, 17.10540,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'Gmina Swarzędz',
  'Trzeci Orlik gminy Swarzędz w sołectwie Bogucin, otwarty 2011.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-020', true, 'good'
),

-- ── POWIAT — pozostałe gminy ─────────────────────────────────

-- 17. Mosina
(
  'ab000017-0000-0000-0000-000000000017',
  'Orlik — ZS Mosina ul. Topolowa',
  'ul. Topolowa 2, 62-050 Mosina',
  52.23870, 16.84880,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, 'https://osirmosina.pl', 'manual', 'ZS im. Adama Wodziczki / OSiR Mosina',
  'Orlik przy Zespole Szkół w Mosinie. Modernizacja 2024.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '62-050', true, 'good'
),

-- 18. Luboń
(
  'ab000018-0000-0000-0000-000000000018',
  'Orlik — SP nr 4 Luboń ul. Dojazdowa',
  'ul. Dojazdowa 20, 62-030 Luboń',
  52.34190, 16.87020,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'SP nr 4 Luboń',
  'Orlik przy SP nr 4 w Luboniu. Sztuczna trawa, oświetlenie.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '62-030', true, 'good'
),

-- 19. Murowana Goślina (Raduszyn)
(
  'ab000019-0000-0000-0000-000000000019',
  'Orlik — Raduszyn ul. Mściszewska',
  'ul. Mściszewska, Raduszyn, 62-095 Murowana Goślina',
  52.57320, 17.00620,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 513 467 684',
  NULL, 'manual', 'MG Ośrodek Kultury i Rekreacji',
  'Orlik w Raduszynie zarządzany przez Ośrodek Kultury i Rekreacji Murowanej Gośliny.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-095', true, 'good'
),

-- 20. Tarnowo Podgórne — ul. Ogrodowa
(
  'ab000020-0000-0000-0000-000000000020',
  'Orlik — OSiR Tarnowo Podgórne ul. Ogrodowa',
  'ul. Ogrodowa 20, 62-080 Tarnowo Podgórne',
  52.46260, 16.68430,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 816 60 86',
  NULL, 'manual', 'OSiR Tarnowo Podgórne',
  'Orlik przy OSiR w Tarnowie Podgórnym.',
  'Mo-Fr 07:00-22:00; Sa-Su 10:00-18:00',
  false, false, false, true,
  2, 'orlik', 'public', NULL, '62-080', true, 'good'
),

-- 21. Tarnowo Podgórne — Baranowo
(
  'ab000021-0000-0000-0000-000000000021',
  'Orlik — Baranowo (gm. Tarnowo Podgórne)',
  'ul. Szkolna, Baranowo, 62-081 Tarnowo Podgórne',
  52.43940, 16.71260,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'Gmina Tarnowo Podgórne',
  'Orlik w sołectwie Baranowo.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-081', true, 'good'
),

-- 22. Czerwonak (Koziegłowy)
(
  'ab000022-0000-0000-0000-000000000022',
  'Orlik — AKWEN Koziegłowy ul. Wojciecha',
  'ul. Świętego Wojciecha 48, 62-004 Czerwonak',
  52.47410, 16.97840,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 812 14 04',
  'https://czerwonak.pl/pl/turysta/obiekty-sportowe/kompleks-sportowy-orlik-2012-w-czerwonaku/783',
  'manual', 'CRKF AKWEN Czerwonak',
  'Orlik przy centrum sportowym AKWEN w Koziegłowach.',
  'Mo-Fr 10:00-22:00; Sa-Su 10:00-20:00',
  false, true, true, true,
  2, 'orlik', 'public', NULL, '62-004', true, 'good'
),

-- 23. Suchy Las
(
  'ab000023-0000-0000-0000-000000000023',
  'Orlik — GOS Suchy Las',
  'ul. Szkolna 18, 62-002 Suchy Las',
  52.47480, 16.89720,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 892 65 35',
  'https://www.suchylas.pl/dla-mieszkancow/sport-i-rekreacja/boiska/',
  'manual', 'GOS Suchy Las',
  'Orlik zarządzany przez Gminny Ośrodek Sportu Suchy Las.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-002', true, 'good'
),

-- 24. Kostrzyn Wlkp.
(
  'ab000024-0000-0000-0000-000000000024',
  'Orlik — Kostrzyn Wlkp. ul. Powstańców',
  'ul. Powstańców Wielkopolskich 28A, 62-025 Kostrzyn Wlkp.',
  52.39590, 17.22470,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 518 125 073',
  NULL, 'manual', 'GOSiR Kostrzyn Wlkp.',
  'Orlik przy dawnym gimnazjum. Animator sportu: Tomasz Krzyżan.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-025', true, 'good'
),

-- 25. Kórnik (OAZA)
(
  'ab000025-0000-0000-0000-000000000025',
  'Orlik — OAZA Kórnik ul. Leśna',
  'ul. Leśna 6, 62-035 Kórnik',
  52.23710, 17.09110,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 649 88 75',
  'https://oaza.kornik.pl/regulamin/regulamin-korzystania-z-kompleksu-sportowego-orlik-2012-blonie',
  'manual', 'KCRiS OAZA Kórnik',
  'Orlik na Błoniu przy centrum OAZA. Bezpłatny, codziennie 8–22.',
  'Mo-Su 08:00-22:00',
  false, true, true, true,
  2, 'orlik', 'public', NULL, '62-035', true, 'good'
),

-- 26. Buk — Dobieżyn
(
  'ab000026-0000-0000-0000-000000000026',
  'Orlik — SP Dobieżyn (gm. Buk)',
  'ul. Powstańców Wlkp. 3, Dobieżyn, 64-320 Buk',
  52.36170, 16.52840,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 814 91 40',
  'https://osir-buk.pl', 'manual', 'OSiR Buk',
  'Orlik przy SP w Dobieżynie, zarządzany przez OSiR Buk.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '64-320', true, 'good'
),

-- 27. Pobiedziska
(
  'ab000027-0000-0000-0000-000000000027',
  'Orlik — OSiR Pobiedziska ul. Kiszkowska',
  'ul. Kiszkowska 7, 62-010 Pobiedziska',
  52.48170, 17.29160,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 501 379 815',
  'https://osir.pobiedziska.pl/cms/279', 'manual', 'OSiR Pobiedziska',
  'Orlik przy OSiR Pobiedziska.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-010', true, 'good'
),

-- 28. Puszczykowo — Nowe Osiedle
(
  'ab000028-0000-0000-0000-000000000028',
  'Orlik — Puszczykowo Nowe Osiedle',
  'ul. Nowe Osiedle, 62-040 Puszczykowo',
  52.29860, 16.85630,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'Miasto Puszczykowo',
  'Orlik na Nowym Osiedlu w Puszczykowie.',
  'Mo-Fr 16:00-22:00; Sa-Su 12:00-20:00',
  false, false, false, true,
  2, 'orlik', 'public', NULL, '62-040', true, 'good'
),

-- 29. Puszczykowo — LO ul. Libelta
(
  'ab000029-0000-0000-0000-000000000029',
  'Orlik — LO Puszczykowo ul. Libelta',
  'ul. Karola Libelta 1, 62-040 Puszczykowo',
  52.29510, 16.85790,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  NULL, NULL, 'manual', 'LO Puszczykowo',
  'Orlik przy liceum. Sztuczna trawa 56×28 m.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '62-040', true, 'good'
),

-- 30. Dopiewo — Skórzewo
(
  'ab000030-0000-0000-0000-000000000030',
  'Orlik — SP Skórzewo ul. Kozierowskiego',
  'ul. ks. S. Kozierowskiego 1, Skórzewo, 62-070 Dopiewo',
  52.39290, 16.81560,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 814 82 62',
  'https://gosir.dopiewo.pl/orlik-2012-skorzewo', 'manual', 'GOSiR Dopiewo',
  'Orlik przy SP Skórzewo. Sztuczna trawa 60×30 m + poliuretan 30×18 m.',
  NULL, false, false, false, true,
  2, 'orlik', 'school', NULL, '62-070', true, 'good'
),

-- 31. Dopiewo — centrum
(
  'ab000031-0000-0000-0000-000000000031',
  'Orlik — GOSiR Dopiewo ul. Polna',
  'ul. Polna 1a, 62-070 Dopiewo',
  52.36790, 16.73470,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 814 82 62',
  NULL, 'manual', 'GOSiR Dopiewo',
  'Orlik zarządzany przez GOSiR Dopiewo.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-070', true, 'good'
),

-- 32. Kleszczewo — centrum
(
  'ab000032-0000-0000-0000-000000000032',
  'Orlik — GOKiS Kleszczewo ul. Poznańska',
  'ul. Poznańska 2, 63-005 Kleszczewo',
  52.33240, 17.14560,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 817 64 51',
  'https://gokis.kleszczewo.pl/boiska-orlik-w-kleszczewie-i-tulcach.html',
  'manual', 'GOKiS Kleszczewo',
  'Orlik przy GOKiS Kleszczewo.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '63-005', true, 'good'
),

-- 33. Kleszczewo — Tulce
(
  'ab000033-0000-0000-0000-000000000033',
  'Orlik — Tulce (gm. Kleszczewo)',
  'ul. Szkolna 1, 63-005 Tulce',
  52.34880, 17.11670,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 817 64 51',
  'https://gokis.kleszczewo.pl/boiska-orlik-w-kleszczewie-i-tulcach.html',
  'manual', 'GOKiS Kleszczewo',
  'Orlik w Tulcach zarządzany przez GOKiS Kleszczewo.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '63-005', true, 'good'
),

-- 34. Stęszew
(
  'ab000034-0000-0000-0000-000000000034',
  'Orlik — Stęszew ul. Trzebawska',
  'ul. Trzebawska, 62-060 Stęszew',
  52.26090, 16.69810,
  ARRAY['piłka nożna', 'koszykówka', 'siatkówka'], true, 'artificial', false,
  '+48 61 819 71 20',
  NULL, 'manual', 'UMiG Stęszew',
  'Orlik w Stęszewie zarządzany przez Urząd MiG.',
  NULL, false, false, false, true,
  2, 'orlik', 'public', NULL, '62-060', true, 'good'
);


-- ─────────────────────────────────────────────────────────────────────────
-- seed-test-users.sql
-- ─────────────────────────────────────────────────────────────────────────
-- seed-test-users.sql
-- Quick way to create test accounts straight from the Supabase SQL editor.
-- All accounts share the password:  test1234
-- Emails:  test1@example.com … test10@example.com
--
-- ── How to use ──────────────────────────────────────────────────────────────
--   Supabase dashboard → SQL Editor → paste this whole file → Run.
--   Then log in with e.g. test1@example.com / test1234.
--
-- Safe to re-run: accounts that already exist are skipped.
-- The handle_new_user() trigger auto-creates the matching `profiles` row; we
-- also set the avatar afterwards so test players show a photo.
--
-- NOTE: this writes directly into auth.users — that's fine for a test project.
-- If your GoTrue version complains about a NULL token column, use the Node
-- script instead: frontend/scripts/seed-test-users.mjs (uses the official API).

do $$
declare
  rec   record;
  v_id  uuid;
begin
  for rec in
    select * from (values
      ('test1@example.com',  'Jakub Kowalski',      'https://randomuser.me/api/portraits/men/32.jpg'),
      ('test2@example.com',  'Mateusz Nowak',       'https://randomuser.me/api/portraits/men/45.jpg'),
      ('test3@example.com',  'Piotr Wiśniewski',    'https://randomuser.me/api/portraits/men/12.jpg'),
      ('test4@example.com',  'Kacper Wójcik',       'https://randomuser.me/api/portraits/men/76.jpg'),
      ('test5@example.com',  'Michał Kamiński',     'https://randomuser.me/api/portraits/men/8.jpg'),
      ('test6@example.com',  'Zuzanna Lewandowska', 'https://randomuser.me/api/portraits/women/44.jpg'),
      ('test7@example.com',  'Julia Zielińska',     'https://randomuser.me/api/portraits/women/68.jpg'),
      ('test8@example.com',  'Maja Szymańska',      'https://randomuser.me/api/portraits/women/21.jpg'),
      ('test9@example.com',  'Aleksandra Woźniak',  'https://randomuser.me/api/portraits/women/33.jpg'),
      ('test10@example.com', 'Natalia Dąbrowska',   'https://randomuser.me/api/portraits/women/57.jpg')
    ) as t(email, name, avatar)
  loop
    -- Skip if the account already exists.
    if exists (select 1 from auth.users where email = rec.email) then
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      rec.email, extensions.crypt('test1234', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', rec.name, 'avatar_url', rec.avatar),
      '', '', '', ''
    );

    -- Email identity (so password login behaves like a dashboard-created user).
    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    -- Trigger already inserted the profile; make sure name + avatar are set.
    update profiles
       set display_name = rec.name,
           avatar_url   = rec.avatar,
           email        = rec.email
     where id = v_id;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- Konta organizatorów (tylko baza deweloperska)
-- ─────────────────────────────────────────────────────────────────────────
-- seed_test_data.sql wymaga tych kont w auth.users. Na świeżym projekcie nie
-- ma jeszcze Google OAuth, więc zakładamy je hasłem — tym samym co konta
-- testowe (test1234). Później można się na nie zalogować także przez Google.
--
-- NIE uruchamiaj tego na produkcji: tam konta powstają przez prawdziwe logowanie.

do $$
declare
  rec  record;
  v_id uuid;
begin
  for rec in
    select * from (values
      ('franciszekpudelko@gmail.com', 'Franciszek'),
      ('franekks@gmail.com',          'Franek'),
      ('j4n.brz0@gmail.com',          'Jan')
    ) as t(email, name)
  loop
    if exists (select 1 from auth.users where email = rec.email) then
      continue;
    end if;

    v_id := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      rec.email, extensions.crypt('test1234', extensions.gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', rec.name),
      '', '', '', ''
    );

    insert into auth.identities (
      provider_id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      v_id::text, v_id,
      jsonb_build_object('sub', v_id::text, 'email', rec.email, 'email_verified', true),
      'email', now(), now(), now()
    );

    update profiles set display_name = rec.name, email = rec.email where id = v_id;
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────────────────
-- seed_test_data.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — dane testowe
-- ============================================================
-- To NIE jest migracja (nie numerowana, nie uruchamia się automatycznie).
-- Wklej całość w Supabase → SQL Editor i uruchom ręcznie.
--
-- Bezpieczne do wielokrotnego uruchamiania: na start czyści poprzednie dane
-- testowe (rozpoznawane po opisie zaczynającym się od "[TEST]" — usunięcie
-- wydarzenia kasuje też jego uczestników przez ON DELETE CASCADE), a potem
-- tworzy je od nowa. Tytuły wyglądają jak prawdziwe wydarzenia; to, co warto
-- sprawdzić w danym wydarzeniu, jest opisane w jego opisie.
--
-- WYMAGANIA — te konta muszą już istnieć w auth.users (wystarczy, że raz się
-- zalogowały do apki — e-mail/hasło lub Google):
--   Organizatorzy: franciszekpudelko@gmail.com, franekks@gmail.com,
--                  j4n.brz0@gmail.com
--   Uczestnicy:    test1@example.com … test10@example.com
--
-- Wszystkie wydarzenia mają datę w ciągu najbliższych 7 dni od dziś.
--
-- 25 wydarzeń. 1–20 to podstawowe kombinacje ustawień, 21–25 dotyczą nowszych
-- przepływów: oferty zwolnionego miejsca dla rezerwy (21–23) oraz propozycji
-- składów od uczestników (24–25).
-- ============================================================

-- Matches both the current marker (description) and the older format from
-- an earlier version of this script (title), so stale rows never pile up.
DELETE FROM events WHERE title LIKE '[TEST]%' OR description LIKE '[TEST]%';

DO $$
DECLARE
  org1 UUID := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');
  org2 UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  org3 UUID := (SELECT id FROM auth.users WHERE email = 'j4n.brz0@gmail.com');
  t1  UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  t2  UUID := (SELECT id FROM auth.users WHERE email = 'test2@example.com');
  t3  UUID := (SELECT id FROM auth.users WHERE email = 'test3@example.com');
  t4  UUID := (SELECT id FROM auth.users WHERE email = 'test4@example.com');
  t5  UUID := (SELECT id FROM auth.users WHERE email = 'test5@example.com');
  t6  UUID := (SELECT id FROM auth.users WHERE email = 'test6@example.com');
  t7  UUID := (SELECT id FROM auth.users WHERE email = 'test7@example.com');
  t8  UUID := (SELECT id FROM auth.users WHERE email = 'test8@example.com');
  t9  UUID := (SELECT id FROM auth.users WHERE email = 'test9@example.com');
  t10 UUID := (SELECT id FROM auth.users WHERE email = 'test10@example.com');
  org1_name TEXT;
  org2_name TEXT;
  org3_name TEXT;
  t1_name TEXT;
  t2_name TEXT;
  t3_name TEXT;
  t4_name TEXT;
  t5_name TEXT;
  t6_name TEXT;
  t7_name TEXT;
  t8_name TEXT;
  t9_name TEXT;
  t10_name TEXT;
  eid UUID; -- scratch var: id of the event currently being built
  prop UUID; -- scratch var: id of the team proposal currently being built
  pa UUID; pb UUID; pc UUID; pd UUID; -- participant ids, for proposal picks
BEGIN
  IF org1 IS NULL OR org2 IS NULL OR org3 IS NULL THEN
    RAISE EXCEPTION 'Brakuje jednego z kont organizatora w auth.users — sprawdź e-maile (franciszekpudelko@gmail.com / franekks@gmail.com / j4n.brz0@gmail.com).';
  END IF;
  IF t1 IS NULL OR t2 IS NULL OR t3 IS NULL OR t4 IS NULL OR t5 IS NULL
     OR t6 IS NULL OR t7 IS NULL OR t8 IS NULL OR t9 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brakuje jednego z kont test1..test10@example.com w auth.users.';
  END IF;

  -- Real display names from profiles (set by seed-test-users.sql for the
  -- test accounts) so seeded participants look like real players, not
  -- placeholders. Falls back to a short label if a profile has no name yet.
  org1_name := COALESCE((SELECT display_name FROM profiles WHERE id = org1), 'Franciszek');
  org2_name := COALESCE((SELECT display_name FROM profiles WHERE id = org2), 'Franek');
  org3_name := COALESCE((SELECT display_name FROM profiles WHERE id = org3), 'Jan');
  t1_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t1),  'Test 1');
  t2_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t2),  'Test 2');
  t3_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t3),  'Test 3');
  t4_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t4),  'Test 4');
  t5_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t5),  'Test 5');
  t6_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t6),  'Test 6');
  t7_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t7),  'Test 7');
  t8_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t8),  'Test 8');
  t9_name  := COALESCE((SELECT display_name FROM profiles WHERE id = t9),  'Test 9');
  t10_name := COALESCE((SELECT display_name FROM profiles WHERE id = t10), 'Test 10');

  -- ========================================================
  -- 1. Piłka nożna na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '18:00', 10, 'public',
    'Piłka nożna na Rataje',
    '[TEST] Zwykłe dołączanie i wypisywanie się, bez płatności i dodatkowych opcji. 4/10 zajętych miejsc.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

  -- ========================================================
  -- 2. Wtorkowa gra na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       goalkeepers_enabled, max_goalkeepers)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 2, '19:00', 12, 'public',
    'Wtorkowa gra na Malcie',
    '[TEST] Rozróżnianie bramkarz/zawodnik, limit 2 bramkarzy — trzeci chętny (Test 5) powinien wylądować na rezerwie.',
    true, 2)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper, is_reserve, status) VALUES
    (eid, org2, org2_name, false, false, 'potwierdzony'),
    (eid, t1, t1_name, true, false, 'potwierdzony'),
    (eid, t2, t2_name, true, false, 'potwierdzony'),
    (eid, t5, t5_name, true, true, 'potwierdzony'),
    (eid, t3, t3_name, false, false, 'potwierdzony'),
    (eid, t4, t4_name, false, false, 'potwierdzony');

  -- ========================================================
  -- 3. Futsal w hali OSiR
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       goalkeepers_enabled, max_goalkeepers)
  VALUES (org3, org3_name, 'futsal', 'Hala OSiR', CURRENT_DATE + 3, '20:00', 8, 'public',
    'Futsal w hali OSiR',
    '[TEST] Niestandardowy, niski limit bramkarzy (1) — drugi chętny bramkarz (Test 7) powinien wylądować na rezerwie.',
    true, 1)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper, is_reserve, status) VALUES
    (eid, org3, org3_name, false, false, 'potwierdzony'),
    (eid, t6, t6_name, true, false, 'potwierdzony'),
    (eid, t7, t7_name, true, true, 'potwierdzony');

  -- ========================================================
  -- 4. Sparing na Orliku Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_approval)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '20:00', 10, 'public',
    'Sparing na Orliku Rataje',
    '[TEST] Wymaga akceptacji organizatora — sprawdź panel "Prośby o dołączenie" (akceptuj/odrzuć). Trzy osoby czekają.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, pending_approval) VALUES
    (eid, org1, org1_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'zaproszony', true),
    (eid, t3, t3_name, 'zaproszony', true),
    (eid, t4, t4_name, 'zaproszony', true);

  -- ========================================================
  -- 5. Piątkowa kopanka na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_approval)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 2, '17:00', 10, 'public',
    'Piątkowa kopanka na Malcie',
    '[TEST] Wymaga akceptacji, ale nikt jeszcze nie poprosił o dołączenie — sekcja "Prośby o dołączenie" powinna pokazać pusty stan, a nie zniknąć całkiem.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org2, org2_name, 'potwierdzony'),
    (eid, t5, t5_name, 'potwierdzony');

  -- ========================================================
  -- 6. Mecz na Junikowie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 4, '18:30', 10, 'public',
    'Mecz na Junikowie',
    '[TEST] Płatne 20 zł, akceptowany tylko BLIK — sprawdź, czy numer BLIK jest widoczny w nagłówku wydarzenia (nie tylko w dialogu zapisu).',
    2000, ARRAY['blik']::text[], '500 600 700')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_paid) VALUES
    (eid, org3, org3_name, 'potwierdzony', NULL, true),
    (eid, t1, t1_name, 'potwierdzony', 'blik', true),
    (eid, t2, t2_name, 'potwierdzony', 'blik', false);

  -- ========================================================
  -- 7. Gra na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods,
                       accepted_sports_cards, sports_card_discount_grosz)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 3, '19:00', 10, 'public',
    'Gra na Rataje',
    '[TEST] Płatne 30 zł, gotówka. Test 3 ma kartę Multisport → płaci 20 zł zamiast 30 zł (cena przekreślona + nowa). Test 4 bez karty płaci pełną cenę.',
    3000, ARRAY['gotowka']::text[], ARRAY['multisport']::text[], 1000)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org1, org1_name, 'potwierdzony', NULL, false, NULL, true),
    (eid, t3, t3_name, 'potwierdzony', 'gotowka', true, 'multisport', false),
    (eid, t4, t4_name, 'potwierdzony', 'gotowka', false, NULL, false);

  -- ========================================================
  -- 8. Sobotni mecz na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone,
                       accepted_sports_cards, sports_card_discount_grosz, sports_card_other_name)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '18:00', 10, 'public',
    'Sobotni mecz na Malcie',
    '[TEST] Karta sportowa daje zniżkę, ale bez podanej kwoty — gracz z kartą powinien zobaczyć "zapytaj organizatora o szczegóły" zamiast wyliczonej ceny. Zaakceptowana też "Inna karta" nazwana "OK System".',
    2500, ARRAY['blik','gotowka']::text[], '600 111 222',
    ARRAY['multisport','fitprofit','inne']::text[], NULL, 'OK System')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org2, org2_name, 'potwierdzony', NULL, false, NULL, true),
    (eid, t5, t5_name, 'potwierdzony', 'blik', true, 'inne', false),
    (eid, t6, t6_name, 'potwierdzony', 'gotowka', true, 'fitprofit', false);

  -- ========================================================
  -- 9. Wieczorna gra na Junikowie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 6, '17:30', 10, 'public',
    'Wieczorna gra na Junikowie',
    '[TEST] Płatne 15 zł, zaakceptowane naraz BLIK, gotówka i inne — sprawdź wybór metody przy zapisie i wyświetlanie przy każdym uczestniku.',
    1500, ARRAY['blik','gotowka','inne']::text[], '700 222 333')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_paid) VALUES
    (eid, org3, org3_name, 'potwierdzony', NULL, true),
    (eid, t7, t7_name, 'potwierdzony', 'blik', true),
    (eid, t8, t8_name, 'potwierdzony', 'gotowka', false),
    (eid, t9, t9_name, 'potwierdzony', 'inne', false);

  -- ========================================================
  -- 10. Poniedziałkowa piłka na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '18:00', 10, 'public',
    'Poniedziałkowa piłka na Rataje',
    '[TEST] Test 2 i Test 3 tylko obserwują mecz (RSVP "Może") — nie zajmują miejsca. Sprawdź osobną sekcję "Obserwujesz" w Moje mecze i na stronie głównej.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, rsvp, is_reserve) VALUES
    (eid, org1, org1_name, 'potwierdzony', 'yes', false),
    (eid, t1, t1_name, 'potwierdzony', 'yes', false),
    (eid, t2, t2_name, 'potwierdzony', 'maybe', true),
    (eid, t3, t3_name, 'potwierdzony', 'maybe', true);

  -- ========================================================
  -- 11. Szóstki na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 1, '19:30', 6, 'public',
    'Szóstki na Malcie',
    '[TEST] Komplet (6/6) plus trzy osoby na liście rezerwowej — sprawdź widok "Komplet — zapisz się na rezerwę" oraz listę rezerwową (widoczną tylko dla organizatora).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, org2, org2_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'potwierdzony', false),
    (eid, t3, t3_name, 'potwierdzony', false),
    (eid, t4, t4_name, 'potwierdzony', false),
    (eid, t5, t5_name, 'potwierdzony', false),
    (eid, t6, t6_name, 'potwierdzony', true),
    (eid, t7, t7_name, 'potwierdzony', true),
    (eid, t8, t8_name, 'potwierdzony', true);

  -- ========================================================
  -- 12. Ekipa na Junikowie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 3, '18:00', 10, 'public',
    'Ekipa na Junikowie',
    '[TEST] Dwóch graczy dopisanych ręcznie przez organizatora, bez konta — w tym jeden jako bramkarz. Sprawdź odznakę "gość" i podpis "dodał(a): Jan".',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, is_goalkeeper, status) VALUES
    (eid, org3, org3_name, false, NULL, false, 'potwierdzony'),
    (eid, t1, t1_name, false, NULL, false, 'potwierdzony'),
    (eid, NULL, 'Kolega Jana', true, org3, false, 'potwierdzony'),
    (eid, NULL, 'Gość Bramkarz', true, org3, true, 'potwierdzony');

  -- ========================================================
  -- 13. Czwartkowa gra na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, track_attendance)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 4, '19:00', 10, 'public',
    'Czwartkowa gra na Rataje',
    '[TEST] Śledzenie obecności włączone, czterech graczy ma różne statusy (zaproszony/potwierdzony/odrzucił/brak odpowiedzi). Sprawdź kartę "Potwierdzenia" — jawny wybór z listy zamiast klik-cykl.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t1, t1_name, 'zaproszony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'odrzucony'),
    (eid, t4, t4_name, 'brak_odpowiedzi');

  -- ========================================================
  -- 14. Wieczorny mecz na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_sms_confirmation)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '20:00', 10, 'public',
    'Wieczorny mecz na Malcie',
    '[TEST] Potwierdzenie SMS włączone, dwóch graczy ma numer telefonu — przy nich powinien być widoczny przycisk "Wyślij SMS z potwierdzeniem" w karcie Potwierdzenia.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, phone) VALUES
    (eid, org2, org2_name, 'potwierdzony', NULL),
    (eid, t5, t5_name, 'zaproszony', '600111222'),
    (eid, t6, t6_name, 'zaproszony', '600333444');

  -- ========================================================
  -- 15. Derby na Junikowie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode, teams_published)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 2, '18:00', 10, 'public',
    'Derby na Junikowie',
    '[TEST] Drużyny z kapitanami, składy już opublikowane — sprawdź publiczny widok składów, gwiazdkę kapitana i plakietki drużyn A/B.',
    'kapitanowie', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain) VALUES
    (eid, org3, org3_name, 'potwierdzony', 'A', true),
    (eid, t7, t7_name, 'potwierdzony', 'A', false),
    (eid, t8, t8_name, 'potwierdzony', 'B', true),
    (eid, t9, t9_name, 'potwierdzony', 'B', false);

  -- ========================================================
  -- 16. Niedzielny mecz na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode, teams_published)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 6, '19:00', 10, 'public',
    'Niedzielny mecz na Rataje',
    '[TEST] Losowy podział na drużyny, ale jeszcze nieopublikowany — organizator widzi skład "roboczy", gracze go jeszcze nie widzą.',
    'losowe', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, org1, org1_name, 'potwierdzony', 'A'),
    (eid, t10, t10_name, 'potwierdzony', 'B');

  -- ========================================================
  -- 17. Siatkówka w Luboniu
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'siatkówka', 'Hala Lubon', CURRENT_DATE + 3, '17:00', 12, 'public',
    'Siatkówka w Luboniu',
    '[TEST] Inny sport niż piłka nożna — sprawdź, że opcja bramkarza się nie pojawia (nie dotyczy siatkówki).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org2, org2_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony');

  -- ========================================================
  -- 18. Koszykówka na Świerczewie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'koszykówka', 'Boisko Świerczewo', CURRENT_DATE + 4, '18:00', 8, 'private',
    'Koszykówka na Świerczewie',
    '[TEST] Wydarzenie prywatne — nie pojawia się w publicznej liście, dostęp tylko przez link/kod dołączenia (JoinCodePanel).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org3, org3_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

  -- ========================================================
  -- 19. Siatkówka plażowa na Rusałce
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, allow_guest_adds)
  VALUES (org1, org1_name, 'siatkówka plażowa', 'Plaża Rusałka', CURRENT_DATE + 7, '16:00', 12, 'public',
    'Siatkówka plażowa na Rusałce',
    '[TEST] Uczestnicy (nie tylko organizator) mogą dopisywać znajomych bez konta. Zaloguj się na Test 4 i sprawdź pole "Dopisz znajomego bez konta" w widoku uczestnika.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t4, t4_name, 'potwierdzony');

  -- ========================================================
  -- 20. Futsal w hali OSiR (komplet)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'futsal', 'Hala OSiR', CURRENT_DATE + 5, '19:00', 8, 'public',
    'Futsal w hali OSiR',
    '[TEST] 8/8 zajętych — dokładny komplet. Zaloguj się na konto spoza tej listy (np. własne) i sprawdź sticky bar "Komplet — zapisz się na rezerwę".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org3, org3_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony'),
    (eid, t4, t4_name, 'potwierdzony'),
    (eid, t5, t5_name, 'potwierdzony'),
    (eid, t6, t6_name, 'potwierdzony'),
    (eid, t7, t7_name, 'potwierdzony');

  -- ========================================================
  -- 21. Piątkowa gra na Rataje — REZERWA: aktywna oferta
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_hours)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '20:00', 4, 'public',
    'Piątkowa gra na Rataje',
    '[TEST] Zwolniło się miejsce i czeka na Test 5 (aktywna oferta, okno 3h). Zaloguj się na test5@example.com — powinieneś zobaczyć zielony baner „Zwolniło się miejsce" z „Wchodzę" / „Odpuszczam". Organizator widzi przy nim „czeka na decyzję".',
    3)
  RETURNING id INTO eid;
  -- 3 w składzie przy limicie 4 → jedno miejsce wolne, zarezerwowane ofertą
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, org1, org1_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'potwierdzony', false);
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve, claim_offered_at)
    VALUES (eid, t5, t5_name, 'potwierdzony', true, now() - interval '20 minutes');
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, t6, t6_name, 'potwierdzony', true);

  -- ========================================================
  -- 22. Sobotni mecz na Junikowie — REZERWA: oferta wygasła
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_hours)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 3, '17:00', 4, 'public',
    'Sobotni mecz na Junikowie',
    '[TEST] Oferta dla Test 7 wygasła (wysłana 5h temu przy oknie 1h). Samo wejście na stronę meczu powinno ją wygasić i przekazać miejsce do Test 8 — odśwież i sprawdź, czy Test 7 ma „przepuścił(a)", a Test 8 „czeka na decyzję".',
    1)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, org3, org3_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'potwierdzony', false);
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve, claim_offered_at)
    VALUES (eid, t7, t7_name, 'potwierdzony', true, now() - interval '5 hours');
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, t8, t8_name, 'potwierdzony', true);

  -- ========================================================
  -- 23. Niedzielna gra na Malcie — REZERWA: ktoś już przepuścił
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_hours)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 4, '18:00', 4, 'public',
    'Niedzielna gra na Malcie',
    '[TEST] Test 9 już odpuścił miejsce (zostaje na liście z etykietą „przepuścił(a)", ale nie blokuje kolejki), oferta poszła do Test 10. Sprawdź, że organizator wciąż może awansować Test 9 ręcznie.',
    6)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve) VALUES
    (eid, org2, org2_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'potwierdzony', false);
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve, claim_passed)
    VALUES (eid, t9, t9_name, 'potwierdzony', true, true);
  INSERT INTO event_participants (event_id, user_id, name, status, is_reserve, claim_offered_at)
    VALUES (eid, t10, t10_name, 'potwierdzony', true, now() - interval '10 minutes');

  -- ========================================================
  -- 24. Czwartkowy mecz na Rataje — PROPOZYCJE SKŁADÓW
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 5, '19:30', 4, 'public',
    'Czwartkowy mecz na Rataje',
    '[TEST] Dwie propozycje składów od uczestników, jedna z 2 głosami, druga z 1. Zaloguj się jako organizator (Franciszek) — powinieneś widzieć „Zatwierdź" przy każdej, ale NIE przycisk „Zaproponuj składy". Jako Test 1 odwrotnie: możesz proponować i głosować, ale nie zatwierdzać.',
    'reczne')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

  SELECT id INTO pa FROM event_participants WHERE event_id = eid AND user_id = org1;
  SELECT id INTO pb FROM event_participants WHERE event_id = eid AND user_id = t1;
  SELECT id INTO pc FROM event_participants WHERE event_id = eid AND user_id = t2;
  SELECT id INTO pd FROM event_participants WHERE event_id = eid AND user_id = t3;

  -- propozycja Test 1: org+t1 vs t2+t3
  INSERT INTO team_proposals (event_id, proposed_by) VALUES (eid, t1) RETURNING id INTO prop;
  INSERT INTO team_proposal_picks (proposal_id, participant_id, team) VALUES
    (prop, pa, 'A'), (prop, pb, 'A'), (prop, pc, 'B'), (prop, pd, 'B');
  INSERT INTO team_proposal_votes (proposal_id, user_id) VALUES (prop, t2), (prop, t3);

  -- propozycja Test 2: org+t2 vs t1+t3
  INSERT INTO team_proposals (event_id, proposed_by) VALUES (eid, t2) RETURNING id INTO prop;
  INSERT INTO team_proposal_picks (proposal_id, participant_id, team) VALUES
    (prop, pa, 'A'), (prop, pc, 'A'), (prop, pb, 'B'), (prop, pd, 'B');
  INSERT INTO team_proposal_votes (proposal_id, user_id) VALUES (prop, t1);

  -- ========================================================
  -- 25. Wtorkowy mecz na Junikowie — PROPOZYCJA ZATWIERDZONA
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode, teams_published)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 6, '18:30', 4, 'public',
    'Wtorkowy mecz na Junikowie',
    '[TEST] Propozycja Test 4 została zatwierdzona i przeniesiona na realne drużyny, składy są opublikowane. Sprawdź, że uczestnik NIE widzi już „Zaproponuj składy" (po publikacji temat zamknięty), a propozycja ma etykietę „zatwierdzona".',
    'reczne', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, org3, org3_name, 'potwierdzony', 'A'),
    (eid, t4, t4_name, 'potwierdzony', 'A'),
    (eid, t5, t5_name, 'potwierdzony', 'B'),
    (eid, t6, t6_name, 'potwierdzony', 'B');

  SELECT id INTO pa FROM event_participants WHERE event_id = eid AND user_id = org3;
  SELECT id INTO pb FROM event_participants WHERE event_id = eid AND user_id = t4;
  SELECT id INTO pc FROM event_participants WHERE event_id = eid AND user_id = t5;
  SELECT id INTO pd FROM event_participants WHERE event_id = eid AND user_id = t6;

  INSERT INTO team_proposals (event_id, proposed_by, status) VALUES (eid, t4, 'accepted')
    RETURNING id INTO prop;
  INSERT INTO team_proposal_picks (proposal_id, participant_id, team) VALUES
    (prop, pa, 'A'), (prop, pb, 'A'), (prop, pc, 'B'), (prop, pd, 'B');
  INSERT INTO team_proposal_votes (proposal_id, user_id) VALUES (prop, t5), (prop, t6);

  RAISE NOTICE 'Gotowe — dodano 25 testowych wydarzeń z uczestnikami.';
END $$;
