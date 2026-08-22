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
--   5. 4 grupy + 11 meczów prywatnych (seed_test_groups.sql)
--   6. 19 wydarzeń dla Jana — wyniki, historia, komentarze (seed_test_jan.sql)
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
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org1, org1_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name);

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
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper, is_reserve) VALUES
    (eid, org2, org2_name, false, false),
    (eid, t1, t1_name, true, false),
    (eid, t2, t2_name, true, false),
    (eid, t5, t5_name, true, true),
    (eid, t3, t3_name, false, false),
    (eid, t4, t4_name, false, false);

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
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper, is_reserve) VALUES
    (eid, org3, org3_name, false, false),
    (eid, t6, t6_name, true, false),
    (eid, t7, t7_name, true, true);

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
  INSERT INTO event_participants (event_id, user_id, name, pending_approval) VALUES
    (eid, org1, org1_name, false),
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, true),
    (eid, t3, t3_name, true),
    (eid, t4, t4_name, true);

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
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org2, org2_name),
    (eid, t5, t5_name);

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
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, org3, org3_name, NULL, true),
    (eid, t1, t1_name, 'blik', true),
    (eid, t2, t2_name, 'blik', false);

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
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org1, org1_name, NULL, false, NULL, true),
    (eid, t3, t3_name, 'gotowka', true, 'multisport', false),
    (eid, t4, t4_name, 'gotowka', false, NULL, false);

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
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org2, org2_name, NULL, false, NULL, true),
    (eid, t5, t5_name, 'blik', true, 'inne', false),
    (eid, t6, t6_name, 'gotowka', true, 'fitprofit', false);

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
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, org3, org3_name, NULL, true),
    (eid, t7, t7_name, 'blik', true),
    (eid, t8, t8_name, 'gotowka', false),
    (eid, t9, t9_name, 'inne', false);

  -- ========================================================
  -- 10. Poniedziałkowa piłka na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '18:00', 10, 'public',
    'Poniedziałkowa piłka na Rataje',
    '[TEST] Test 2 i Test 3 tylko obserwują mecz (RSVP "Może") — nie zajmują miejsca. Sprawdź osobną sekcję "Obserwujesz" w Moje mecze i na stronie głównej.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, rsvp, is_reserve) VALUES
    (eid, org1, org1_name, 'yes', false),
    (eid, t1, t1_name, 'yes', false),
    (eid, t2, t2_name, 'maybe', true),
    (eid, t3, t3_name, 'maybe', true);

  -- ========================================================
  -- 11. Szóstki na Malcie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 1, '19:30', 6, 'public',
    'Szóstki na Malcie',
    '[TEST] Komplet (6/6) plus trzy osoby na liście rezerwowej — sprawdź widok "Komplet — zapisz się na rezerwę" oraz listę rezerwową (widoczną tylko dla organizatora).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, org2, org2_name, false),
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, false),
    (eid, t3, t3_name, false),
    (eid, t4, t4_name, false),
    (eid, t5, t5_name, false),
    (eid, t6, t6_name, true),
    (eid, t7, t7_name, true),
    (eid, t8, t8_name, true);

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
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, is_goalkeeper) VALUES
    (eid, org3, org3_name, false, NULL, false),
    (eid, t1, t1_name, false, NULL, false),
    (eid, NULL, 'Kolega Jana', true, org3, false),
    (eid, NULL, 'Gość Bramkarz', true, org3, true);

  -- ========================================================
  -- 13. Czwartkowa gra na Rataje
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time, max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 4, '19:00', 10, 'public',
    'Czwartkowa gra na Rataje',
    '[TEST] Pięcioosobowy skład bez dodatkowych opcji — punkt odniesienia dla listy graczy.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org1, org1_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name),
    (eid, t4, t4_name);

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
  INSERT INTO event_participants (event_id, user_id, name, phone) VALUES
    (eid, org2, org2_name, NULL),
    (eid, t5, t5_name, '600111222'),
    (eid, t6, t6_name, '600333444');

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
  INSERT INTO event_participants (event_id, user_id, name, team, is_captain) VALUES
    (eid, org3, org3_name, 'A', true),
    (eid, t7, t7_name, 'A', false),
    (eid, t8, t8_name, 'B', true),
    (eid, t9, t9_name, 'B', false);

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
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, org1, org1_name, 'A'),
    (eid, t10, t10_name, 'B');

  -- ========================================================
  -- 17. Siatkówka w Luboniu
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'siatkówka', 'Hala Lubon', CURRENT_DATE + 3, '17:00', 12, 'public',
    'Siatkówka w Luboniu',
    '[TEST] Inny sport niż piłka nożna — sprawdź, że opcja bramkarza się nie pojawia (nie dotyczy siatkówki).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org2, org2_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name);

  -- ========================================================
  -- 18. Koszykówka na Świerczewie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'koszykówka', 'Boisko Świerczewo', CURRENT_DATE + 4, '18:00', 8, 'private',
    'Koszykówka na Świerczewie',
    '[TEST] Wydarzenie prywatne — nie pojawia się w publicznej liście, dostęp tylko przez link/kod dołączenia (JoinCodePanel).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org3, org3_name),
    (eid, t3, t3_name);

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
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org1, org1_name),
    (eid, t4, t4_name);

  -- ========================================================
  -- 20. Futsal w hali OSiR (komplet)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'futsal', 'Hala OSiR', CURRENT_DATE + 5, '19:00', 8, 'public',
    'Futsal w hali OSiR',
    '[TEST] 8/8 zajętych — dokładny komplet. Zaloguj się na konto spoza tej listy (np. własne) i sprawdź sticky bar "Komplet — zapisz się na rezerwę".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org3, org3_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name),
    (eid, t4, t4_name),
    (eid, t5, t5_name),
    (eid, t6, t6_name),
    (eid, t7, t7_name);

  -- ========================================================
  -- 21. Piątkowa gra na Rataje — REZERWA: aktywna oferta
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '20:00', 4, 'public',
    'Piątkowa gra na Rataje',
    '[TEST] Zwolniło się miejsce i czeka na Test 5 (aktywna oferta, okno 3h). Zaloguj się na test5@example.com — powinieneś zobaczyć zielony baner „Zwolniło się miejsce" z „Wchodzę" / „Odpuszczam". Organizator widzi przy nim „czeka na decyzję".',
    180)
  RETURNING id INTO eid;
  -- 3 w składzie przy limicie 4 → jedno miejsce wolne, zarezerwowane ofertą
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, org1, org1_name, false),
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, false);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_offered_at)
    VALUES (eid, t5, t5_name, true, now() - interval '20 minutes');
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, t6, t6_name, true);

  -- ========================================================
  -- 22. Sobotni mecz na Junikowie — REZERWA: oferta wygasła
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 3, '17:00', 4, 'public',
    'Sobotni mecz na Junikowie',
    '[TEST] Oferta dla Test 7 wygasła (wysłana 5h temu przy oknie 1h). Samo wejście na stronę meczu powinno ją wygasić i przekazać miejsce do Test 8 — odśwież i sprawdź, czy Test 7 ma „przepuścił(a)", a Test 8 „czeka na decyzję".',
    60)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, org3, org3_name, false),
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, false);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_offered_at)
    VALUES (eid, t7, t7_name, true, now() - interval '5 hours');
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, t8, t8_name, true);

  -- ========================================================
  -- 23. Niedzielna gra na Malcie — REZERWA: ktoś już przepuścił
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 4, '18:00', 4, 'public',
    'Niedzielna gra na Malcie',
    '[TEST] Test 9 już odpuścił miejsce (zostaje na liście z etykietą „przepuścił(a)", ale nie blokuje kolejki), oferta poszła do Test 10. Sprawdź, że organizator wciąż może awansować Test 9 ręcznie.',
    360)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, org2, org2_name, false),
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, false);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_passed)
    VALUES (eid, t9, t9_name, true, true);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_offered_at)
    VALUES (eid, t10, t10_name, true, now() - interval '10 minutes');

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
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, org1, org1_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name);

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
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, org3, org3_name, 'A'),
    (eid, t4, t4_name, 'A'),
    (eid, t5, t5_name, 'B'),
    (eid, t6, t6_name, 'B');

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


