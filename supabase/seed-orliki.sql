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