-- ─────────────────────────────────────────────────────────────────────────
-- seed_test_groups.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — dane testowe: GRUPY + mecze prywatne
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
--
-- Bezpieczne do wielokrotnego uruchamiania: na start kasuje poprzedni przebieg
-- (mecze po markerze "[TEST-G]" w opisie, grupy po markerze w opisie grupy),
-- potem tworzy wszystko od nowa.
--
-- Wszystkie mecze są PRYWATNE (visibility = 'private') — nie pojawią się
-- w „Otwarte mecze" ani na liście publicznej. Wchodzi się do nich przez
-- sekcję „Mecze Twoich ekip" na stronie głównej, przez stronę grupy albo
-- przez zaproszenie. O to właśnie chodzi w tym zestawie.
--
-- Tytuły wyglądają jak prawdziwe mecze, żeby dało się ocenić layout kart.
-- Co sprawdzić, jest w opisie każdego meczu.
--
-- WYMAGANIA:
--   • konto franekks@gmail.com musi istnieć w auth.users (zaloguj się raz)
--   • konta test1@example.com … test10@example.com — zakłada je
--     supabase/seed-test-users.sql
--   • migracja 060 (event_player_invites) musi być wgrana, inaczej
--     sekcja zaproszeń nie ma gdzie zapisać danych
--   • migracje 092–095 (uprawnienia, tablica, zaproszenia, statystyki grup)
--     muszą być wgrane, inaczej dwa niżej opisane elementy nie powstaną
--
-- Środowa Liga ma dodatkowo: t1 z pełnymi uprawnieniami współorganizatora
-- (test panelu „Uprawnienia" w Ustawieniach) i trzy wpisy na tablicy, w tym
-- jeden przypięty (test zakładki „Tablica" i licznika nieprzeczytanych).
-- ============================================================

DELETE FROM events WHERE description LIKE '[TEST-G]%';
DELETE FROM groups WHERE description LIKE '[TEST-G]%';

DO $$
DECLARE
  me  UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
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

  me_name TEXT; t1_name TEXT; t2_name TEXT; t3_name TEXT; t4_name TEXT;
  t5_name TEXT; t6_name TEXT; t7_name TEXT; t8_name TEXT; t9_name TEXT; t10_name TEXT;

  g_sroda   UUID;  -- Środowa Liga        — jestem adminem
  g_siatka  UUID;  -- Siatka po pracy     — jestem zwykłym członkiem
  g_kosz    UUID;  -- Kosz na Ratajach    — jestem adminem
  g_obce    UUID;  -- Ekipa z Dębca       — NIE należę

  eid UUID;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do apki i uruchom ponownie.';
  END IF;
  IF t1 IS NULL OR t5 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10@example.com — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;

  me_name  := COALESCE((SELECT display_name FROM profiles WHERE id = me),  'Franek');
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

  -- ==========================================================
  -- GRUPY
  -- ==========================================================
  -- Trigger on_group_created dopisuje twórcę jako admina, więc członków
  -- dokładamy tylko tam, gdzie twórcą jest ktoś inny.

  -- 1. Duża ekipa, ja jako założyciel i admin — 7 osób.
  INSERT INTO groups (name, description, sport, city, created_by)
  VALUES ('Środowa Liga',
          '[TEST-G] Duża ekipa, jesteś adminem. Sprawdź listę członków, zmianę roli i link zaproszenia.',
          'piłka nożna', 'Poznań', me)
  RETURNING id INTO g_sroda;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (g_sroda, t1, 'member'), (g_sroda, t2, 'member'), (g_sroda, t3, 'member'),
    (g_sroda, t4, 'member'), (g_sroda, t5, 'member'), (g_sroda, t6, 'member')
  ON CONFLICT DO NOTHING;

  -- t1 dostaje pełne uprawnienia współorganizatora (migracja 092) — sprawdź
  -- w Ustawieniach → Uprawnienia, czy t1 widnieje jako „Współorganizator"
  -- w Składzie i czy faktycznie może dodawać/usuwać graczy oraz moderować
  -- tablicę zalogowany jako t1@example.com.
  UPDATE group_members
     SET can_manage_members = true, can_create_events = true, can_moderate_wall = true
   WHERE group_id = g_sroda AND user_id = t1;

  -- Tablica: kilka wpisów, jeden przypięty — sprawdź plakietkę „przypięte",
  -- powiadomienie pod dzwonkiem u pozostałych członków i licznik nieprzeczytanych.
  INSERT INTO group_posts (group_id, user_id, user_name, body, pinned_at) VALUES
    (g_sroda, me, me_name, 'Cześć ekipo! W tym tygodniu zmieniamy boisko na Orlik Winogrady — parking od strony ul. Wilczak.', now() - interval '2 hours');
  INSERT INTO group_posts (group_id, user_id, user_name, body) VALUES
    (g_sroda, t2, t2_name, 'Ok, będę 10 minut wcześniej z piłkami.'),
    (g_sroda, t4, t4_name, 'W ten czwartek mnie nie będzie, jadę do rodziny.');

  -- 2. Ekipa założona przez kogoś innego — jestem zwykłym członkiem.
  --    Tu sprawdzasz, czego NIE wolno zwykłemu członkowi.
  INSERT INTO groups (name, description, sport, city, created_by)
  VALUES ('Siatka po pracy',
          '[TEST-G] Grupa cudza, jesteś zwykłym członkiem. Nie powinieneś móc edytować grupy ani usuwać innych. Sprawdź, czy da się z niej wyjść (z oknem potwierdzenia).',
          'siatkówka', 'Poznań', t1)
  RETURNING id INTO g_siatka;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (g_siatka, me, 'member'), (g_siatka, t2, 'member'),
    (g_siatka, t3, 'member'), (g_siatka, t7, 'member')
  ON CONFLICT DO NOTHING;

  -- 3. Mała ekipa, ja adminem — dobra do testu zapraszania (mało osób,
  --    widać całą listę bez przewijania).
  INSERT INTO groups (name, description, sport, city, created_by)
  VALUES ('Kosz na Ratajach',
          '[TEST-G] Mała ekipa, jesteś adminem. Najlepsza do testu „Zaproś z ekipy" — cała lista mieści się na ekranie.',
          'koszykówka', 'Poznań', me)
  RETURNING id INTO g_kosz;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (g_kosz, t8, 'member'), (g_kosz, t9, 'member'), (g_kosz, t10, 'member')
  ON CONFLICT DO NOTHING;

  -- 4. Ekipa, do której NIE należę — kontrola negatywna.
  INSERT INTO groups (name, description, sport, city, created_by)
  VALUES ('Ekipa z Dębca',
          '[TEST-G] Grupa, do której NIE należysz. Jej mecz prywatny NIE MOŻE pojawić się na Twojej stronie głównej.',
          'piłka nożna', 'Poznań', t5)
  RETURNING id INTO g_obce;
  INSERT INTO group_members (group_id, user_id, role) VALUES
    (g_obce, t6, 'member'), (g_obce, t7, 'member'), (g_obce, t8, 'member')
  ON CONFLICT DO NOTHING;

  -- ==========================================================
  -- MECZE — wszystkie prywatne
  -- ==========================================================

  -- ---- 1. Mecz mojej grupy, w którym mnie nie ma ----------------------
  -- To jest główny test sekcji „Mecze Twoich ekip".
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t1, t1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '19:00', 12, 'private', g_sroda,
    'Środowe granie na Ratajach',
    '[TEST-G] Mecz Twojej ekipy „Środowa Liga", w którym Cię nie ma. MUSI pojawić się na stronie głównej w „Mecze Twoich ekip" — mimo że jest prywatny. Po dołączeniu ma stamtąd zniknąć i przejść do „Twoje najbliższe mecze".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name),
    (eid, t4, t4_name);

  -- ---- 2. Mecz mojej grupy, w którym już gram ------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t2, t2_name, 'siatkówka', 'Hala Chwiałka', CURRENT_DATE + 3, '20:00', 12, 'private', g_siatka,
    'Siatkówka we czwartek',
    '[TEST-G] Mecz ekipy „Siatka po pracy", jesteś już zapisany. NIE MOŻE dublować się w „Mecze Twoich ekip" — ma być tylko w „Twoje najbliższe mecze".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t2, t2_name),
    (eid, me, me_name),
    (eid, t3, t3_name),
    (eid, t7, t7_name);

  -- ---- 3. Mecz mojej grupy, który obserwuję --------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t3, t3_name, 'piłka nożna', 'Boisko Golęcin', CURRENT_DATE + 4, '18:30', 10, 'private', g_sroda,
    'Piłka na Golęcinie',
    '[TEST-G] Mecz Twojej ekipy, który OBSERWUJESZ. Ma być w sekcji „Obserwujesz", a nie w „Mecze Twoich ekip" — obserwowanie to już odpowiedź.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, rsvp) VALUES
    (eid, t3, t3_name, 'yes'),
    (eid, me, me_name, 'maybe'),
    (eid, t4, t4_name, 'yes'),
    (eid, t5, t5_name, 'yes');

  -- ---- 4. Mecz grupy, do której NIE należę — kontrola negatywna ------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t5, t5_name, 'piłka nożna', 'Orlik Dębiec', CURRENT_DATE + 2, '21:00', 10, 'private', g_obce,
    'Wtorkowa gra na Dębcu',
    '[TEST-G] Mecz ekipy „Ekipa z Dębca", do której NIE należysz. NIE MOŻE pojawić się na Twojej stronie głównej. Jeśli go tam widzisz — to błąd.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t5, t5_name),
    (eid, t6, t6_name),
    (eid, t7, t7_name);

  -- ---- 5. Komplet, jestem na rezerwie --------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t1, t1_name, 'piłka nożna', 'Hala OSiR Piątkowo', CURRENT_DATE + 5, '19:30', 4, 'private', g_sroda,
    'Halówka w Piątkowie',
    '[TEST-G] Komplet, a Ty jesteś na rezerwie. Nagłówek ma pokazać samo „Komplet" — BEZ „dołącz do rezerwy", bo już jesteś zapisany.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
    (eid, t1, t1_name, false),
    (eid, t2, t2_name, false),
    (eid, t3, t3_name, false),
    (eid, t4, t4_name, false),
    (eid, me, me_name, true);

  -- ---- 6. Komplet, nie ma mnie w ogóle -------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t2, t2_name, 'koszykówka', 'Boisko Rataje', CURRENT_DATE + 3, '17:00', 4, 'private', g_kosz,
    'Kosz w środę po pracy',
    '[TEST-G] Komplet i nie masz z tym meczem nic wspólnego. TU nagłówek MA pokazać „Komplet — dołącz do rezerwy". Porównaj z „Halówka w Piątkowie".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t2, t2_name),
    (eid, t8, t8_name),
    (eid, t9, t9_name),
    (eid, t10, t10_name);

  -- ---- 7. Mój mecz BEZ grupy — do przypięcia -------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (me, me_name, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 6, '18:00', 10, 'private',
    'Piątkowe granie na Winogradach',
    '[TEST-G] Twój mecz BEZ grupy. Wejdź w „Zarządzaj wydarzeniem" → Grupa i przypnij go do „Środowa Liga". Po zapisie ma się pojawić na liście meczów tej grupy. Sprawdź też odpięcie („Bez grupy").')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, me, me_name),
    (eid, t1, t1_name),
    (eid, t8, t8_name);

  -- ---- 8. Cudzy mecz bez grupy — test uprawnień admina ---------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (t9, t9_name, 'piłka nożna', 'Boisko Sołacz', CURRENT_DATE + 4, '20:30', 10, 'private',
    'Czwartkowa gra na Sołaczu',
    '[TEST-G] CUDZY mecz bez grupy — dokładnie sytuacja kumpla, który założył mecze poza grupą. Jako administrator masz widzieć „Zarządzaj wydarzeniem" i móc przypiąć go do grupy. Bez praw admina panel ma być niewidoczny.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t9, t9_name),
    (eid, t10, t10_name);

  -- ---- 9. Mecz, na który jestem zaproszony ---------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t8, t8_name, 'koszykówka', 'Hala Arena', CURRENT_DATE + 5, '18:00', 10, 'private', g_kosz,
    'Kosz w hali Arena',
    '[TEST-G] Masz na ten mecz IMIENNE ZAPROSZENIE. Ma być na samej górze strony głównej w sekcji „Zaproszenia". Sprawdź „Nie tym razem" — po odrzuceniu ma zniknąć i NIE wrócić po odświeżeniu.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t8, t8_name),
    (eid, t9, t9_name);
  INSERT INTO event_player_invites (event_id, user_id, invited_by, group_id)
  VALUES (eid, me, t8, g_kosz)
  ON CONFLICT DO NOTHING;

  -- ---- 10. Mój mecz w grupie — do testu zapraszania -------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (me, me_name, 'koszykówka', 'Boisko Rataje', CURRENT_DATE + 7, '19:00', 10, 'private', g_kosz,
    'Kosz na Ratajach — sobota',
    '[TEST-G] Twój mecz. Kliknij „Zaproś z ekipy": Test 8 jest już zapisany (ma być wyszarzony z podpisem „już zapisany"), Test 9 i Test 10 do zaproszenia. Po wysłaniu wejdź jeszcze raz — mają być podpisani „już zaproszony". Sprawdź też przełączanie między ekipami w liście na górze dialogu.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, me, me_name),
    (eid, t8, t8_name);

  -- ---- 11. Długi tytuł — kontrola layoutu ----------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description, cost_grosz)
  VALUES (t4, t4_name, 'piłka nożna', 'Kompleks Sportowy Politechniki Poznańskiej', CURRENT_DATE + 6, '21:00', 14, 'private', g_sroda,
    'Cotygodniowe granie ekipy ze Środowej Ligi na Politechnice',
    '[TEST-G] Bardzo długi tytuł i długa nazwa obiektu. Karta na stronie głównej i na liście grupy nie ma się rozjeżdżać w bok — tekst ma być ucięty wielokropkiem. Sprawdź na telefonie.',
    2500)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, t4, t4_name),
    (eid, t5, t5_name),
    (eid, t6, t6_name);

  RAISE NOTICE 'Gotowe: 4 grupy, 11 meczów prywatnych. Zaloguj się jako franekks@gmail.com.';
END $$;

-- Podgląd tego, co powstało.
SELECT g.name AS grupa,
       (SELECT count(*) FROM group_members m WHERE m.group_id = g.id) AS czlonkow,
       (SELECT count(*) FROM events e WHERE e.group_id = g.id)        AS meczow,
       g.join_code
FROM groups g
WHERE g.description LIKE '[TEST-G]%'
ORDER BY g.name;


-- ─────────────────────────────────────────────────────────────────────────
-- seed_test_jan.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — dane testowe DLA JANA
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
--
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker "[TEST-J]" w opisie) i tworzy wszystko od nowa.
--
-- CELOWO INNY ZAKRES niż seed_test_data.sql ([TEST]) i seed_test_groups.sql
-- ([TEST-G]). Tamte pokrywają zapisy, płatności, rezerwę, grupy i zaproszenia.
-- Ten obejmuje obszary dotąd nieprzetestowane:
--
--   • wyniki meczów — gole i asysty, profil gracza, statystyki
--   • mecze z PRZESZŁOŚCI — historia, znaczek „rzetelny gracz"
--   • odwołanie i przywrócenie meczu
--   • goście dopisani przez uczestnika (nie przez organizatora)
--   • miejsce spoza katalogu boisk (wpisane ręcznie)
--   • komentarze pod meczem
--   • drużyny z kapitanami — nieopublikowane i opublikowane
--   • obecność i nieobecności
--   • przypadki brzegowe layoutu (brak opisu, długi opis, 18 uczestników)
--
-- WYMAGANIA — konta w auth.users:
--   j4n.brz0@gmail.com (główny organizator tych danych)
--   franekks@gmail.com
--   test1@example.com … test10@example.com  (supabase/seed-test-users.sql)
--
-- PO URUCHOMIENIU zaloguj się jako j4n.brz0@gmail.com i wejdź też na
-- /gracz/<swoje-id> — połowa scenariuszy dotyczy profilu i statystyk.
-- ============================================================

DELETE FROM events WHERE description LIKE '[TEST-J]%';

DO $$
DECLARE
  jan UUID := (SELECT id FROM auth.users WHERE email = 'j4n.brz0@gmail.com');
  fr  UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
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

  jan_name TEXT; fr_name TEXT;
  t1_name TEXT; t2_name TEXT; t3_name TEXT; t4_name TEXT; t5_name TEXT;
  t6_name TEXT; t7_name TEXT; t8_name TEXT; t9_name TEXT; t10_name TEXT;

  eid UUID;
  p_jan UUID; p_t1 UUID; p_t2 UUID; p_t3 UUID;  -- id uczestników pod gole
  i INT;
BEGIN
  IF jan IS NULL THEN
    RAISE EXCEPTION 'Brak konta j4n.brz0@gmail.com w auth.users — zaloguj się raz do apki.';
  END IF;
  IF t1 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10@example.com — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;

  jan_name := COALESCE((SELECT display_name FROM profiles WHERE id = jan), 'Jan');
  fr_name  := COALESCE((SELECT display_name FROM profiles WHERE id = fr),  'Franek');
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

  -- ==========================================================
  -- WYNIKI I STATYSTYKI
  -- ==========================================================

  -- ---- 1. Rozegrany mecz z wynikiem, golami i asystami --------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_results, team_mode, teams_published)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE - 3, '19:00', 10, 'public',
    'Środowa liga — kolejka 7',
    '[TEST-J] Mecz rozegrany, wynik 4:2, gole rozpisane na graczy. Sprawdź: wyświetlanie wyniku na karcie i na stronie meczu, listę strzelców, oraz czy gole doliczyły się do profilu gracza (/gracz/<id> → „Gole"). Jako organizator sprawdź też edycję wyniku.',
    true, 'reczne', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_captain)
    VALUES (eid, jan, jan_name, 'A', true) RETURNING id INTO p_jan;
  INSERT INTO event_participants (event_id, user_id, name, team)
    VALUES (eid, t1, t1_name, 'A') RETURNING id INTO p_t1;
  INSERT INTO event_participants (event_id, user_id, name, team, is_captain)
    VALUES (eid, t2, t2_name, 'B', true) RETURNING id INTO p_t2;
  INSERT INTO event_participants (event_id, user_id, name, team)
    VALUES (eid, t3, t3_name, 'B') RETURNING id INTO p_t3;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, t4, t4_name, 'A'),
    (eid, t5, t5_name, 'B');
  INSERT INTO match_results (event_id, score_a, score_b, recorded_by)
    VALUES (eid, 4, 2, jan);
  INSERT INTO player_goals (event_id, participant_id, goals) VALUES
    (eid, p_jan, 2), (eid, p_t1, 2), (eid, p_t2, 1), (eid, p_t3, 1);

  -- ---- 2. Rozegrany mecz BEZ wpisanego wyniku ------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_results)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE - 1, '20:00', 10, 'public',
    'Poniedziałkowa kopanka',
    '[TEST-J] Mecz już się odbył, ale wynik NIE jest wpisany, choć wydarzenie ma włączone „zapisuj wyniki". Jako organizator powinieneś zobaczyć zachętę do uzupełnienia wyniku. Uczestnik nie powinien widzieć formularza.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t6, t6_name);

  -- ---- 3. Siatkówka z wynikiem — inny sport, inny kształt wyniku -----
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_results)
  VALUES (jan, jan_name, 'siatkówka', 'Hala Chwiałka', CURRENT_DATE - 5, '18:00', 12, 'public',
    'Siatkówka — turniej zakładowy',
    '[TEST-J] Wynik przy siatkówce (3:1). Sprawdź, czy interfejs wyniku nie mówi „bramki" przy sporcie, w którym bramek nie ma.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t7, t7_name),
    (eid, t8, t8_name),
    (eid, t9, t9_name);
  INSERT INTO match_results (event_id, score_a, score_b, recorded_by) VALUES (eid, 3, 1, jan);

  -- ---- 4. Historia — 6 rozegranych meczów Jana ----------------------
  -- Zasila profil gracza i statystyki. Bez tego /gracz/<id> jest pusty.
  FOR i IN 1..6 LOOP
    INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                        max_players, visibility, title, description, track_results)
    VALUES (t1, t1_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE - (7 * i), '19:00', 10, 'public',
      'Czwartkowe granie na Junikowie',
      '[TEST-J] Jeden z sześciu rozegranych meczów budujących historię i statystyki. Wejdź na /gracz/<id-Jana>: „Rozegrane mecze" ma pokazać co najmniej 6, a znaczek „rzetelny gracz" ma się pojawić (≥5 gier, 0 nieobecności).',
      true)
    RETURNING id INTO eid;
    INSERT INTO event_participants (event_id, user_id, name) VALUES
      (eid, t1, t1_name),
      (eid, jan, jan_name),
      (eid, t2, t2_name),
      (eid, t3, t3_name);
    INSERT INTO match_results (event_id, score_a, score_b, recorded_by)
      VALUES (eid, 2 + (i % 3), 1 + (i % 2), t1);
  END LOOP;

  -- ==========================================================
  -- STANY WYDARZENIA
  -- ==========================================================

  -- ---- 5. Mecz ODWOŁANY ---------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, status)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '19:00', 10, 'public',
    'Sparing z Wartą',
    '[TEST-J] Mecz ODWOŁANY. Sprawdź: oznaczenie na karcie i na stronie meczu, brak możliwości dołączenia, oraz czy jako organizator masz „Przywróć mecz". Po przywróceniu zapisy mają znów działać.',
    'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t4, t4_name),
    (eid, t5, t5_name);

  -- ---- 6. Zaczyna się za 2 godziny ----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time, max_players, visibility, title, description)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta',
          CURRENT_DATE, to_char(now() + interval '2 hours', 'HH24:MI'), 10, 'public',
    'Dzisiejsze granie na Malcie',
    '[TEST-J] Mecz zaczyna się DZIŚ za około 2 godziny. Sprawdź formatowanie daty („dziś, 19:30" zamiast pełnej daty) i czy nadal da się dołączyć.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t6, t6_name),
    (eid, t7, t7_name),
    (eid, t8, t8_name);

  -- ---- 7. Termin potwierdzenia ustawiony na 12 h --------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time, max_players, visibility, title, description, confirmation_deadline_h)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 1, '18:00', 10, 'public',
    'Wtorkowy trening',
    '[TEST-J] Termin potwierdzenia ustawiony na 12 h przed meczem. Sześcioosobowy skład.',
    12)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name),
    (eid, t4, t4_name),
    (eid, t5, t5_name);

  -- ==========================================================
  -- SKŁADY, GOŚCIE, MIEJSCE
  -- ==========================================================

  -- ---- 8. Drużyny ustawione, ale NIEOPUBLIKOWANE --------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, team_mode, teams_published)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 3, '20:00', 8, 'public',
    'Piątkowe szóstki',
    '[TEST-J] Składy są USTAWIONE, ale NIEOPUBLIKOWANE. Uczestnik NIE MOŻE ich widzieć — organizator tak, z informacją, że są ukryte. Opublikuj je i sprawdź, czy uczestnikowi się pojawiły. Kapitanowie: Jan (A) i Test 6 (B).',
    'reczne', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_captain) VALUES
    (eid, jan, jan_name, 'A', true),
    (eid, t6, t6_name, 'B', true);
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, t7, t7_name, 'A'),
    (eid, t8, t8_name, 'B'),
    (eid, t9, t9_name, 'A'),
    (eid, t10, t10_name, 'B');

  -- ---- 9. Goście dopisani przez UCZESTNIKA, nie organizatora --------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, allow_guest_adds)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 4, '19:30', 12, 'public',
    'Sobotnia gra na Malcie',
    '[TEST-J] Trzy osoby bez konta, dopisane przez RÓŻNE osoby: dwie przez Test 1, jedna przez Jana. Przy każdej ma być widoczne „(dodany przez …)". Sprawdź, czy Test 1 może usunąć TYLKO swoich gości. Sam też kogoś dopisz.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t1, t1_name);
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by) VALUES
    (eid, NULL, 'Kuba z pracy',   true, t1),
    (eid, NULL, 'Michał',         true, t1),
    (eid, NULL, 'Brat Krzyśka',   true, jan);

  -- ---- 10. Miejsce spoza katalogu boisk ------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      custom_location_name, custom_address, lat, lng)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko przy szkole w Plewiskach', CURRENT_DATE + 5, '17:00', 10, 'public',
    'Granie w Plewiskach',
    '[TEST-J] Miejsce wpisane RĘCZNIE, nie wybrane z katalogu boisk. Sprawdź, czy nazwa i adres wyświetlają się poprawnie, czy mapa pokazuje właściwy punkt i czy link do nawigacji działa. Nie powinno być odnośnika do strony obiektu, bo obiektu w bazie nie ma.',
    'Boisko przy szkole w Plewiskach', 'ul. Szkolna 64, 62-064 Plewiska', 52.36530, 16.80240)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name);

  -- ==========================================================
  -- KOMENTARZE I PRZYPADKI BRZEGOWE
  -- ==========================================================

  -- ---- 11. Mecz z komentarzami ---------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '18:30', 10, 'public',
    'Czwartkowa gra na Ratajach',
    '[TEST-J] Pod meczem jest pięć komentarzy, w tym jeden bardzo długi i jeden usunięty. Sprawdź: kolejność, zawijanie długiego tekstu, czy usunięty jest niewidoczny, i czy możesz skasować tylko własny.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES
    (eid, jan, jan_name),
    (eid, t1, t1_name),
    (eid, t2, t2_name),
    (eid, t3, t3_name);
  INSERT INTO event_comments (event_id, user_id, user_name, body, created_at) VALUES
    (eid, t1,  t1_name,  'Będę 10 minut później, korek na Hetmańskiej.', now() - interval '3 hours'),
    (eid, jan, jan_name, 'Spoko, zaczniemy rozgrzewkę bez Ciebie.',      now() - interval '2 hours'),
    (eid, t2,  t2_name,  'Ktoś bierze piłki? Bo ja mam tylko jedną i to średnio napompowaną. Jak nikt nie ma, to wpadnę wcześniej do Decathlonu, tylko dajcie znać do 16, bo potem już nie zdążę. Miałbym też dwa komplety znaczników, jakby ktoś potrzebował do podziału na drużyny.', now() - interval '90 minutes'),
    (eid, t3,  t3_name,  'Ja mam pompkę, ogarnę.',                       now() - interval '1 hour');
  INSERT INTO event_comments (event_id, user_id, user_name, body, created_at, deleted_at) VALUES
    (eid, t1, t1_name, 'Ten komentarz został usunięty przez autora.', now() - interval '30 minutes', now());

  -- ---- 12. Bez opisu i bez tytułu ------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, description)
  VALUES (jan, jan_name, 'koszykówka', 'Boisko Rataje', CURRENT_DATE + 6, '17:30', 8, 'public',
    '[TEST-J] Mecz BEZ tytułu — nagłówek ma sam wygenerować sensowną nazwę ze sportu i miejsca, a nie zostawić pustego miejsca. Karta na liście też.');

  -- ---- 13. Bardzo dużo uczestników ------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, team_mode, teams_published)
  VALUES (jan, jan_name, 'piłka nożna', 'Stadion POSiR Golęcin', CURRENT_DATE + 7, '11:00', 22, 'public',
    'Niedzielny mecz jedenastek',
    '[TEST-J] 18 osób w składzie (12 z kontem + 6 gości), podzielonych na dwie drużyny. Sprawdź na TELEFONIE: czy lista się nie rozjeżdża, czy stos awatarów nad składem wygląda sensownie i czy podział na drużyny da się przewinąć.',
    'reczne', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_captain) VALUES
    (eid, jan, jan_name, 'A', true),
    (eid, t1,  t1_name, 'B', true);
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fr,  fr_name, 'A'),
    (eid, t2,  t2_name, 'A'),
    (eid, t3,  t3_name, 'A'),
    (eid, t4,  t4_name, 'A'),
    (eid, t5,  t5_name, 'A'),
    (eid, t6,  t6_name, 'B'),
    (eid, t7,  t7_name, 'B'),
    (eid, t8,  t8_name, 'B'),
    (eid, t9,  t9_name, 'B'),
    (eid, t10, t10_name, 'B');
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, team) VALUES
    (eid, NULL, 'Bartek',              true, jan, 'A'),
    (eid, NULL, 'Kolega Bartka',       true, jan, 'A'),
    (eid, NULL, 'Sąsiad z bloku',      true, t1, 'A'),
    (eid, NULL, 'Wojtek',              true, t1, 'B'),
    (eid, NULL, 'Znajomy z siłowni',   true, t1, 'B'),
    (eid, NULL, 'Przemek',             true, jan, 'B');

  -- ---- 14. Bardzo długi opis ------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, cost_grosz, track_payments,
                      accepted_payment_methods, blik_phone)
  VALUES (jan, jan_name, 'piłka nożna', 'Kompleks Sportowy Politechniki Poznańskiej',
          CURRENT_DATE + 8, '20:30', 14, 'public',
    'Cotygodniowe granie na Politechnice — zapisy do czwartku',
    '[TEST-J] Bardzo długi opis do sprawdzenia zawijania i ewentualnego zwijania tekstu. ' ||
    'Gramy w każdą niedzielę o 20:30 na sztucznej trawie przy Piotrowie. Wejście od strony parkingu, ' ||
    'brama jest otwarta od 20:15 — jak przyjdziesz wcześniej, poczekaj przy szlabanie, bo ochrona nie ' ||
    'wpuszcza pojedynczo. Szatnie są w budynku obok, klucz odbieramy na portierni na nazwisko organizatora. ' ||
    'Koszt 25 zł od osoby, płatne BLIKiem przed meczem albo gotówką na miejscu — wolę BLIK, bo potem nie ' ||
    'muszę się rozmieniać. Buty: korki lanki albo turfy, ekstrakty odpadają, bo zarządca się czepia o murawę. ' ||
    'Kto się zapisze i nie przyjdzie bez odwołania do soboty wieczorem, następnym razem wchodzi na rezerwę. ' ||
    'Nie chodzi o karanie, tylko o to, że przy 14 miejscach dwie osoby mniej psują cały mecz. ' ||
    'Gramy do 22:00, potem trzeba zejść z boiska, bo światła gasną automatycznie.',
    2500, true, ARRAY['blik','gotowka'], '600 700 800')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, has_paid, paid_amount) VALUES
    (eid, jan, jan_name, true,  2500),
    (eid, t1,  t1_name, true,  2500),
    (eid, t2,  t2_name, false, 0),
    (eid, t3,  t3_name, false, 0);

  RAISE NOTICE 'Gotowe: 19 wydarzeń [TEST-J]. Zaloguj się jako j4n.brz0@gmail.com.';
END $$;

-- Podgląd tego, co powstało.
SELECT format('%s | %s | %s',
  to_char(event_date, 'DD.MM'),
  coalesce(title, '(bez tytułu)'),
  CASE status WHEN 'cancelled' THEN 'ODWOŁANY' ELSE
    CASE WHEN event_date < CURRENT_DATE THEN 'rozegrany' ELSE 'nadchodzący' END END) AS wynik
FROM events
WHERE description LIKE '[TEST-J]%'
ORDER BY event_date;
