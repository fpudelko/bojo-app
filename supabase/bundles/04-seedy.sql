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
--   4. 25 wydarzeń testowych pokrywających przepływy aplikacji  [TEST]
--   5. 4 grupy + 11 meczów prywatnych                            [TEST-G]
--   6. 19 wydarzeń dla Jana — wyniki, historia, komentarze       [TEST-J]
--   7. 43 scenariusze regresyjne (R01…R43)                       [REG]
--   8. 12 scenariuszy zakładki „Taktyka" (T01…T12)               [TAK]
--   9. 12 scenariuszy pod dwa realne konta (D01…D12)             [DWA]
--  10. 7 stanów startowych sesji przedpremierowej (P1…P7)        [PRZED]
-- 
-- Bezpieczny do wielokrotnego uruchamiania: istniejące konta są pomijane,
-- a wydarzenia kasowane po swoim markerze i tworzone od nowa.
-- 
-- Nie chcesz kompletu? Każdą sekcję da się wyciąć — pliki są rozdzielone
-- nagłówkiem z nazwą, a markery trzymają scenariusze rozłącznie.
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

-- Powtórne uruchomienie NIE jest błędem: paczka `04-seedy.sql` wkleja ten plik
-- razem z resztą seedów i człowiek uruchamia ją drugi raz choćby po to, żeby
-- dołożyć brakujący scenariusz. Bez `ON CONFLICT` cała paczka wywracała się
-- wtedy na `duplicate key value violates unique constraint "fields_pkey"`,
-- czyli na katalogu boisk — jeszcze zanim doszła do wydarzeń.
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
)
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- seed-beach-volleyball.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Boiska do siatkówki plażowej — powiat poznański (16 obiektów)
-- Źródło: napiachu.pl, posir.poznan.pl, strony własne obiektów
-- GPS i dane kontaktowe zweryfikowane czerwiec 2025
-- ============================================================

-- Powtórne uruchomienie NIE jest błędem: paczka `04-seedy.sql` wkleja ten plik
-- razem z resztą seedów i człowiek uruchamia ją drugi raz choćby po to, żeby
-- dołożyć brakujący scenariusz. Bez `ON CONFLICT` cała paczka wywracała się
-- wtedy na `duplicate key value violates unique constraint "fields_pkey"`,
-- czyli na katalogu boisk — jeszcze zanim doszła do wydarzeń.
INSERT INTO fields (
  id, name, address, lat, lng,
  sport, available, surface, is_indoor,
  phone, website, source,
  operator, description, opening_hours,
  fee, has_changing_rooms, has_shower, has_toilets,
  pitch_count, venue_type, access_type,
  district, postcode, is_verified_venue, condition
) VALUES

-- 1. POSiR Rusałka — 8 boisk, bezpłatne (rezerwacja online)
(
  'bb000001-0000-0000-0000-000000000001',
  'POSiR Rusałka — Boiska Siatkówki Plażowej',
  'ul. Golęcińska 27, 60-626 Poznań',
  52.42640, 16.87670,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 847 54 67',
  'https://posir.poznan.pl/obiekty/rusalka/boiska-do-siatkowki-plazowej',
  'manual',
  'POSiR Poznań',
  'Największy kompleks boisk do siatkówki plażowej w Poznaniu — 8 pełnowymiarowych kortów na piasku nad Jeziorem Rusałka. Bezpłatne, wymagana rezerwacja online. Co roku gospodarz turnieju Lotto Plaża Wolności.',
  'Mo-Su 08:00-22:00',
  false, true, true, true,
  8, 'volleyball_beach', 'public',
  'Jeżyce', '60-626', true, 'good'
),

-- 2. Piach i Podróże (POSiR Rataje) — 4 boiska, płatne 8 zł/os/h
(
  'bb000002-0000-0000-0000-000000000002',
  'Piach i Podróże — Boiska Plażowe',
  'Os. Piastowskie 106A, 61-164 Poznań',
  52.39600, 16.97950,
  ARRAY['siatkówka plażowa', 'beach tennis'], true, 'sand', false,
  '+48 668 675 147',
  'https://piachipodroze.pl',
  'manual',
  'Beach Volleyball Academy / Proskos',
  '4 pełnowymiarowe boiska przy POSiR Rataje. Beach bar, leżaki, beach tennis, obozy i turnieje. Rezerwacja online przez Playmore. Koszt: 8 zł/os/h.',
  'Mo-Fr 14:00-23:00; Sa-Su 10:00-23:00',
  true, true, true, true,
  4, 'volleyball_beach', 'public',
  'Nowe Miasto', '61-164', true, 'good'
),

-- 3. Beach Arena BVA — Park Kasprowicza — 4 boiska, płatne
(
  'bb000003-0000-0000-0000-000000000003',
  'Beach Arena — Beach Volleyball Academy',
  'Park im. Jana Kasprowicza 1, 60-238 Poznań',
  52.40980, 16.92350,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 693 569 408',
  'https://bvacademy.pl/beach-arena/',
  'manual',
  'Beach Volleyball Academy (BVA)',
  '4 profesjonalne boiska w Parku Kasprowicza. Szkolenia dla dzieci (dofinansowanie Miasta), wynajem dla grup, Beach Bar, prysznice, oficjalne piłki Mikasa.',
  'Mo-Su 08:00-22:00',
  true, true, true, true,
  4, 'volleyball_beach', 'public',
  'Grunwald', '60-238', true, 'good'
),

-- 4. POSiR Chwiałka — 3 boiska, bezpłatne (wejście na kąpielisko płatne)
(
  'bb000004-0000-0000-0000-000000000004',
  'POSiR Chwiałka — Boiska Siatkówki Plażowej',
  'ul. Chwiałkowskiego 34, 60-171 Poznań',
  52.42190, 16.94780,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 833 05 11',
  'https://posir.poznan.pl/obiekty/chwialka',
  'manual',
  'POSiR Poznań',
  '3 boiska na piasku kwarcowym przy kąpielisku Chwiałka. Oświetlone — gra możliwa po zmroku. Wejście: 11,50 zł (po 18:00 — 6 zł). Turniej "Chwiałka Volley" we wrześniu.',
  'Mo-Su 09:00-20:00',
  false, true, true, true,
  3, 'volleyball_beach', 'public',
  'Wilda', '60-171', true, 'good'
),

-- 5. POSiR Strzeszynek — 2 boiska, bezpłatne
(
  'bb000005-0000-0000-0000-000000000005',
  'POSiR Strzeszynek — Boiska Siatkówki Plażowej',
  'ul. Koszalińska 15, 60-449 Poznań',
  52.43500, 16.83120,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 848 31 29',
  'https://posir.poznan.pl/obiekty/strzeszynek',
  'manual',
  'POSiR Poznań',
  '2 boiska przy kąpielisku nad Jeziorem Strzeszyńskim. Otoczone piłkochwytami. Wejście na plażę sezonowo płatne.',
  'Mo-Su 09:00-19:00',
  false, true, true, true,
  2, 'volleyball_beach', 'public',
  'Piątkowo', '60-449', true, 'good'
),

-- 6. Restauracja Oaza Strzeszynek — 4 boiska, bezpłatne
(
  'bb000006-0000-0000-0000-000000000006',
  'Oaza Strzeszynek — Boiska Plażowe',
  'ul. Koszalińska 15 (teren ośrodka), 60-449 Poznań',
  52.43500, 16.83050,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 848 31 45',
  'https://strzeszynek.pl',
  'manual',
  'Restauracja Oaza',
  '4 boiska na terenie ośrodka Oaza przy Jeziorze Strzeszyńskim. Bezpłatne. Leżaki, parasole, wypożyczalnia sprzętu wodnego, plac zabaw.',
  'Tu-Su 13:00-22:00',
  false, false, false, true,
  4, 'volleyball_beach', 'public',
  'Piątkowo', '60-449', true, 'good'
),

-- 7. POSiR MOS Wyspiańskiego — 2 boiska, płatne
(
  'bb000007-0000-0000-0000-000000000007',
  'POSiR MOS — Boiska Siatkówki Plażowej',
  'ul. Stanisława Wyspiańskiego 27, 60-751 Poznań',
  52.40030, 16.91010,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 835 79 00',
  'https://posir.poznan.pl/obiekty/mos/boiska-do-siatkowki-plazowej',
  'manual',
  'POSiR Poznań / MOS',
  '2 boiska plażowe przy MOS. Rezerwacja e-mail: mos@posir.poznan.pl lub przez biuro MOS ul. Gdańska 1.',
  'Mo-Fr 07:00-20:00; Sa-Su 10:00-18:00',
  true, true, true, true,
  2, 'volleyball_beach', 'public',
  'Grunwald', '60-751', true, 'good'
),

-- 8. Politechnika Poznańska CSPP — 1 boisko
(
  'bb000008-0000-0000-0000-000000000008',
  'CSPP Politechnika Poznańska — Boisko Plażowe',
  'ul. Piotrowo 4, 61-138 Poznań',
  52.40260, 16.94800,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 665 34 92',
  'https://cspp.put.poznan.pl',
  'manual',
  'Centrum Sportu i Rekreacji Politechniki Poznańskiej',
  '1 boisko na kampusie PP. Do końca czerwca pierwszeństwo dla studentów i pracowników; sezonowo otwarte dla zewnętrznych. Rezerwacja przez recepcję lub e-mail: obiekt.sportowy.recepcja@put.poznan.pl',
  'Mo-Su 08:00-22:00',
  true, true, true, true,
  1, 'volleyball_beach', 'club',
  'Wilda', '61-138', true, 'good'
),

-- 9. Univ. Przyrodniczy CKF — 2 boiska, ~15 zł/h
(
  'bb000009-0000-0000-0000-000000000009',
  'CKF Uniwersytet Przyrodniczy — Boiska Plażowe',
  'ul. Wojska Polskiego 28, 60-637 Poznań',
  52.40420, 16.92400,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 846 62 45',
  'https://sparrow.up.poznan.pl/ckf/',
  'manual',
  'Centrum Kultury Fizycznej UP Poznań',
  '2 boiska przy kampusie Uniwersytetu Przyrodniczego. Rezerwacja online przez Bo5.pl. Ok. 15 zł/h. Głównie dla studentów i pracowników; dostęp zewnętrzny możliwy.',
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, true, true,
  2, 'volleyball_beach', 'club',
  'Jeżyce', '60-637', true, 'good'
),

-- 10. OAZA Kórnik — 3 boiska, bezpłatne
(
  'bb000010-0000-0000-0000-000000000010',
  'OAZA Kórnickie Centrum Rekreacji — Boiska Plażowe',
  'ul. Ignacego Krasickiego 1, 62-035 Kórnik',
  52.24190, 17.08820,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 649 88 75',
  'https://oaza.kornik.pl/blonie/siatkowka-plazowa',
  'manual',
  'Kórnickie Centrum Rekreacji i Sportu OAZA',
  '3 boiska przy kąpielisku w Kórniku. Bezpłatne. Wypożyczalnia sprzętu wodnego, leżaki z parasolami, plac zabaw. Organizowane turnieje.',
  'Mo-Su 06:30-22:30',
  false, true, true, true,
  3, 'volleyball_beach', 'public',
  NULL, '62-035', true, 'good'
),

-- 11. AKWEN Czerwonak — 1 boisko, płatne
(
  'bb000011-0000-0000-0000-000000000011',
  'AKWEN Centrum Sportu — Boisko Siatkówki Plażowej',
  'ul. Leśna 6, 62-004 Czerwonak',
  52.47470, 17.01160,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 790 722 544',
  'https://akwenczerwonak.pl/nasze-obiekty/boiska-sportowe/',
  'manual',
  'Centrum Rozwoju Kultury Fizycznej AKWEN',
  '1 boisko ogrodzone piłkochwytem 4 m. Rezerwacja tel. 790 722 544 lub 510 908 777. Wypożyczenie sprzętu, szatnie, prysznice, siłownia zewnętrzna.',
  'Mo-Fr 10:00-22:00; Sa-Su 10:00-20:00',
  true, true, true, true,
  1, 'volleyball_beach', 'public',
  NULL, '62-004', true, 'good'
),

-- 12. Suchy Las — ul. Poziomkowa
(
  'bb000012-0000-0000-0000-000000000012',
  'Boisko Siatkówki Plażowej — ul. Poziomkowa',
  'ul. Poziomkowa, 62-002 Suchy Las',
  52.47010, 16.88600,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 892 65 35',
  'https://www.suchylas.pl/dla-mieszkancow/sport-i-rekreacja/boiska/',
  'manual',
  'Gmina Suchy Las',
  'Publiczne boisko do siatkówki plażowej. Bezpłatne, bez rezerwacji.',
  'Mo-Su 08:00-22:00',
  false, false, false, false,
  NULL, 'volleyball_beach', 'public',
  NULL, '62-002', true, 'fair'
),

-- 13. Suchy Las — ul. Szkółkarska
(
  'bb000013-0000-0000-0000-000000000013',
  'Boisko Siatkówki Plażowej — ul. Szkółkarska',
  'ul. Szkółkarska, 62-002 Suchy Las',
  52.46160, 16.89520,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 892 65 35',
  'https://www.suchylas.pl/dla-mieszkancow/sport-i-rekreacja/boiska/',
  'manual',
  'Gmina Suchy Las',
  'Publiczne boisko do siatkówki plażowej. Bezpłatne, bez rezerwacji.',
  'Mo-Su 08:00-22:00',
  false, false, false, false,
  NULL, 'volleyball_beach', 'public',
  NULL, '62-002', true, 'fair'
),

-- 14. GOKiS Tulce (Kleszczewo) — 1 boisko, bezpłatne z rezerwacją
(
  'bb000014-0000-0000-0000-000000000014',
  'GOKiS Tulce — Boisko Siatkówki Plażowej',
  'ul. Szkolna 1, 63-005 Tulce',
  52.33710, 17.12310,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 513 762 783',
  'https://gokis.kleszczewo.pl/boisko-do-siatkowki-plazowej-w-tulcach.html',
  'manual',
  'GOKiS Kleszczewo',
  '1 boisko przy hali sportowej. Bezpłatne — rezerwacja online (gokis.kleszczewo.pl). Pon.–pt. 8–15 pierwszeństwo SP w Tulcach. Coroczny turniej "Tulce Plaża Oldboy".',
  'Mo-Fr 15:00-21:00; Sa-Su 09:00-21:00',
  false, true, false, true,
  1, 'volleyball_beach', 'school',
  NULL, '63-005', true, 'good'
),

-- 15. OSiR Mosina — 2 boiska
(
  'bb000015-0000-0000-0000-000000000015',
  'OSiR Mosina — Boiska Siatkówki Plażowej',
  'ul. Marii Konopnickiej 31, 62-050 Mosina',
  52.24240, 16.85100,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 813 29 03',
  'https://osirmosina.pl/index.php/stadion/',
  'manual',
  'OSiR Mosina',
  '2 boiska przy stadionie OSiR. Rezerwacja telefoniczna min. 2h wcześniej: 61 813 29 03 (08:00–15:00) lub 607 162 581 (po 15:00, weekendy).',
  'Mo-Fr 07:00-19:00; Sa-Su 09:00-19:00',
  NULL, NULL, NULL, NULL,
  2, 'volleyball_beach', 'public',
  NULL, '62-050', true, 'good'
),

-- 16. OSiR Buk — 2 boiska, publiczne
(
  'bb000016-0000-0000-0000-000000000016',
  'OSiR Buk — Boiska Siatkówki Plażowej',
  'ul. Sportowa 14, 64-320 Buk',
  52.35850, 16.52300,
  ARRAY['siatkówka plażowa'], true, 'sand', false,
  '+48 61 814 91 40',
  'https://osir-buk.pl/stadion-miejski.html',
  'manual',
  'OSiR Buk',
  '2 pełnowymiarowe boiska (8×8 m) przy stadionie. Na terenie też pole do piłki ręcznej plażowej. Publiczne, bezpłatne. Wakacyjne turnieje OSiR.',
  'Mo-Su 07:00-23:00',
  false, NULL, NULL, true,
  2, 'volleyball_beach', 'public',
  NULL, '64-320', true, 'good'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Rezerwacje — field_outreach z booking_url
-- ============================================================

INSERT INTO field_outreach (field_id, status, booking_system, booking_url, booking_provider, priority)
VALUES
  ('bb000001-0000-0000-0000-000000000001', 'umowiony', 'wlasny_system',
   'https://posir.poznan.pl/obiekty/rusalka/boiska-do-siatkowki-plazowej', 'POSiR', 1),

  ('bb000002-0000-0000-0000-000000000002', 'umowiony', 'zewnetrzny',
   'https://playmore.pl/klub/piach-i-podroze/', 'Playmore', 1),

  ('bb000003-0000-0000-0000-000000000003', 'umowiony', 'wlasny_system',
   'https://bvacademy.pl/beach-arena-rezerwacja/', 'BVA', 1),

  ('bb000004-0000-0000-0000-000000000004', 'umowiony', 'telefon',
   NULL, NULL, 0),

  ('bb000005-0000-0000-0000-000000000005', 'umowiony', 'brak',
   NULL, NULL, 0),

  ('bb000006-0000-0000-0000-000000000006', 'umowiony', 'telefon',
   NULL, NULL, 0),

  ('bb000007-0000-0000-0000-000000000007', 'umowiony', 'email',
   NULL, NULL, 0),

  ('bb000008-0000-0000-0000-000000000008', 'umowiony', 'email',
   NULL, NULL, 0),

  ('bb000009-0000-0000-0000-000000000009', 'umowiony', 'zewnetrzny',
   'https://bo5.pl/ckf', 'Bo5.pl', 1),

  ('bb000010-0000-0000-0000-000000000010', 'umowiony', 'telefon',
   NULL, NULL, 0),

  ('bb000011-0000-0000-0000-000000000011', 'umowiony', 'telefon',
   NULL, NULL, 0),

  ('bb000012-0000-0000-0000-000000000012', 'umowiony', 'brak',
   NULL, NULL, 0),

  ('bb000013-0000-0000-0000-000000000013', 'umowiony', 'brak',
   NULL, NULL, 0),

  ('bb000014-0000-0000-0000-000000000014', 'umowiony', 'wlasny_system',
   'https://gokis.kleszczewo.pl/rezerwacja-obiektow.html', 'GOKiS', 1),

  ('bb000015-0000-0000-0000-000000000015', 'umowiony', 'telefon',
   NULL, NULL, 0),

  ('bb000016-0000-0000-0000-000000000016', 'umowiony', 'brak',
   NULL, NULL, 0)
ON CONFLICT (field_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- seed-rental-venues.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Boiska/hale na wynajem — Poznań i okolice
-- Balony pneumatyczne, hale sportowe, zadaszenia stałe
-- Źródło: posir.poznan.pl, arenadebiec.pl, centrumplek.pl, wtkkf.pl
-- GPS przybliżone (fix_coords.py dokona weryfikacji)
-- ============================================================

-- Powtórne uruchomienie NIE jest błędem: paczka `04-seedy.sql` wkleja ten plik
-- razem z resztą seedów i człowiek uruchamia ją drugi raz choćby po to, żeby
-- dołożyć brakujący scenariusz. Bez `ON CONFLICT` cała paczka wywracała się
-- wtedy na `duplicate key value violates unique constraint "fields_pkey"`,
-- czyli na katalogu boisk — jeszcze zanim doszła do wydarzeń.
INSERT INTO fields (
  id, name, address, lat, lng,
  sport, available, surface, is_indoor,
  phone, website, source,
  operator, description, opening_hours,
  fee, has_changing_rooms, has_shower, has_toilets,
  pitch_count, venue_type, access_type,
  district, postcode, is_verified_venue, condition
) VALUES

-- 1. Sportwin Arena Dębiec — balon pneumatyczny (sezon jesień-zima)
(
  'cc000001-0000-0000-0000-000000000001',
  'Sportwin Arena Dębiec — Balon Piłkarski',
  'ul. Łozowa 77, 61-312 Poznań',
  52.37850, 16.95250,
  ARRAY['piłka nożna', 'futsal'], true, 'artificial', true,
  NULL,
  'https://www.arenadebiec.pl',
  'manual',
  'Sportwin Group',
  'Pełnowymiarowe boisko z nawierzchnią sztuczną FIFA Quality Pro pokryte balonem pneumatycznym od jesieni do wiosny. Dzielone na ćwiartki lub połówki. Czynne 7:00–24:00. Tuż przy węźle A2 i pętli tramwajowo-autobusowej Dębiec.',
  'Mo-Su 07:00-24:00',
  true, true, true, true,
  1, 'other', 'private',
  'Dębiec', '61-312', true, 'good'
),

-- 2. Centrum Plek — zadaszenie stałe (całoroczne, 6 boisk)
(
  'cc000002-0000-0000-0000-000000000002',
  'Centrum Plek — Zadaszony Kompleks Sportowy',
  'ul. Margonińska 25, 60-230 Poznań',
  52.41280, 16.81650,
  ARRAY['piłka nożna', 'futsal', 'padel'], true, 'artificial', true,
  NULL,
  'https://centrumplek.pl',
  'manual',
  'Centrum Plek',
  'Jedyny całoroczny zadaszony kompleks tego rodzaju w regionie — 6 boisk piłkarskich o regulowanych rozmiarach (od mini do pełnowymiarowego), wszystkie pod stałym dachem. Rezerwacja przez Playtomic. Parking na 100 miejsc.',
  'Mo-Su 07:00-23:00',
  true, true, true, true,
  6, 'other', 'private',
  'Krzyżowniki-Smochowice', '60-230', true, 'good'
),

-- 3. WTKKF — boiska naturalne i sztuczna trawa
(
  'cc000003-0000-0000-0000-000000000003',
  'WTKKF — Boiska Sportowe Winogrady',
  'ul. Winogrady 11, 61-663 Poznań',
  52.43750, 16.92600,
  ARRAY['piłka nożna', 'rugby', 'padel'], true, 'grass', false,
  '+48 61 853 15 41',
  'https://wtkkf.pl/wynajem-obiektow/',
  'manual',
  'Wielkopolskie Towarzystwo Krzewienia Kultury Fizycznej',
  'Kompleks sportowy 3 km od centrum: pełnowymiarowe boisko naturalne, boisko Lech Future z sztuczną trawą (ogrodzone, oświetlone), korty padel. Na wynajem dla amatorów i klubów.',
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, false, true,
  3, 'other', 'club',
  'Winogrady', '61-663', true, 'good'
),

-- 4. POSiR Golęcin — boiska piłkarskie (pełnowymiarowe, wynajem)
(
  'cc000004-0000-0000-0000-000000000004',
  'POSiR Golęcin — Boiska Piłkarskie',
  'ul. Warmińska 1, 60-622 Poznań',
  52.42722, 16.88833,
  ARRAY['piłka nożna', 'rugby', 'futbol amerykański'], true, 'artificial', false,
  '+48 61 840 68 72',
  'https://posir.poznan.pl/obiekty/golecin/boiska-pilkarskie',
  'manual',
  'POSiR Poznań',
  'Dwa pełnowymiarowe boiska ze sztuczną trawą (100×64 m i 95×55 m) plus bieżnia. Wynajem dla drużyn, szkółek i amatorów. Szatnie wliczone w cenę.',
  'Mo-Fr 07:00-22:00; Sa-Su 08:00-20:00',
  true, true, true, true,
  2, 'other', 'public',
  'Golęcin', '60-622', true, 'good'
),

-- 5. POSiR Chwiałka — hale sportowe (wynajem)
(
  'cc000005-0000-0000-0000-000000000005',
  'POSiR Chwiałka — Hale Sportowe',
  'ul. Spychalskiego 34A, 61-553 Poznań',
  52.42100, 16.94800,
  ARRAY['piłka nożna', 'futsal', 'koszykówka', 'siatkówka', 'piłka ręczna'], true, 'synthetic', true,
  '+48 510 914 314',
  'https://posir.poznan.pl/obiekty/chwialka/hale-sportowe',
  'manual',
  'POSiR Poznań',
  'Hala (44,76×33,96 m, wys. 15,4 m) podzielona na 3 sektory. Wynajem dla drużyn amatorskich: 90–105 zł/h. Pełna infrastruktura: szatnie, prysznice, parking.',
  'Mo-Fr 07:00-22:00; Sa-Su 08:00-20:00',
  true, true, true, true,
  3, 'futsal_hall', 'public',
  'Wilda', '61-553', true, 'good'
),

-- 6. PUT CSPP Piotrowo — hala sportowa (podzielona na 3)
(
  'cc000006-0000-0000-0000-000000000006',
  'PUT CSPP — Hala Sportowa Piotrowo',
  'ul. Piotrowo 4, 61-138 Poznań',
  52.40260, 16.94830,
  ARRAY['piłka nożna', 'futsal', 'koszykówka', 'siatkówka', 'badminton'], true, 'synthetic', true,
  '+48 61 665 34 92',
  'https://cspp.put.poznan.pl/hala-sportowa',
  'manual',
  'Centrum Sportu i Rekreacji Politechniki Poznańskiej',
  'Hala pełnowymiarowa podzielona na 3 niezależne sektory — futsal, koszykówka, siatkówka. Wynajem dla studentów i zewnętrznych. E-mail: obiekt.sportowy.recepcja@put.poznan.pl',
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, true, true,
  3, 'futsal_hall', 'club',
  'Wilda', '61-138', true, 'good'
),

-- 7. CKF UP — hala sportowa (podzielona na 3)
(
  'cc000007-0000-0000-0000-000000000007',
  'CKF UP — Hala Sportowa Wojska Polskiego',
  'ul. Wojska Polskiego 28, 60-637 Poznań',
  52.40420, 16.92400,
  ARRAY['piłka nożna', 'futsal', 'koszykówka', 'siatkówka', 'unihokej'], true, 'synthetic', true,
  '+48 61 846 62 45',
  'https://sparrow.up.poznan.pl/ckf/obiekty/',
  'manual',
  'Centrum Kultury Fizycznej Uniwersytetu Przyrodniczego w Poznaniu',
  'Hala pełnowymiarowa podzielona na 3 sektory. Rezerwacja online przez Bo5.pl. Dostęp dla zewnętrznych po zapisaniu się na semestr.',
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, true, true,
  3, 'futsal_hall', 'club',
  'Jeżyce', '60-637', true, 'good'
),

-- 8. POSiR Malta — boisko piłkarskie (wynajem, pełnowymiarowe)
(
  'cc000008-0000-0000-0000-000000000008',
  'POSiR Malta — Boisko Piłkarskie',
  'ul. Jana Pawła II 2, 61-139 Poznań',
  52.39520, 16.99560,
  ARRAY['piłka nożna'], true, 'artificial', false,
  '+48 61 877 23 29',
  'https://posir.poznan.pl/obiekty/malta/',
  'manual',
  'POSiR Poznań',
  'Pełnowymiarowe boisko ze sztuczną trawą nad Maltą. Wynajem: trening do 16:00 — 215 zł/1,5 h (półboisko), mecz wieczorny — 320 zł/2 h. Rezerwacja mailowa 3 dni wcześniej.',
  'Mo-Fr 07:00-22:00; Sa-Su 08:00-20:00',
  true, true, true, true,
  1, 'other', 'public',
  'Nowe Miasto', '61-139', true, 'good'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Outreach
-- ============================================================

INSERT INTO field_outreach (field_id, status, booking_system, priority)
VALUES
  ('cc000001-0000-0000-0000-000000000001', 'umowiony', 'wlasny_system', 1),
  ('cc000002-0000-0000-0000-000000000002', 'umowiony', 'zewnetrzny',    1),
  ('cc000003-0000-0000-0000-000000000003', 'umowiony', 'telefon',       0),
  ('cc000004-0000-0000-0000-000000000004', 'umowiony', 'email',         0),
  ('cc000005-0000-0000-0000-000000000005', 'umowiony', 'telefon',       0),
  ('cc000006-0000-0000-0000-000000000006', 'umowiony', 'email',         0),
  ('cc000007-0000-0000-0000-000000000007', 'umowiony', 'zewnetrzny',    1),
  ('cc000008-0000-0000-0000-000000000008', 'umowiony', 'email',         0)
ON CONFLICT (field_id) DO NOTHING;


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
  brak TEXT[] := '{}'; -- migrations missing from the database (see the check below)
BEGIN
  -- SCHEMA CHECK. Migrations in this repo are run BY HAND, so the database is
  -- often older than the file being pasted into it. Without this check the seed
  -- dies halfway through, on the first INSERT touching a newer column, with
  -- Postgres' "column ... does not exist" — which says WHAT is missing but
  -- neither why nor what to do about it. The cause is always the same: an
  -- unapplied migration. One sentinel per migration, all gaps reported at once
  -- so they are not discovered one run at a time. Message stays Polish, like
  -- every other RAISE in this file.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'events'
                    AND column_name = 'reserve_claim_minutes') THEN
    brak := brak || CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'events'
                      AND column_name = 'reserve_claim_hours')
      THEN '118_rezerwa_czas_w_minutach.sql — w bazie siedzi jeszcze stara kolumna reserve_claim_hours (godziny)'
      ELSE '118_rezerwa_czas_w_minutach.sql — brak kolumny events.reserve_claim_minutes'
    END::text;
  ELSIF EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.events'::regclass
                   AND conname = 'events_reserve_claim_hours_check') THEN
    -- New column name, but the CHECK from `058` (1..72) is still attached —
    -- migration `118` only got halfway (rename without the conversion to
    -- minutes). Without this branch the seed only fails later, on
    -- "violates check constraint events_reserve_claim_hours_check".
    brak := brak || '118_rezerwa_czas_w_minutach.sql — przeszła tylko w połowie: kolumna ma nową nazwę, ale zostało ograniczenie CHECK 1..72 i wartości w godzinach (puść CAŁY plik jeszcze raz, jest odporny na powtórzenie)'::text;
  END IF;
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF org1 IS NULL OR org2 IS NULL OR org3 IS NULL THEN
    RAISE EXCEPTION 'Brakuje jednego z kont organizatora w auth.users — sprawdź e-maile (franciszekpudelko@gmail.com / franekks@gmail.com / j4n.brz0@gmail.com).';
  END IF;
  IF t1 IS NULL OR t2 IS NULL OR t3 IS NULL OR t4 IS NULL OR t5 IS NULL
     OR t6 IS NULL OR t7 IS NULL OR t8 IS NULL OR t9 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brakuje jednego z kont test1..test10@example.com w auth.users.';
  END IF;

  -- Wiping the previous run happens AFTER the checks above: a seed that fails
  -- must leave the database as it found it, not clear the old rows and then
  -- fail to write the new ones. Matches both the current marker (description)
  -- and the older format from an earlier version of this script (title), so
  -- stale rows never pile up.
  DELETE FROM events WHERE title LIKE '[TEST]%' OR description LIKE '[TEST]%';

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
                       cost_grosz, accepted_payment_methods)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 4, '18:30', 10, 'public',
    'Mecz na Junikowie',
    '[TEST] Płatne 20 zł, akceptowany tylko BLIK — sprawdź, czy numer BLIK jest widoczny w nagłówku wydarzenia (nie tylko w dialogu zapisu).',
    2000, ARRAY['blik']::text[])
  RETURNING id INTO eid;
  -- Numer BLIK od migracji `120` mieszka w osobnej tabeli (RLS — patrz `121`).
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 600 700');
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
                       cost_grosz, accepted_payment_methods,
                       accepted_sports_cards, sports_card_discount_grosz, sports_card_other_name)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '18:00', 10, 'public',
    'Sobotni mecz na Malcie',
    '[TEST] Karta sportowa daje zniżkę, ale bez podanej kwoty — gracz z kartą powinien zobaczyć "zapytaj organizatora o szczegóły" zamiast wyliczonej ceny. Zaakceptowana też "Inna karta" nazwana "OK System".',
    2500, ARRAY['blik','gotowka']::text[],
    ARRAY['multisport','fitprofit','inne']::text[], NULL, 'OK System')
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '600 111 222');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org2, org2_name, NULL, false, NULL, true),
    (eid, t5, t5_name, 'blik', true, 'inne', false),
    (eid, t6, t6_name, 'gotowka', true, 'fitprofit', false);

  -- ========================================================
  -- 9. Wieczorna gra na Junikowie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 6, '17:30', 10, 'public',
    'Wieczorna gra na Junikowie',
    '[TEST] Płatne 15 zł, zaakceptowane naraz BLIK, gotówka i inne — sprawdź wybór metody przy zapisie i wyświetlanie przy każdym uczestniku.',
    1500, ARRAY['blik','gotowka','inne']::text[])
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '700 222 333');
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

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[TEST]%'
   AND lat IS NULL
   AND field_id IS NULL;


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

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[TEST-G]%'
   AND lat IS NULL
   AND field_id IS NULL;


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
  -- Data i godzina liczone z JEDNEGO znacznika czasu. Stało tu
  -- `to_char(now() + interval '2 hours', 'HH24:MI')`, co dawało TEKST, a
  -- `events.event_time` jest typu `time` — Postgres nie rzutuje tekstu na czas
  -- przy wstawianiu i cały seed wywracał się na `column "event_time" is of
  -- type time without time zone but expression is of type text`. Drugi błąd
  -- siedział obok: `CURRENT_DATE` z godziną liczoną od `now()` po północy
  -- ustawia mecz 22 godziny w PRZESZŁOŚĆ — czyli dokładnie odwrotnie, niż mówi
  -- opis. Dlatego data i godzina idą z tego samego wyrażenia.
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta',
          (now() + interval '2 hours')::date,
          date_trunc('minute', now() + interval '2 hours')::time, 10, 'public',
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
                      accepted_payment_methods)
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
    2500, true, ARRAY['blik','gotowka'])
  RETURNING id INTO eid;
  -- Numer BLIK od migracji `120` mieszka w osobnej tabeli (RLS — patrz `121`).
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '600 700 800');
  INSERT INTO event_participants (event_id, user_id, name, has_paid, paid_amount) VALUES
    (eid, jan, jan_name, true,  2500),
    (eid, t1,  t1_name, true,  2500),
    (eid, t2,  t2_name, false, 0),
    (eid, t3,  t3_name, false, 0);

  RAISE NOTICE 'Gotowe: 19 wydarzeń [TEST-J]. Zaloguj się jako j4n.brz0@gmail.com.';
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[TEST-J]%'
   AND lat IS NULL
   AND field_id IS NULL;


-- Podgląd tego, co powstało.
SELECT format('%s | %s | %s',
  to_char(event_date, 'DD.MM'),
  coalesce(title, '(bez tytułu)'),
  CASE status WHEN 'cancelled' THEN 'ODWOŁANY' ELSE
    CASE WHEN event_date < CURRENT_DATE THEN 'rozegrany' ELSE 'nadchodzący' END END) AS wynik
FROM events
WHERE description LIKE '[TEST-J]%'
ORDER BY event_date;


-- ─────────────────────────────────────────────────────────────────────────
-- seed_regresja.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — SCENARIUSZE REGRESYJNE po refaktorze (etapy 1–3)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker "[REG]" w opisie) i tworzy wszystko od nowa.
--
-- PO CO TO JEST
-- Refaktor ruszył przepływy, których nie widać w testach jednostkowych:
-- dołączanie (teraz jedna funkcja bazodanowa), kolejka rezerwowa, tryby miejsc
-- dla bramkarzy, akceptacja próśb, przejmowanie wpisu gościa, warstwy okien.
-- Każdy scenariusz niżej to JEDEN mecz ustawiony tak, żeby dało się sprawdzić
-- dokładnie jedną rzecz — a opis meczu mówi, co kliknąć i czego oczekiwać.
--
-- WYMAGANIA
--   • migracje do `078` włącznie uruchomione,
--   • konta test1..test10@example.com (supabase/seed-test-users.sql),
--   • konto franekks@gmail.com (Twoje — jesteś organizatorem większości).
--
-- JAK PRZEZ TO PRZEJŚĆ
-- Wejdź na /moje-gry. Wszystkie mecze mają w tytule numer scenariusza
-- („R01 …", „R02 …"), więc idziesz po kolei z góry na dół. Opis każdego meczu
-- zaczyna się od „SPRAWDŹ:" i kończy oczekiwanym wynikiem. Do scenariuszy
-- wymagających drugiego użytkownika loguj się na test1@example.com (hasło
-- `test1234`) w oknie prywatnym — dzięki temu obie sesje żyją równolegle.
--
-- Kolejność jest celowa: od najprostszych zapisów, przez rezerwę i role,
-- po prośby o akceptację i przypadki brzegowe interfejsu.
--
-- UWAGA NA NAZWY KOLUMN: w bazie jest `cost_grosz` i `sports_card_discount_grosz`
-- (liczba pojedyncza), choć w TypeScripcie pola nazywają się `costGrosze`
-- i `sportsCardDiscountGrosze`. Ta niespójność jest opisana w AGENTS.md i łatwo
-- się na niej przejechać przy pisaniu SQL-a z pamięci.
-- ============================================================

DO $$
DECLARE
  ja   UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  t1   UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  t2   UUID := (SELECT id FROM auth.users WHERE email = 'test2@example.com');
  t3   UUID := (SELECT id FROM auth.users WHERE email = 'test3@example.com');
  t4   UUID := (SELECT id FROM auth.users WHERE email = 'test4@example.com');
  t5   UUID := (SELECT id FROM auth.users WHERE email = 'test5@example.com');
  t6   UUID := (SELECT id FROM auth.users WHERE email = 'test6@example.com');
  t7   UUID := (SELECT id FROM auth.users WHERE email = 'test7@example.com');
  t8   UUID := (SELECT id FROM auth.users WHERE email = 'test8@example.com');
  t9   UUID := (SELECT id FROM auth.users WHERE email = 'test9@example.com');
  t10  UUID := (SELECT id FROM auth.users WHERE email = 'test10@example.com');

  ja_n TEXT; n1 TEXT; n2 TEXT; n3 TEXT; n4 TEXT; n5 TEXT;
  n6 TEXT; n7 TEXT; n8 TEXT; n9 TEXT; n10 TEXT;

  eid UUID;
  i INT;
  brak TEXT[] := '{}';   -- migracje, których brakuje w bazie (patrz sprawdzenie niżej)
BEGIN
  -- SPRAWDZENIE SCHEMATU. Migracje uruchamia się w tym repo RĘCZNIE, więc baza
  -- bywa starsza niż plik, który do niej wklejasz. Bez tego seed wywraca się
  -- dopiero w środku, na pierwszym INSERT-cie dotykającym nowej kolumny,
  -- komunikatem Postgresa „column ... does not exist" — a ten mówi, CZEGO nie
  -- ma, i nie mówi ani DLACZEGO, ani co z tym zrobić. Przyczyna jest zawsze ta
  -- sama: migracja nie została puszczona. Sprawdzamy więc po jednym znaczniku
  -- na migrację i wypisujemy WSZYSTKIE braki naraz, żeby nie odkrywać ich po
  -- jednym, przebieg po przebiegu.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'events'
                    AND column_name = 'reserve_claim_minutes') THEN
    brak := brak || CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'events'
                      AND column_name = 'reserve_claim_hours')
      THEN '118_rezerwa_czas_w_minutach.sql — w bazie siedzi jeszcze stara kolumna reserve_claim_hours (godziny)'
      ELSE '118_rezerwa_czas_w_minutach.sql — brak kolumny events.reserve_claim_minutes'
    END::text;
  ELSIF EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.events'::regclass
                   AND conname = 'events_reserve_claim_hours_check') THEN
    -- Kolumna ma nową nazwę, ale wisi na niej ograniczenie z `058` (CHECK 1..72)
    -- — czyli `118` przeszła tylko w połowie (sama zmiana nazwy, bez
    -- przeliczenia na minuty). Bez tej gałęzi seed wywala się dopiero na
    -- „violates check constraint events_reserve_claim_hours_check".
    brak := brak || '118_rezerwa_czas_w_minutach.sql — przeszła tylko w połowie: kolumna ma nową nazwę, ale zostało ograniczenie CHECK 1..72 i wartości w godzinach (puść CAŁY plik jeszcze raz, jest odporny na powtórzenie)'::text;
  END IF;
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF t1 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10 — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;

  -- Kasowanie poprzedniego przebiegu siedzi ZA sprawdzeniami — nieudany seed
  -- ma zostawić bazę taką, jaką zastał, zamiast wyczyścić stare dane i nie
  -- postawić nowych.
  DELETE FROM events WHERE description LIKE '[REG]%';

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Franek');
  n1  := COALESCE((SELECT display_name FROM profiles WHERE id = t1),  'Test 1');
  n2  := COALESCE((SELECT display_name FROM profiles WHERE id = t2),  'Test 2');
  n3  := COALESCE((SELECT display_name FROM profiles WHERE id = t3),  'Test 3');
  n4  := COALESCE((SELECT display_name FROM profiles WHERE id = t4),  'Test 4');
  n5  := COALESCE((SELECT display_name FROM profiles WHERE id = t5),  'Test 5');
  n6  := COALESCE((SELECT display_name FROM profiles WHERE id = t6),  'Test 6');
  n7  := COALESCE((SELECT display_name FROM profiles WHERE id = t7),  'Test 7');
  n8  := COALESCE((SELECT display_name FROM profiles WHERE id = t8),  'Test 8');
  n9  := COALESCE((SELECT display_name FROM profiles WHERE id = t9),  'Test 9');
  n10 := COALESCE((SELECT display_name FROM profiles WHERE id = t10), 'Test 10');

-- ============================================================
-- A. DOŁĄCZANIE — podstawa (migracja 078)
-- ============================================================

  -- R01 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 3, '18:00', 10, 'public',
    'R01 — puste miejsca, zwykłe dołączenie',
    '[REG] SPRAWDŹ: wejdź jako test1 i kliknij „Dołącz". OCZEKIWANE: zielony komunikat „Dołączyłeś do meczu!", licznik 1/10, Twoje imię w składzie, przycisk zmienia się na „Wypisz się z meczu". Kliknij „Wypisz się" — wracasz do 0/10.',
    false)
  RETURNING id INTO eid;

  -- R02 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 3, '19:00', 4, 'public',
    'R02 — jedno wolne miejsce',
    '[REG] SPRAWDŹ: zostało dokładnie jedno miejsce. Dołącz jako test5. OCZEKIWANE: wchodzisz do SKŁADU (nie na rezerwę), licznik 4/4, napis zmienia się na „Komplet". Potem jako test6 spróbuj dołączyć — powinieneś dostać propozycję rezerwy.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);

  -- R03 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 3, '20:00', 3, 'public',
    'R03 — komplet, zapis idzie na rezerwę',
    '[REG] SPRAWDŹ: skład pełny. Jako test6 kliknij „Komplet — zapisz się na rezerwę". OCZEKIWANE: komunikat mówi WPROST „jesteś na liście rezerwowej" (nie „Dołączyłeś do meczu!"), badge „Rezerwa · 1." jest SZARY, a nad składem widać kolejkę rezerwową z Twoim numerem.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);

  -- R04 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 4, '18:00', 10, 'public',
    'R04 — jesteś już zapisany',
    '[REG] SPRAWDŹ: jako test1 jesteś już w składzie. OCZEKIWANE: nie ma przycisku „Dołącz", jest „Wypisz się z meczu". Jeśli otworzysz ten mecz w drugiej karcie i spróbujesz dołączyć ponownie — baza odrzuci z komunikatem „Jesteś już zapisany na ten mecz" (funkcja dolacz_do_meczu pilnuje tego po stronie serwera).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

  -- R05 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, status)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '18:00', 10, 'public',
    'R05 — mecz odwołany',
    '[REG] SPRAWDŹ: mecz odwołany. OCZEKIWANE: baner „Mecz został odwołany", brak możliwości dołączenia. Jako organizator masz opcję przywrócenia.',
    'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

-- ============================================================
-- B. BRAMKARZE — trzy tryby miejsc (migracja 077)
-- ============================================================

  -- R06 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 6, '18:00', 14, 'public',
    'R06 — REZERWACJA miejsc: komplet w polu, wolne u bramkarzy',
    '[REG] SPRAWDŹ: 12 zawodników w polu, limit pola wyczerpany, wolne są tylko 2 miejsca dla bramkarzy. To DOKŁADNIE ten przypadek, który zgłosiłeś. OCZEKIWANE: pod licznikiem „pole: komplet · 2 dla bramkarzy". Jako test1 wybierz „Zawodnik" — okno OSTRZEGA przed kliknięciem, że w polu jest komplet i będziesz N. w kolejce. Wybierz „Bramkarz" — ostrzeżenie znika, wchodzisz do składu.',
    true, 2, true)
  RETURNING id INTO eid;
  FOR i IN 1..12 LOOP
    INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
    VALUES (eid, NULL, 'Gracz pola ' || i, false);
  END LOOP;

  -- R07 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 6, '19:00', 14, 'public',
    'R07 — WSPÓLNA PULA: te same 12 osób, ale zawodnik wchodzi',
    '[REG] SPRAWDŹ: ustawienie identyczne jak R06, RÓŻNI SIĘ TYLKO trybem miejsc. OCZEKIWANE: pod licznikiem „dla wszystkich ról, w tym do 2 dla bramkarzy". Jako test1 wybierz „Zawodnik" — BRAK ostrzeżenia, wchodzisz do SKŁADU (w R06 poszedłbyś na rezerwę). Porównaj oba mecze obok siebie — to jest cała różnica między trybami.',
    true, 2, false)
  RETURNING id INTO eid;
  FOR i IN 1..12 LOOP
    INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
    VALUES (eid, NULL, 'Gracz pola ' || i, false);
  END LOOP;

  -- R08 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 6, '20:00', 14, 'public',
    'R08 — komplet bramkarzy, miejsca w polu wolne',
    '[REG] SPRAWDŹ: 2 bramkarzy (limit), 3 w polu. OCZEKIWANE: pod licznikiem „9 w polu · bramkarze: komplet". Jako test1 wybierz „Bramkarz" — okno ostrzega, że bramkarze mają komplet i trafisz na rezerwę. Wybierz „Zawodnik" — wchodzisz normalnie.',
    true, 2, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
  VALUES (eid, NULL, 'Bramkarz A', true), (eid, NULL, 'Bramkarz B', true),
         (eid, NULL, 'Pole A', false), (eid, NULL, 'Pole B', false), (eid, NULL, 'Pole C', false);

  -- R09 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 7, '18:00', 10, 'public',
    'R09 — bez podziału na role',
    '[REG] SPRAWDŹ: rozróżnianie bramkarzy WYŁĄCZONE. OCZEKIWANE: w oknie dołączania NIE MA wyboru roli, w składzie nikt nie ma plakietki „BR" ani „POLE", pod licznikiem nie ma rozbicia na role.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);

  -- R10 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 7, '19:00', 8, 'public',
    'R10 — plakietki ról w składzie',
    '[REG] SPRAWDŹ: skład ma bramkarza i zawodników z pola. OCZEKIWANE: bramkarz ma zieloną plakietkę „🧤 BR", każdy zawodnik z pola ma szarą „⚽ POLE". Wcześniej pole nie miało nic i jego rola czytała się jak brak danych.',
    true, 2, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
  VALUES (eid, ja, ja_n, true), (eid, t1, n1, false), (eid, t2, n2, false);

-- ============================================================
-- C. KOLEJKA REZERWOWA — awans, oferta, ręczne przesuwanie
-- ============================================================

  -- R11 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 8, '18:00', 3, 'public',
    'R11 — zwolnienie miejsca uruchamia kolejkę',
    '[REG] SPRAWDŹ: skład pełny (3/3), w kolejce rezerwowej stoi test5, za nim test6. Jako test1 kliknij „Wypisz się z meczu". OCZEKIWANE: test5 dostaje ofertę — zaloguj się na test5 i sprawdź: zielona karta „Zwolniło się miejsce — jesteś następny!", powiadomienie pod dzwonkiem, licznik nadal 3/3 (miejsce jest TRZYMANE, nie wolne). Przyjmij ofertę — wchodzisz do składu.',
    180)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, t5, n5, true, now() - interval '2 hours'),
         (eid, t6, n6, true, now() - interval '1 hour');

  -- R12 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 8, '19:00', 4, 'public',
    'R12 — ręczny awans z rezerwy (organizator)',
    '[REG] SPRAWDŹ: jesteś organizatorem, jest jedno wolne miejsce, a w kolejce trzy osoby. OCZEKIWANE: przy każdej osobie na liście rezerwowej widzisz przycisk „Do składu". Kliknij go przy test7 (TRZECIEJ w kolejce, poza kolejnością) — wchodzi do składu bez pytania, licznik rośnie. To była funkcja, której brakowało.',
    180)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, t5, n5, true, now() - interval '3 hours'),
         (eid, t6, n6, true, now() - interval '2 hours'),
         (eid, t7, n7, true, now() - interval '1 hour');

  -- R13 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 8, '20:00', 3, 'public',
    'R13 — awans PONAD limit wymaga potwierdzenia',
    '[REG] SPRAWDŹ: skład pełny (3/3), w kolejce test5. Kliknij „Do składu". OCZEKIWANE: pytanie „Skład jest już zajęty. Dodać … mimo to?". Potwierdź — licznik pokazuje 4/3. Organizator MOŻE przekroczyć limit, ale nie przez przypadek.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES (eid, t5, n5, true);

  -- R14 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 9, '18:00', 10, 'public',
    'R14 — cofnięcie ze składu na rezerwę',
    '[REG] SPRAWDŹ: w sekcji „Zarządzanie graczami" przy każdym graczu są DWA przyciski. OCZEKIWANE: „Na rezerwę" przenosi gracza do kolejki (zostaje w meczu, traci miejsce), „Usuń" wyrzuca z meczu. Kliknij „Na rezerwę" przy test1 — znika ze składu, pojawia się w kolejce rezerwowej.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);

  -- R15 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 9, '19:00', 6, 'public',
    'R15 — dwie osobne kolejki: pole i bramkarze',
    '[REG] SPRAWDŹ: na rezerwie stoi bramkarz (test5) i zawodnik z pola (test6). Skład ma komplet bramkarzy i jedno wolne miejsce w polu. OCZEKIWANE: przy każdej osobie w kolejce widać jej rolę. Wypisz zawodnika z pola ze składu — ofertę dostaje test6 (pole), NIE test5, mimo że stoi wyżej w kolejce.',
    true, 2, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
  VALUES (eid, ja, ja_n, true), (eid, NULL, 'Bramkarz B', true),
         (eid, t1, n1, false), (eid, t2, n2, false), (eid, t3, n3, false);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, is_goalkeeper, created_at)
  VALUES (eid, t5, n5, true, true,  now() - interval '2 hours'),
         (eid, t6, n6, true, false, now() - interval '1 hour');

  -- R16 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 9, '20:00', 4, 'public',
    'R16 — ktoś przepuścił swoją kolej',
    '[REG] SPRAWDŹ: test5 dostał ofertę i ją odpuścił (chip „przepuścił(a)"), więc kolejka poszła dalej. OCZEKIWANE: test5 ma szary chip „przepuścił(a)" i NIE blokuje kolejki, ale organizator nadal może go awansować ręcznie przyciskiem „Do składu".',
    180)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2), (eid, t3, n3);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_passed, created_at)
  VALUES (eid, t5, n5, true, true, now() - interval '5 hours');
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, t6, n6, true, now() - interval '1 hour');

-- ============================================================
-- D. OBSERWOWANIE — nie jest rezerwą
-- ============================================================

  -- R17 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 10, '18:00', 10, 'public',
    'R17 — obserwujący NIE jest rezerwowym',
    '[REG] SPRAWDŹ: test5 obserwuje ten mecz. OCZEKIWANE: test5 NIE pojawia się na liście rezerwowej (to był Twój błąd „kliknąłem obserwuj, a pokazuje rezerwa"), a jego badge jest BURSZTYNOWY „Obserwujesz", nie szary „Rezerwa". Licznik nie liczy go jako zajmującego miejsce.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, rsvp)
  VALUES (eid, t5, n5, true, 'maybe');

  -- R18 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, cost_grosz, accepted_payment_methods)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 10, '19:00', 10, 'public',
    'R18 — obserwujący przechodzi do składu',
    '[REG] SPRAWDŹ: jako test5 obserwujesz ten płatny mecz. Kliknij „Dołącz". OCZEKIWANE: okno pyta o sposób płatności tak samo jak przy zwykłym zapisie, a po potwierdzeniu wchodzisz do składu i znika badge „Obserwujesz".',
    1500, ARRAY['gotowka','blik']::text[])
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, rsvp)
  VALUES (eid, t5, n5, true, 'maybe');

-- ============================================================
-- E. PROŚBY O AKCEPTACJĘ
-- ============================================================

  -- R19 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 11, '18:00', 10, 'public',
    'R19 — prośby czekają na Twoją decyzję',
    '[REG] SPRAWDŹ: dwie osoby czekają na akceptację. OCZEKIWANE: (1) na /moje-gry sekcja „Czekają na Twoją decyzję" STOI NAD „Brakuje graczy" i pokazuje ten mecz z liczbą 2; (2) na stronie meczu widzisz obie prośby z przyciskami; (3) po akceptacji gracz wchodzi do składu, po odrzuceniu znika.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, pending_approval)
  VALUES (eid, t5, n5, true), (eid, t6, n6, true);

  -- R20 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 11, '19:00', 3, 'public',
    'R20 — akceptacja przy pełnym składzie idzie na rezerwę',
    '[REG] SPRAWDŹ: skład pełny (3/3), a test5 czeka na akceptację. Zaakceptuj go. OCZEKIWANE: trafia na REZERWĘ, nie do składu — decyzję podejmuje ta sama funkcja bazodanowa co przy zwykłym zapisie, więc limit obowiązuje też tutaj.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);
  INSERT INTO event_participants (event_id, user_id, name, pending_approval) VALUES (eid, t5, n5, true);

  -- R21 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 12, '18:00', 10, 'public',
    'R21 — organizator NIE akceptuje sam siebie',
    '[REG] SPRAWDŹ: mecz wymaga akceptacji, ale Ciebie w składzie nie ma. Kliknij „Dołącz" jako organizator. OCZEKIWANE: wchodzisz OD RAZU do składu, bez własnej prośby o akceptację i bez komunikatu o czekaniu. Wcześniej wisiałeś we własnej kolejce.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, t1, n1);

-- ============================================================
-- F. PŁATNOŚCI
-- ============================================================

  -- R22 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 12, '19:00', 10, 'public',
    'R22 — bez wyboru płatności nie da się zapisać',
    '[REG] SPRAWDŹ: mecz płatny (15 zł), dwie metody. Jako test1 otwórz okno dołączania i NIE wybieraj metody. OCZEKIWANE: przycisk „Zapisz mnie" jest NIEAKTYWNY, pod nim napis „Wybierz sposób płatności, żeby się zapisać". Po wybraniu BLIK pojawia się numer i przycisk się odblokowuje.',
    1500, ARRAY['gotowka','blik']::text[])
  RETURNING id INTO eid;
  -- Numer BLIK od migracji `120` mieszka w osobnej tabeli (RLS — patrz `121`).
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '555111222');
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R23 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, cost_grosz)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 12, '20:00', 10, 'public',
    'R23 — mecz płatny bez listy metod',
    '[REG] SPRAWDŹ: koszt jest, ale organizator nie wskazał metod płatności. OCZEKIWANE: okno dołączania pokazuje koszt, ale NIE wymaga wyboru metody — przycisk „Zapisz mnie" działa od razu.',
    2000)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R24 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, accepted_sports_cards, sports_card_discount_grosz)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 13, '18:00', 10, 'public',
    'R24 — karta sportowa i zniżka',
    '[REG] SPRAWDŹ: mecz 20 zł, zniżka 10 zł dla karty. Jako test1 zaznacz „Mam kartę sportową". OCZEKIWANE: kwota w oknie przelicza się na 10 zł (przekreślone 20 zł), a po zapisie organizator widzi Twoją deklarację przy rozliczeniu.',
    2000, ARRAY['gotowka']::text[], ARRAY['multisport']::text[], 1000)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R25 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 13, '19:00', 10, 'public',
    'R25 — odznaczanie wpłat',
    '[REG] SPRAWDŹ: czterech graczy, śledzenie płatności włączone. OCZEKIWANE: jako organizator odznaczasz „zapłacone" przy graczu i stan ZOSTAJE po odświeżeniu strony. Gdyby polityka RLS nie pozwalała, dostaniesz teraz konkretny komunikat zamiast ciszy — to jedna z rzeczy naprawionych w refaktorze.',
    1500, ARRAY['gotowka']::text[], true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name)
  VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2), (eid, t3, n3);

-- ============================================================
-- G. GOŚCIE BEZ KONTA I PRZEJMOWANIE WPISU
-- ============================================================

  -- R26 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 14, '18:00', 10, 'public',
    'R26 — zaproszenie gościa do przejęcia wpisu',
    '[REG] SPRAWDŹ: w składzie są dwaj goście bez konta. OCZEKIWANE: (1) nad składem widzisz „2 gości bez konta w składzie"; (2) przy imieniu jest „Zaproś do Bojo"; (3) po kliknięciu treść wiadomości mówi KTO zaprasza (Twoje imię), jest w czasie PRZYSZŁYM i wymienia: ekipę i powiadomienia, własne gry, przeglądanie otwartych gier. NIE ma tam „zagraliście razem" ani „zobaczysz swój udział".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, claim_token)
  VALUES (eid, NULL, 'Kozak', true, ja, gen_random_uuid()),
         (eid, NULL, 'Mały', true, ja, gen_random_uuid());
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R27 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, allow_guest_adds)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 14, '19:00', 10, 'public',
    'R27 — gość dopisany przez UCZESTNIKA, nie organizatora',
    '[REG] SPRAWDŹ: gość „Znajomy Test1" został dopisany przez test1, nie przez Ciebie. OCZEKIWANE: pod jego imieniem widać „dodał(a): <imię test1>", a w treści zaproszenia do przejęcia wpisu podpisuje się TEST1, nie organizator. To był świadomy wybór: podpis cudzym nazwiskiem myli bardziej niż jego brak.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, claim_token)
  VALUES (eid, NULL, 'Znajomy Test1', true, t1, gen_random_uuid());

  -- R28 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 15, '18:00', 3, 'public',
    'R28 — gość dopisany przy komplecie idzie na rezerwę',
    '[REG] SPRAWDŹ: skład pełny. Dopisz gościa („Dopisz osobę bez konta"). OCZEKIWANE: komunikat mówi, że gość trafił na rezerwę, i faktycznie pojawia się w kolejce, nie w składzie. Limit obowiązuje tak samo jak przy zapisie z konta.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1), (eid, t2, n2);

-- ============================================================
-- H. INTERFEJS — warstwy okien, przewijanie, teksty
-- ============================================================

  -- R29 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, cost_grosz, accepted_payment_methods)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 15, '19:00', 18, 'public',
    'R29 — okna nad paskiem nawigacji (długa strona)',
    '[REG] SPRAWDŹ NA TELEFONIE: 16 graczy, długa strona do przewijania. OCZEKIWANE: (1) okno „Wypisać się z meczu?" wyświetla się NAD dolnym paskiem nawigacji i przycisk potwierdzenia da się kliknąć; (2) tło NIE przewija się pod otwartym oknem; (3) po zamknięciu wracasz w to samo miejsce strony. To była regresja, przez którą przycisk „Dołącz" przestał działać.',
    1000, ARRAY['gotowka','blik']::text[])
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  FOR i IN 1..15 LOOP
    INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, NULL, 'Gracz ' || i);
  END LOOP;

  -- R30 --------------------------------------------------------------
  -- `custom_address`, nie `field_address`: ta druga kolumna nie istnieje
  -- w tabeli `events` — adres obiektu z katalogu przychodzi ze złączenia
  -- z `fields`, a adres wpisany ręcznie siedzi właśnie w `custom_address`.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, custom_address,
                      event_date, event_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna',
    'Szkoła Podstawowa numer 5 imienia profesora Adama Wodziczki — boisko piłkarskie',
    'ul. Pawia 10, Swarzędz',
    CURRENT_DATE + 16, '18:00', 10, 'public',
    'R30 — długa nazwa obiektu',
    '[REG] SPRAWDŹ: obiekt ma bardzo długą nazwę i osobny adres. OCZEKIWANE: kafelek w nagłówku pokazuje NAZWĘ obiektu (nie „ul. Pawia"), obcina ją wielokropkiem przy prawej krawędzi i nie rozpycha karty. Na liście gier nazwa też się nie urywa w połowie wolnego miejsca.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R31 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '18:00', 10, 'public',
    'R31 — odmiana liczebników (2 wolne miejsca)',
    '[REG] SPRAWDŹ: 8 z 10 miejsc zajętych. OCZEKIWANE: „Zostało 2 wolne miejsca" (nie „2 wolnych miejsc"), a w nagłówku listy „8 graczy". Sprawdź też mecz R32 — tam liczby wypadają w innej formie gramatycznej.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  FOR i IN 1..7 LOOP
    INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, NULL, 'Gracz ' || i);
  END LOOP;

  -- R32 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 2, '18:00', 20, 'public',
    'R32 — odmiana liczebników (5 wolnych miejsc, 1 gracz)',
    '[REG] SPRAWDŹ: 15 z 20 miejsc zajętych. OCZEKIWANE: „Zostało 5 wolnych miejsc" i „15 graczy". Przy jednym wolnym miejscu ma być „1 wolne miejsce", przy jednym graczu „1 gracz". Reguła polska: 1 / 2–4 / 5+, z wyjątkiem 12–14.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  FOR i IN 1..14 LOOP
    INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, NULL, 'Gracz ' || i);
  END LOOP;

  -- R33 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 2, '20:00', 10, 'private',
    'R33 — mecz prywatny',
    '[REG] SPRAWDŹ: mecz prywatny. OCZEKIWANE: nie pojawia się na liście otwartych gier (/wydarzenia), ale wchodzisz na niego linkiem. Badge „Prywatne" w nagłówku, dla organizatora klikalny.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

-- ============================================================
-- I. SORTOWANIE I LISTY
-- ============================================================

  -- R34..R36 — trzy mecze w odwrotnej kolejności dat -------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 20, '18:00', 10, 'public',
    'R34 — najdalszy termin (ma być NA DOLE listy)',
    '[REG] SPRAWDŹ: na /moje-gry ten mecz ma być POD R35 i R36. OCZEKIWANE: „Twoje najbliższe mecze" idą od najbliższego terminu. Wcześniej lista szła odwrotnie i „najbliższy mecz" nad listą pokazywał inny termin niż pierwsza karta pod nim.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 10, '18:00', 10, 'public',
    'R35 — termin pośredni (ma być W ŚRODKU)',
    '[REG] SPRAWDŹ: patrz R34. Ten mecz ma stać między R36 a R34.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE, '23:30', 10, 'public',
    'R36 — najbliższy termin (ma być NA GÓRZE listy)',
    '[REG] SPRAWDŹ: patrz R34. Ten mecz ma stać najwyżej i to on ma być „najbliższym meczem" w kafelku nad listą.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- R37 — historia -----------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE - 2, '18:00', 10, 'public',
    'R37 — historia: wczorajszy mecz NA GÓRZE',
    '[REG] SPRAWDŹ: zakładka „Historia" na /moje-gry. OCZEKIWANE: ten mecz stoi NAD R38 (starszym). Historia idzie od ostatnio rozegranego — odwrotnie niż nadchodzące.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

  -- R38 — starsza historia ---------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE - 20, '18:00', 10, 'public',
    'R38 — historia: mecz sprzed trzech tygodni (NA DOLE)',
    '[REG] SPRAWDŹ: patrz R37.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

-- ============================================================
-- J. PRZYPADKI BRZEGOWE
-- ============================================================

  -- R39 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 17, '18:00', 2, 'public',
    'R39 — mecz 1v1 z rezerwacją miejsc dla bramkarzy',
    '[REG] SPRAWDŹ: 2 miejsca, oba zarezerwowane dla bramkarzy (limit 2). OCZEKIWANE: zawodnik z pola nie ma gdzie wejść — okno ostrzega, że w polu jest komplet (zero miejsc). To konfiguracja skrajna; ma nie wywalać strony ani nie pokazywać ujemnych liczb.',
    true, 2, true)
  RETURNING id INTO eid;

  -- R40 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 17, '19:00', 10, 'public',
    'R40 — pusty mecz, tylko organizator poza składem',
    '[REG] SPRAWDŹ: nikogo w składzie. OCZEKIWANE: „Nikt jeszcze nie dołączył — bądź pierwszy!", licznik 0/10, tekst „10 wolnych miejsc". Jako organizator masz od razu rozwiniętą listę i pole „Dopisz osobę bez konta".')
  RETURNING id INTO eid;

  -- R41 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 18, '18:00', 4, 'public',
    'R41 — pusty skład, ale ktoś stoi w kolejce',
    '[REG] SPRAWDŹ: skład pusty, a na rezerwie stoją dwie osoby (tak wygląda mecz, na który organizator zapisał się jako rezerwowy). OCZEKIWANE: NIE MA napisu „Nikt jeszcze nie dołączył — bądź pierwszy!". Zamiast tego widać, ile osób jest na rezerwie, i da się rozwinąć listę. Wcześniej rezerwowi byli w tej sytuacji niewidoczni.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, t5, n5, true, now() - interval '2 hours'),
         (eid, t6, n6, true, now() - interval '1 hour');

  -- R42 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE, '06:00', 10, 'public',
    'R42 — mecz już się zaczął',
    '[REG] SPRAWDŹ: termin dzisiaj rano, czyli po starcie. OCZEKIWANE: „Mecz już się rozpoczął — zapisy zamknięte", brak przycisku „Dołącz", brak przycisków awansu z rezerwy.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

  -- R43 --------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (ja, ja_n, 'siatkówka', 'Hala Arena', CURRENT_DATE + 18, '19:00', 12, 'public',
    'R43 — sport bez bramkarza',
    '[REG] SPRAWDŹ: siatkówka. OCZEKIWANE: nigdzie nie ma mowy o bramkarzach — ani w oknie dołączania, ani w składzie, ani w liczniku. W kreatorze nowego meczu dla siatkówki pytanie o bramkarzy też się nie pojawia.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n), (eid, t1, n1);

  RAISE NOTICE 'Gotowe: 43 scenariusze regresyjne. Wejdź na /moje-gry i idź po kolei od R01.';
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[REG]%'
   AND lat IS NULL
   AND field_id IS NULL;


-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  split_part(title, ' — ', 2)  AS scenariusz,
  event_date                   AS termin,
  max_players                  AS miejsc,
  (SELECT count(*) FROM event_participants p
    WHERE p.event_id = e.id AND NOT p.is_reserve AND NOT p.pending_approval
      AND p.rsvp <> 'maybe')   AS w_skladzie,
  (SELECT count(*) FROM event_participants p
    WHERE p.event_id = e.id AND p.is_reserve AND p.rsvp <> 'maybe') AS rezerwa,
  (SELECT count(*) FROM event_participants p
    WHERE p.event_id = e.id AND p.pending_approval) AS czeka_na_zgode,
  '/wydarzenia/' || e.id       AS adres
FROM events e
WHERE description LIKE '[REG]%'
ORDER BY title;


-- ─────────────────────────────────────────────────────────────────────────
-- seed_taktyka.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — SCENARIUSZE DO ZAKŁADKI „TAKTYKA" (migracja 103)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[TAK]" w opisie) i tworzy wszystko od nowa.
--
-- PO CO TO JEST
-- Zakładka „Taktyka" pojawia się dopiero po opublikowaniu składów, więc żeby
-- ją w ogóle zobaczyć, trzeba mieć mecz z podziałem na drużyny. Ręczne
-- klikanie takiego meczu (utwórz → zapisz dziesięć osób → podziel → opublikuj)
-- zajmuje kilka minut ZA KAŻDYM RAZEM, a sprawdzić trzeba kilkanaście
-- wariantów: różne wielkości składu, różne sporty, nierówne drużyny, długie
-- nazwiska. Ten skrypt stawia je wszystkie naraz.
--
-- WYMAGANIA
--   • migracje do `103` włącznie uruchomione,
--   • konta test1..test10@example.com (supabase/seed-test-users.sql),
--   • konto franekks@gmail.com — organizator wszystkich meczów,
--   • konto franciszekpudelko@gmail.com — ZAPISANE do każdego meczu jako
--     KAPITAN drużyny Zielonych (A), czyli to, na którym realnie klikasz.
--     Mecze są PRYWATNE, więc widzi je organizator i uczestnicy; bez zapisania
--     nie zobaczyłbyś ich wcale. Kapitan, bo od migracji `105` taktykę ustawia
--     wyłącznie on — reszcie drużyny wyświetla się gotowy opis.
--
-- WAŻNE: zakładkę „Taktyka" widzi ten, kto GRA w meczu i ma przypisaną
-- drużynę — i widzi wyłącznie SWOJĄ. Uprawnienia administratora nie mają tu
-- już nic do rzeczy (do migracji `104` włącznie było odwrotnie).
--
-- JAK PRZEZ TO PRZEJŚĆ
-- Wejdź na /moje-gry. Mecze mają w tytule numer („T01 …"), a opis zaczyna się
-- od „SPRAWDŹ:" i kończy oczekiwanym wynikiem. T01–T09 to warianty do
-- obejrzenia, T10–T13 to przypadki brzegowe, w których coś ma się NIE pojawić
-- albo nie rozjechać. Na końcu pliku jest zapytanie z listą kontrolną
-- i adresami.
-- ============================================================

DELETE FROM events WHERE description LIKE '[TAK]%';

DO $$
DECLARE
  ja   UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  t1   UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  t2   UUID := (SELECT id FROM auth.users WHERE email = 'test2@example.com');
  t3   UUID := (SELECT id FROM auth.users WHERE email = 'test3@example.com');
  t4   UUID := (SELECT id FROM auth.users WHERE email = 'test4@example.com');
  t5   UUID := (SELECT id FROM auth.users WHERE email = 'test5@example.com');
  t6   UUID := (SELECT id FROM auth.users WHERE email = 'test6@example.com');
  t7   UUID := (SELECT id FROM auth.users WHERE email = 'test7@example.com');
  t8   UUID := (SELECT id FROM auth.users WHERE email = 'test8@example.com');
  t9   UUID := (SELECT id FROM auth.users WHERE email = 'test9@example.com');
  t10  UUID := (SELECT id FROM auth.users WHERE email = 'test10@example.com');

  -- Konto, które ma być ZAPISANE do wszystkich meczów. Osobne od organizatora:
  -- mecze zakłada `franekks`, a gra i ogląda je `franciszekpudelko` — czyli
  -- to konto, na którym realnie klikasz w telefonie.
  fp   UUID := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');

  ja_n TEXT;
  fp_n TEXT;
  eid  UUID;
BEGIN
  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF t1 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10 — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;
  IF fp IS NULL THEN
    RAISE EXCEPTION 'Brak konta franciszekpudelko@gmail.com w auth.users — zaloguj się na nie raz do aplikacji.';
  END IF;

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Franek');
  fp_n := COALESCE((SELECT display_name FROM profiles WHERE id = fp), 'Franciszek');

-- ============================================================
-- A. RÓŻNE WIELKOŚCI SKŁADU — czy boisko się mieści na telefonie
-- ============================================================

  -- T01: najczęstszy przypadek w Bojo -----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '19:00', 10, 'private',
    'T01 — 5v5, składy opublikowane',
    '[TAK] SPRAWDŹ: zakładka „Taktyka" jest widoczna, a w niej DWA boiska (Zieloni i Pomarańczowi). OCZEKIWANE: domyślne ustawienie 2-2, pigułki do wyboru tylko na 5 i 6 graczy, wszyscy gracze na dole w „Bez pozycji". Stuknij pozycję, potem gracza — nazwisko ląduje na boisku, a lista pod spodem się skraca.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp,  fp_n,     'A'), (eid, t1, 'Kuba Nowak',      'A'),
    (eid, t2,  'Michał Zieliński', 'A'), (eid, t3, 'Paweł Krupa', 'A'),
    (eid, t4,  'Bartek Sobczyk',   'A'),
    (eid, t5,  'Adam Wierzba',     'B'), (eid, t6, 'Filip Rak',   'B'),
    (eid, t7,  'Janek Bąk',        'B'), (eid, t8, 'Olek Duda',   'B'),
    (eid, t9,  'Tomek Wilk',       'B');

  -- T02: siódemka — najczęstsza przy większym orliku ---------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 3, '20:00', 14, 'private',
    'T02 — 7v7 z bramkarzami',
    '[TAK] SPRAWDŹ: dwóch graczy ma rolę bramkarza. OCZEKIWANE: na liście „Bez pozycji" bramkarze mają rękawicę 🧤, a pigułki ustawień pokazują warianty na 7 i 8 (3-2-1, 2-3-1, 3-1-2). Ustaw bramkarza na pozycji BR i sprawdź, czy inicjały na kółku są czytelne.',
    true, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp,  fp_n,               'A', true),  (eid, t1, 'Kuba Nowak',       'A', false),
    (eid, t2,  'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa',      'A', false),
    (eid, t4,  'Bartek Sobczyk',   'A', false), (eid, t5, 'Adam Wierzba',     'A', false),
    (eid, t6,  'Filip Rak',        'A', false),
    (eid, t7,  'Janek Bąk',        'B', true),  (eid, t8, 'Olek Duda',        'B', false),
    (eid, t9,  'Tomek Wilk',       'B', false), (eid, t10, 'Rafał Zych',      'B', false);
  INSERT INTO event_participants (event_id, name, is_guest, team, is_goalkeeper) VALUES
    (eid, 'Gość Marek',   true, 'B', false),
    (eid, 'Gość Sebastian', true, 'B', false),
    (eid, 'Gość Wojtek',  true, 'B', false);

  -- T03: pełna jedenastka — najciaśniejszy możliwy widok ------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Stadion Miejski', CURRENT_DATE + 4, '17:00', 22, 'private',
    'T03 — 11v11, najciaśniejsze boisko',
    '[TAK] SPRAWDŹ: to jest test czytelności. Ustaw 4-4-2, potem 4-2-3-1 i 3-5-2. OCZEKIWANE: kółka się nie nachodzą, nazwiska nie wychodzą poza murawę, skrajni obrońcy mieszczą się w kadrze. Jeśli coś się zlewa — to jest właśnie ten scenariusz, o którym trzeba mi powiedzieć.',
    true, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp, fp_n, 'A', true), (eid, t1, 'Kuba Nowak', 'A', false),
    (eid, t2, 'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa', 'A', false),
    (eid, t4, 'Bartek Sobczyk', 'A', false), (eid, t5, 'Adam Wierzba', 'A', false),
    (eid, t6, 'Filip Rak', 'B', true), (eid, t7, 'Janek Bąk', 'B', false),
    (eid, t8, 'Olek Duda', 'B', false), (eid, t9, 'Tomek Wilk', 'B', false),
    (eid, t10, 'Rafał Zych', 'B', false);
  -- Reszta jako goście, żeby dobić do 11+11 bez zakładania kolejnych kont.
  INSERT INTO event_participants (event_id, name, is_guest, team)
  SELECT eid, 'Gracz A' || i, true, 'A' FROM generate_series(6, 10) AS i;
  -- Drużyna B ma o jednego konta mniej (t6..t10 to pięć osób wobec sześciu
  -- w A), więc dobija się o jednego gościa więcej — inaczej wyszłoby 11 vs 10
  -- i scenariusz „najciaśniejsze boisko" testowałby ciasno tylko po jednej
  -- stronie.
  INSERT INTO event_participants (event_id, name, is_guest, team)
  SELECT eid, 'Gracz B' || i, true, 'B' FROM generate_series(6, 11) AS i;

  -- T04: ósemka ----------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 5, '18:30', 16, 'private',
    'T04 — 8v8',
    '[TAK] SPRAWDŹ: pigułki ustawień na 8 i 9 (3-3-1, 4-2-1, 3-3-2, 4-3-1). OCZEKIWANE: po zmianie ustawienia gracze JUŻ USTAWIENI zostają na swoich numerach pozycji — nie wracają wszyscy na ławkę. To celowe: zmiana 4-4-2 na 4-3-3 ma ruszyć tylko to, co się naprawdę zmieniło.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'),
    (eid, t5, 'Adam Wierzba', 'B'), (eid, t6, 'Filip Rak', 'B'),
    (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B');
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES
    (eid, 'Gość Adrian', true, 'A'), (eid, 'Gość Bruno', true, 'A'), (eid, 'Gość Cezary', true, 'A'),
    (eid, 'Gość Damian', true, 'B'), (eid, 'Gość Emil', true, 'B'), (eid, 'Gość Fabian', true, 'B'),
    (eid, 'Gość Gustaw', true, 'B');

-- ============================================================
-- B. INNE SPORTY
-- ============================================================

  -- T05 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'siatkówka', 'Hala Arena', CURRENT_DATE + 6, '19:00', 12, 'private',
    'T05 — siatkówka 6v6',
    '[TAK] SPRAWDŹ: siatkówka nie ma „ustawień", tylko rotację. OCZEKIWANE: jedna pigułka (3-3) z opisem o pozycjach P1–P6, sześć miejsc na boisku, ZERO mowy o bramkarzu. Jeśli boisko z liniami piłkarskimi wygląda tu głupio — to jest do zgłoszenia.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'), (eid, t5, 'Adam Wierzba', 'A'),
    (eid, t6, 'Filip Rak', 'B'), (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B'),
    (eid, t9, 'Tomek Wilk', 'B'), (eid, t10, 'Rafał Zych', 'B');
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES (eid, 'Gość Hubert', true, 'B');

  -- T06 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'koszykówka', 'Boisko Ratajczaka', CURRENT_DATE + 7, '18:00', 6, 'private',
    'T06 — koszykówka 3v3',
    '[TAK] SPRAWDŹ: mały skład, własny zestaw ustawień. OCZEKIWANE: pigułka „2" (czyli 1-2: rozgrywający i dwóch na skrzydłach), trzy miejsca na drużynę.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

-- ============================================================
-- C. PRZYPADKI BRZEGOWE — tu coś ma się NIE pojawić albo nie rozjechać
-- ============================================================

  -- T07: bez publikacji — zakładki NIE MA -------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Dębiec', CURRENT_DATE + 8, '19:00', 10, 'private',
    'T07 — składy PODZIELONE, ale NIEopublikowane',
    '[TAK] SPRAWDŹ: gracze mają przypisane drużyny, ale składy nie są opublikowane. OCZEKIWANE: zakładki „Taktyka" NIE MA w pasku. Opublikuj składy w zakładce Skład — zakładka ma się pojawić od razu, bez odświeżania strony.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

  -- T08: wszyscy w jednej drużynie --------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Grunwald', CURRENT_DATE + 9, '20:00', 10, 'private',
    'T08 — druga drużyna PUSTA',
    '[TAK] SPRAWDŹ: wszyscy trafili do drużyny Zielonych, Pomarańczowi są puści. OCZEKIWANE: przy pustej drużynie zamiast boiska stoi zdanie „Nikt nie jest przypisany do tej drużyny" — nie puste boisko i nie błąd.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A');

  -- T09: nierówne drużyny ------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Jeżyce', CURRENT_DATE + 10, '19:30', 12, 'private',
    'T09 — nierówne drużyny (6 vs 4)',
    '[TAK] SPRAWDŹ: jedna drużyna ma sześciu, druga czterech. OCZEKIWANE: każda dostaje ustawienia pod SWOJĄ liczbę graczy — sześcioosobowa inne pigułki niż czteroosobowa. Tak wygląda realny mecz, gdy dwie osoby się spóźnią.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'), (eid, t5, 'Adam Wierzba', 'A'),
    (eid, t6, 'Filip Rak', 'B'), (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B'),
    (eid, t9, 'Tomek Wilk', 'B');

  -- T10: bardzo długie nazwiska -----------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Naramowice', CURRENT_DATE + 11, '18:00', 10, 'private',
    'T10 — bardzo długie imiona i nazwiska',
    '[TAK] SPRAWDŹ: nazwiska są celowo absurdalnie długie. OCZEKIWANE: pod kółkiem na boisku widać SAMO IMIĘ (pierwszy człon), ucięte jeśli trzeba, i nie rozpycha sąsiadów. Na ławce nazwisko może być pełne — tam jest miejsce.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'),
    (eid, t1, 'Krzysztof Bączkiewicz-Wodziczko', 'A'),
    (eid, t2, 'Włodzimierz Przybyszewski', 'A'),
    (eid, t3, 'Bartłomiej Świętochowski', 'A'),
    (eid, t4, 'Aleksander Chrząszczyżewoszycki', 'A'),
    (eid, t5, 'LIONEL ANDREAS ŚREDNICKI', 'B'),
    (eid, t6, 'Maksymilian Wielkopolski', 'B'),
    (eid, t7, 'Sebastian Nieprzecinający', 'B'),
    (eid, t8, 'Grzegorz Brzęczyszczykiewicz', 'B'),
    (eid, t9, 'Konstanty Ildefons Gałczyński', 'B');

  -- T11: mecz odwołany ---------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, status)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Piątkowo', CURRENT_DATE + 12, '19:00', 10, 'private',
    'T11 — mecz ODWOŁANY z opublikowanymi składami',
    '[TAK] SPRAWDŹ: mecz odwołany, ale składy były opublikowane. OCZEKIWANE: zakładki „Taktyka" NIE MA — nie ma czego ustawiać dla meczu, który się nie odbędzie.',
    true, 'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

-- ============================================================
-- D. STAN „PO WYPEŁNIENIU" — jedyny scenariusz, którego nie da się
--    zobaczyć bez klikania przez kilka minut
-- ============================================================

  -- T12 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '19:30', 14, 'private',
    'T12 — WSZYSTKO JUŻ USTAWIONE (taktyka, pozycje, czat)',
    '[TAK] SPRAWDŹ: to jest widok „po", którego normalnie trzeba by naklikać. Obie drużyny mają ustawienie, obsadzone pozycje, wybraną taktykę, notatkę o stałych fragmentach i kilka wiadomości w czacie. OCZEKIWANE: wszystko wczytuje się od razu po wejściu w zakładkę; czat drużyny Zielonych NIE zawiera wiadomości Pomarańczowych i odwrotnie.',
    true, true)
  RETURNING id INTO eid;

  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp,  fp_n,               'A', true),  (eid, t1, 'Kuba Nowak',       'A', false),
    (eid, t2,  'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa',      'A', false),
    (eid, t4,  'Bartek Sobczyk',   'A', false), (eid, t5, 'Adam Wierzba',     'A', false),
    (eid, t6,  'Filip Rak',        'A', false),
    (eid, t7,  'Janek Bąk',        'B', true),  (eid, t8, 'Olek Duda',        'B', false),
    (eid, t9,  'Tomek Wilk',       'B', false), (eid, t10, 'Rafał Zych',      'B', false);
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES
    (eid, 'Gość Marek', true, 'B'), (eid, 'Gość Sebastian', true, 'B'), (eid, 'Gość Wojtek', true, 'B');

  -- Ustawienie i taktyka obu drużyn.
  INSERT INTO event_team_setup (event_id, team, schemat, taktyka, notatka, updated_by) VALUES
    (eid, 'A', '1-3-2-1',
      '{"krycie":"strefa","wyjscie":"krotko","pressing":"wysoki","tempo":"szybko"}'::jsonb,
      'Rożne bije Kuba, karne Michał. Stałe fragmenty krótko, bez wrzutek.', ja),
    (eid, 'B', '1-2-3-1',
      '{"krycie":"na-wlasnego","wyjscie":"dlugo","pressing":"niski","tempo":"spokojnie"}'::jsonb,
      'Gramy z kontry. Rożne bije Janek.', ja);

  -- Obsadzone pozycje: bramkarz + pierwsza linia każdej drużyny.
  -- Numery slotów odpowiadają `pozycjeZeSchematu()` z `lib/taktyka.ts`:
  -- 0 to bramkarz, potem kolejno od lewej w każdej linii.
  -- Obsadzone pozycje: bramkarz + kolejni gracze wg kolejności zapisu.
  -- `row_number() - 1` daje numery slotów zgodne z `pozycjeZeSchematu()`
  -- w `lib/taktyka.ts`: 0 to bramkarz, potem kolejno linia po linii.
  -- Świadomie NIE obsadzamy wszystkich pozycji — część ma zostać pusta, żeby
  -- było widać oba stany naraz: obsadzoną i wolną.
  INSERT INTO event_team_slots (event_id, team, slot, participant_id)
  SELECT eid, 'A', numer - 1, id FROM (
    SELECT p.id, row_number() OVER (ORDER BY p.created_at, p.name) AS numer
    FROM event_participants p WHERE p.event_id = eid AND p.team = 'A'
  ) q WHERE numer <= 5
  ON CONFLICT DO NOTHING;

  INSERT INTO event_team_slots (event_id, team, slot, participant_id)
  SELECT eid, 'B', numer - 1, id FROM (
    SELECT p.id, row_number() OVER (ORDER BY p.created_at, p.name) AS numer
    FROM event_participants p WHERE p.event_id = eid AND p.team = 'B'
  ) q WHERE numer <= 4
  ON CONFLICT DO NOTHING;

  -- Czat: osobny dla każdej drużyny — to jest cała rzecz do sprawdzenia.
  INSERT INTO event_team_messages (event_id, team, user_id, user_name, body, created_at) VALUES
    (eid, 'A', fp, fp_n, 'Gramy 3-2-1, ja na bramce. Kuba i Michał na bokach.', now() - interval '2 hours'),
    (eid, 'A', t1, 'Kuba Nowak', 'Ok. Ktoś bierze wodę?', now() - interval '1 hour 50 minutes'),
    (eid, 'A', t2, 'Michał Zieliński', 'Biorę. Będę 10 minut wcześniej.', now() - interval '1 hour 40 minutes'),
    (eid, 'B', t7, 'Janek Bąk', 'Cofamy się i gramy z kontry, nie wychodzimy wysoko.', now() - interval '1 hour 30 minutes'),
    (eid, 'B', t8, 'Olek Duda', 'Jasne. Kto na prawej obronie?', now() - interval '1 hour 20 minutes');

  -- KAPITAN: konto testowe w każdej drużynie A. Zakładkę „Taktyka" widzi ten,
  -- kto gra w meczu, a USTAWIA wyłącznie kapitan — bez tego wpisu skrypt dawałby
  -- widok do czytania i nie dałoby się niczego kliknąć.
  UPDATE event_participants p SET is_captain = true
   WHERE p.user_id = fp
     AND p.event_id IN (SELECT id FROM events WHERE description LIKE '[TAK]%');

  RAISE NOTICE 'Gotowe: 12 scenariuszy taktyki. Wejdź na /moje-gry i zacznij od T12 — tam wszystko jest już ustawione.';
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[TAK]%'
   AND lat IS NULL
   AND field_id IS NULL;


-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(e.title, ' — ', 1)  AS nr,
  split_part(e.title, ' — ', 2)  AS scenariusz,
  e.sport,
  e.teams_published              AS skladty_opublikowane,
  e.status,
  (SELECT count(*) FROM event_participants p WHERE p.event_id = e.id AND p.team = 'A') AS zielonych,
  (SELECT count(*) FROM event_participants p WHERE p.event_id = e.id AND p.team = 'B') AS pomaranczowych,
  (SELECT count(*) FROM event_team_slots s WHERE s.event_id = e.id)    AS obsadzonych_pozycji,
  (SELECT count(*) FROM event_team_messages m WHERE m.event_id = e.id) AS wiadomosci,
  '/wydarzenia/' || e.id         AS adres
FROM events e
WHERE e.description LIKE '[TAK]%'
ORDER BY e.title;


-- ─────────────────────────────────────────────────────────────────────────
-- seed_dwa_konta.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — SEED POD TESTY DWOMA REALNYMI KONTAMI
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[DWA]" w opisie) i tworzy wszystko od nowa.
--
-- PO CO TO JEST. `seed_przedpremiera.sql` zakłada „Ty + obca osoba bez konta"
-- — dobre pod jednorazową sesję przed wpuszczeniem ludzi. `seed_taktyka.sql`
-- zakłada dwa realne konta, ale tylko pod jedną zakładkę. Tu chodzi o coś
-- innego: MASZ oba konta i chcesz na bieżąco sprawdzać różne przejścia z obu
-- stron naraz — jak organizator (franekks) i jak drugi gracz
-- (franciszekpudelko). Dwanaście osobnych scenariuszy, każdy sprawdza jedną
-- rzecz, tak jak `seed_regresja.sql` — ale tu OBIE strony są prawdziwymi
-- kontami, więc powiadomienia, dzwonek i rozmowy działają naprawdę, nie tylko
-- w bazie.
--
-- WYMAGANIA
--   • migracje do `126` włącznie uruchomione,
--   • konto franekks@gmail.com — organizator wszystkiego,
--   • konto franciszekpudelko@gmail.com — drugi gracz; loguj się na nie
--     osobno (drugą przeglądarkę/tryb prywatny albo drugi telefon), żeby
--     zobaczyć powiadomienia i dzwonek tak, jak zobaczy je realny użytkownik.
--
-- JAK PRZEZ TO PRZEJŚĆ
-- Zaloguj się na oba konta (dwie przeglądarki albo jedna + tryb prywatny).
-- Wejdź na /moje-gry na koncie franekks — mecze mają w tytule numer
-- („D01 …"), opis zaczyna się od „SPRAWDŹ:" i mówi, co zrobić NA KTÓRYM
-- koncie i czego się spodziewać. Idziesz po kolei, przełączając się między
-- kontami tam, gdzie opis o to prosi. Na końcu pliku — lista kontrolna
-- z adresami i kodem dołączenia do ekipy.
--
-- PO TEŚCIE: `supabase/wyczysc-testowe.sql` kasuje to razem z resztą danych
-- testowych. Nie zostawiaj tego w bazie, do której wpuszczasz ludzi.
-- ============================================================

DO $$
DECLARE
  ja    UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  fp    UUID := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');
  ja_n  TEXT;
  fp_n  TEXT;
  eid   UUID;
  gid   UUID;
  kod   TEXT;
  -- Godzina D06 jest czytana w strefie PRZEGLĄDARKI, a `event_time` siedzi
  -- w bazie bez strefy — patrz `seed_przedpremiera.sql`, ten sam powód: bez
  -- przeliczenia numer BLIK nie odsłoniłby się w oknie „za godzinę przed
  -- meczem" (`canSeeBlikPhone`).
  teraz TIMESTAMP := (now() AT TIME ZONE 'Europe/Warsaw');
  brak  TEXT[] := '{}';
BEGIN
  -- SPRAWDZENIE SCHEMATU — jeden znacznik na obszar funkcji, nie na każdą
  -- migrację z osobna (ten seed używa niemal całego schematu). Cel: jeden
  -- czytelny komunikat, czego brakuje, zamiast „column ... does not exist"
  -- w połowie przebiegu — patrz `seed_przedpremiera.sql` po uzasadnienie.
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF to_regclass('public.event_player_invites') IS NULL THEN
    brak := brak || '060_zaproszenia_na_mecz.sql — brak tabeli event_player_invites'::text;
  END IF;
  IF to_regclass('public.dm_conversations') IS NULL THEN
    brak := brak || '125_rozmowy_prywatne.sql — brak tabeli dm_conversations'::text;
  END IF;
  IF to_regclass('public.group_posts') IS NULL THEN
    brak := brak || '093_tablica_grupy.sql — brak tabeli group_posts'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF fp IS NULL THEN
    RAISE EXCEPTION 'Brak konta franciszekpudelko@gmail.com w auth.users — zaloguj się na nie raz do aplikacji.';
  END IF;

  -- Kasowanie poprzedniego przebiegu ZA sprawdzeniami — nieudany seed ma
  -- zostawić bazę taką, jaką zastał, patrz `seed_przedpremiera.sql`.
  DELETE FROM events WHERE description LIKE '[DWA]%';
  DELETE FROM groups WHERE name = '[DWA] Ekipa testowa';
  DELETE FROM dm_messages WHERE content LIKE '[DWA]%';
  DELETE FROM dm_conversations
   WHERE (low_user_id = LEAST(ja, fp) AND high_user_id = GREATEST(ja, fp))
     AND NOT EXISTS (
       SELECT 1 FROM dm_messages m
       WHERE m.low_user_id = LEAST(ja, fp) AND m.high_user_id = GREATEST(ja, fp)
     );

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Franek');
  fp_n := COALESCE((SELECT display_name FROM profiles WHERE id = fp), 'Franciszek');

  -- D01 — wolne miejsca + rozmowa meczu ----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 1, '19:00', '20:30', 10, 'public',
    'D01 — wolne miejsca',
    '[DWA] SPRAWDŹ: [franciszekpudelko] otwiera mecz i klika „Dołącz" — wchodzi do składu od razu, licznik się aktualizuje bez odświeżania. Obie strony piszą coś w zakładce „Rozmowa" — [franekks] ma zobaczyć chmurkę i różową plakietkę na dolnej nawigacji, gdy druga strona odpisze.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D02 — komplet i kolejka: rezerwa, potem oferta po wypisaniu -----------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 2, '19:00', '20:30', 2, 'public',
    'D02 — komplet i kolejka',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Dołącz" przy komplecie — komunikat ma mówić WPROST o rezerwie, nie „Dołączyłeś do meczu!". Potem [franekks] wypisuje gościa „Kolega" ze składu (przycisk przy jego nazwisku). [franciszekpudelko] ma dostać OFERTĘ zwolnionego miejsca — powiadomienie w dzwonku i widoczny stan na stronie meczu, nie ciche wejście do składu (auto-awansu nie ma, to decyzja produktowa).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Kolega', true);

  -- D03 — bramkarze, osobny limit ------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 3, '19:00', '20:30', 10, 'public',
    'D03 — bramkarze, osobny limit',
    '[DWA] SPRAWDŹ: limit bramkarzy to 1, jeden gość już go zajął. [franciszekpudelko] dołącza jako bramkarz (przełącznik roli w oknie dołączania) — mimo że w POLU jest mnóstwo wolnych miejsc, ma wylądować na REZERWIE bramkarzy, bo tryb jest „osobny limit". To jest różnica względem D04 — warto zobaczyć oba na raz.',
    true, 1, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, name, is_guest, is_goalkeeper)
  VALUES (eid, 'Gość — bramkarz', true, true);

  -- D04 — bramkarze, wspólna pula ------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 3, '20:00', '21:30', 10, 'public',
    'D04 — bramkarze, wspólna pula',
    '[DWA] SPRAWDŹ: ten sam limit bramkarzy (1), ale tryb „wspólna pula". [franciszekpudelko] dołącza jako bramkarz — wchodzi normalnie do składu, bez osobnej kolejki. Porównaj z D03: identyczne ustawienia liczbowe, inny skutek.',
    true, 1, false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D05 — wymaga akceptacji ------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 4, '19:00', '20:30', 10, 'public',
    'D05 — wymaga akceptacji',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Dołącz" — ma zobaczyć, że CZEKA na decyzję organizatora, i dowiedzieć się, jak się o niej dowie. [franekks] dostaje prośbę (dzwonek albo /moje-gry) i akceptuje. [franciszekpudelko] sprawdza, czy stan zmienił się BEZ odświeżania strony.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D06 — płatny, karta sportowa, BLIK, blisko startu ----------------------
  -- Godzina blisko „teraz": numer BLIK odsłania się dopiero na godzinę przed
  -- startem (`canSeeBlikPhone`) — patrz `seed_przedpremiera.sql`, ten sam trik.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods,
                      accepted_sports_cards, sports_card_discount_grosz, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Hala — testy dwóch kont',
    (teraz + interval '45 minutes')::date,
    date_trunc('minute', teraz + interval '45 minutes')::time, NULL, 10, 'public',
    'D06 — płatny, karta sportowa, BLIK',
    '[DWA] SPRAWDŹ: [franciszekpudelko] PRZED zapisaniem otwiera okno dołączania i wybiera BLIK — ma zobaczyć ZDANIE, że numer pokaże się po dołączeniu, nie sam numer. Zaznacz i odznacz „mam kartę sportową" — cena ma się różnić o 10 zł. Po zapisaniu numer BLIK jest widoczny na karcie „Twoja płatność" (mecz zaczyna się za mniej niż godzinę).',
    2500, ARRAY['blik','gotowka']::text[], ARRAY['multisport']::text[], 1000, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, ja, ja_n, 'blik');

  -- D07 — gość bez konta → przejęcie wpisu ---------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, allow_guest_adds)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 5, '18:30', '20:00', 10, 'public',
    'D07 — gość bez konta',
    '[DWA] SPRAWDŹ: przy „Gość do przejęcia" kliknij „Zaproś do Bojo" (przycisk przy jego nazwisku) — skopiuj link. Otwórz go na koncie [franciszekpudelko] i przejmij wpis. Ma wejść do składu JAKO ON, wpis gościa ma zniknąć — nie może powstać drugi wiersz obok.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, name, is_guest)
  VALUES (eid, 'Gość do przejęcia', true);

  -- D08 — ekipa: kod dołączenia, prywatny mecz przez grupę, tablica -------
  INSERT INTO groups (name, created_by, description)
  VALUES ('[DWA] Ekipa testowa', ja, 'Ekipa do testów dwoma kontami — kasowana razem z resztą danych testowych.')
  RETURNING id, join_code INTO gid, kod;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, group_id)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 6, '20:00', '21:30', 10, 'private',
    'D08 — mecz ekipy (prywatny)',
    '[DWA] SPRAWDŹ: [franciszekpudelko] NIE jest jeszcze w ekipie — na /grupy wybierz „Masz kod?" i wpisz kod z listy kontrolnej na końcu tego seeda. Po dołączeniu ma zobaczyć TEN mecz, mimo że jest PRYWATNY (bo należy do ekipy) — i dostać powiadomienie o wpisie, który [franekks] doda niżej na tablicy ekipy. Dołącz też do składu i napisz coś w Rozmowie meczu.', gid)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO group_posts (group_id, user_id, user_name, body)
  VALUES (gid, ja, ja_n, '[DWA] Zbieramy się 10 minut wcześniej, brama od strony parkingu. Kto jeszcze dołącza?');

  -- D09 — imienne zaproszenie na mecz --------------------------------------
  -- Osobne od D08: to jest zaproszenie NA KONKRETNY MECZ (migracja 060), nie
  -- widoczność przez ekipę — działa nawet bez wspólnej grupy.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 7, '19:00', '20:30', 10, 'public',
    'D09 — imienne zaproszenie na mecz',
    '[DWA] SPRAWDŹ: [franciszekpudelko] ma zobaczyć ten mecz w zakładce „Zaproszenia" na /moje-gry, mimo że nie klikał żadnego linku — zaproszenie NIE zajmuje miejsca w składzie. Zareaguj (dołącz albo odrzuć) i sprawdź, czy zaproszenie znika z listy.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_player_invites (event_id, user_id, invited_by)
  VALUES (eid, fp, ja);

  -- D10 — rozegrany mecz: wynik, rozliczenie, historia ---------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_results, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE - 1, '19:00', '20:30', 6, 'public',
    'D10 — po meczu: wynik i kasa',
    '[DWA] SPRAWDŹ: [franekks] wpisuje wynik z golami, oznacza kto zapłacił (zostaw [franciszekpudelko] jako niezapłaconego, oznacz resztę), wysyła rozliczenie ekipie — czy wiadomość da się przeczytać bez tłumaczenia? [franciszekpudelko] sprawdza kartę „Twoja płatność" (ma pokazywać, że jest winien) i zakładkę „Historia" na /moje-gry — mecz ma tam być, ze statystykami widocznymi też na własnym profilu gracza.',
    2000, ARRAY['blik','gotowka']::text[], true, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, ja, ja_n, 'blik', true),
    (eid, fp, fp_n, 'gotowka', false);
  INSERT INTO event_participants (event_id, name, is_guest, payment_method, has_paid) VALUES
    (eid, 'Kuba (gość)', true, 'blik', true);

  -- D11 — mecz odwołany -----------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, status)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 8, '19:00', '20:30', 10, 'public',
    'D11 — mecz odwołany',
    '[DWA] SPRAWDŹ: [franciszekpudelko] otwiera mecz — ma zobaczyć baner o odwołaniu zamiast możliwości zapisu, bez czerwonego odliczenia do startu.',
    'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D12 — obserwuję, potem dołączam -----------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 9, '19:00', '20:30', 10, 'public',
    'D12 — obserwuję, potem dołączam',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Obserwuj" — ma pojawić się na liście, ale NIE zajmować miejsca w składzie (licznik się nie rusza) i widnieć w zakładce „Obserwuję" na /moje-gry. Potem klika „Dołącz" z tego samego miejsca — wchodzi do składu, bez błędu „już zapisany".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- Rozmowa prywatna — jeden wiadomość startowa, żeby [franciszekpudelko]
  -- od razu zobaczył różową plakietkę na /rozmowy i chmurkę na dolnej
  -- nawigacji, zamiast klikać w pustkę. Odpowiedź jest już żywym testem.
  INSERT INTO dm_conversations (low_user_id, high_user_id)
  VALUES (LEAST(ja, fp), GREATEST(ja, fp))
  ON CONFLICT DO NOTHING;
  INSERT INTO dm_messages (low_user_id, high_user_id, sender_id, sender_name, content)
  VALUES (LEAST(ja, fp), GREATEST(ja, fp), ja, ja_n,
    '[DWA] Cześć! To testowa wiadomość prywatna — odpisz stąd, żeby sprawdzić drugą stronę.');

  RAISE NOTICE 'Gotowe: 12 scenariuszy + rozmowa prywatna + ekipa (kod: %). Wejdź na /moje-gry na obu kontach.', kod;
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Ten sam deterministyczny rozrzut co w `seed_przedpremiera.sql`
-- i `seed_taktyka.sql` — mecz zawsze w tym samym miejscu (zrzuty ekranu się
-- nie ruszają), różny dla różnych meczów (pinezki się nie nakładają).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[DWA]%'
   AND lat IS NULL
   AND field_id IS NULL;

-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  split_part(title, ' — ', 2)  AS scenariusz,
  event_date                   AS termin,
  event_time                   AS godzina,
  status,
  '/wydarzenia/' || id         AS adres
FROM events
WHERE description LIKE '[DWA]%'
ORDER BY title;

-- Kod dołączenia do „[DWA] Ekipa testowa" — potrzebny w D08.
SELECT join_code AS kod_ekipy, '/grupy' AS gdzie_wpisac
FROM groups WHERE name = '[DWA] Ekipa testowa';


-- ─────────────────────────────────────────────────────────────────────────
-- seed_przedpremiera.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Bojo — SEED POD SESJĘ PRZEDPREMIEROWĄ (dwa telefony, ~45 minut)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[PRZED]" w opisie) i tworzy wszystko od nowa.
--
-- CZYM SIĘ RÓŻNI OD `seed_regresja.sql`. Tamten ma 43 mecze i każdy sprawdza
-- JEDNĄ rzecz — to materiał na testy automatyczne, nie na klikanie ręką.
-- Ten ma siedem meczów i ekipę, ustawionych tak, żeby dało się przejść JEDNĄ
-- CIĄGŁĄ HISTORIĘ w kolejności, w jakiej przejdzie ją realna ekipa. Chodzi
-- o błędy INTEGRACYJNE — te, których nie widać w rozłącznych krokach, bo
-- pojawiają się dopiero, gdy jeden stan wynika z poprzedniego.
--
-- Siedem stanów, żebyś nie tracił dwudziestu minut na klikanie danych
-- wejściowych, zanim zaczniesz testować to, co chcesz sprawdzić.
--
-- WYMAGANIA
--   • migracje do `121` włącznie uruchomione (`120` i `121` — patrz ich
--     nagłówki, kolejność ma znaczenie),
--   • konto `franekks@gmail.com` — jesteś organizatorem wszystkiego,
--   • DRUGI CZŁOWIEK z drugim telefonem; nie potrzebuje konta na starcie,
--     bo zakłada je w trakcie (to jest część testu).
--
-- SCENARIUSZ SESJI: docs/testy-przedpremierowe.md
--
-- PO TEŚCIE: `supabase/wyczysc-testowe.sql` kasuje to razem z resztą danych
-- testowych. Nie zostawiaj tego w bazie, do której wpuszczasz ludzi.
-- ============================================================

DO $$
DECLARE
  ja    UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  ja_n  TEXT;
  eid   UUID;
  gid   UUID;
  -- Godzina meczu jest czytana w strefie PRZEGLĄDARKI, a `event_time` siedzi
  -- w bazie bez strefy. Serwer Supabase chodzi na UTC, telefon w Polsce nie —
  -- bez tego przeliczenia „za 45 minut" wyszłoby na telefonie jako „za 2 godz.
  -- 45 min" i numer BLIK by się nie odsłonił (`canSeeBlikPhone`).
  teraz TIMESTAMP := (now() AT TIME ZONE 'Europe/Warsaw');
  brak  TEXT[] := '{}';   -- migracje, których brakuje w bazie (patrz sprawdzenie niżej)
BEGIN
  -- SPRAWDZENIE SCHEMATU. Migracje uruchamia się w tym repo RĘCZNIE, więc baza
  -- bywa starsza niż plik, który do niej wklejasz. Bez tego seed wywraca się
  -- dopiero w środku, na pierwszym INSERT-cie dotykającym nowej kolumny,
  -- komunikatem Postgresa „column ... does not exist" — a ten mówi, CZEGO nie
  -- ma, i nie mówi ani DLACZEGO, ani co z tym zrobić. Przyczyna jest zawsze ta
  -- sama: migracja nie została puszczona. Sprawdzamy więc po jednym znaczniku
  -- na migrację i wypisujemy WSZYSTKIE braki naraz, żeby nie odkrywać ich po
  -- jednym, przebieg po przebiegu.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'events'
                    AND column_name = 'reserve_claim_minutes') THEN
    brak := brak || CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'events'
                      AND column_name = 'reserve_claim_hours')
      THEN '118_rezerwa_czas_w_minutach.sql — w bazie siedzi jeszcze stara kolumna reserve_claim_hours (godziny)'
      ELSE '118_rezerwa_czas_w_minutach.sql — brak kolumny events.reserve_claim_minutes'
    END::text;
  ELSIF EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.events'::regclass
                   AND conname = 'events_reserve_claim_hours_check') THEN
    -- Kolumna ma nową nazwę, ale wisi na niej ograniczenie z `058` (CHECK 1..72)
    -- — czyli `118` przeszła tylko w połowie (sama zmiana nazwy, bez
    -- przeliczenia na minuty). Bez tej gałęzi seed wywala się dopiero na
    -- „violates check constraint events_reserve_claim_hours_check".
    brak := brak || '118_rezerwa_czas_w_minutach.sql — przeszła tylko w połowie: kolumna ma nową nazwę, ale zostało ograniczenie CHECK 1..72 i wartości w godzinach (puść CAŁY plik jeszcze raz, jest odporny na powtórzenie)'::text;
  END IF;
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz w aplikacji.';
  END IF;
  -- Kasowanie poprzedniego przebiegu siedzi ZA sprawdzeniami — nieudany seed
  -- ma zostawić bazę taką, jaką zastał, zamiast wyczyścić stare dane i nie
  -- postawić nowych.
  DELETE FROM events WHERE description LIKE '[PRZED]%';
  DELETE FROM groups WHERE name = '[PRZED] Ekipa testowa';

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Organizator');

  -- P1 — mecz, do którego zaprosisz drugą osobę linkiem -----------------
  -- Wolne miejsca, nic nadzwyczajnego. To jest wejście do historii: wysyłasz
  -- link komuś, kto NIE MA KONTA, i patrzysz, ile kroków dzieli go od składu.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '1 day')::date, '19:00', '20:30', 10, 'public',
    'P1 — zaproszenie linkiem',
    '[PRZED] SPRAWDŹ: wyślij link drugiej osobie BEZ konta. Ma dojść do składu: otworzyć link, założyć konto, dołączyć. Policz kroki i miejsca, w których się zawaha.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- P2 — komplet: druga osoba wchodzi na rezerwę ------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '2 days')::date, '19:00', '20:30', 2, 'public',
    'P2 — komplet i kolejka',
    '[PRZED] SPRAWDŹ: druga osoba zapisuje się przy komplecie — komunikat ma WPROST mówić o rezerwie. Potem Ty wypisujesz gościa ze składu i patrzysz, czy rezerwowy dostaje ofertę miejsca (i powiadomienie).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Marek (gość organizatora)', true);

  -- P3 — mecz wymagający akceptacji -------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '3 days')::date, '20:00', '21:30', 10, 'public',
    'P3 — prośba o akceptację',
    '[PRZED] SPRAWDŹ: druga osoba klika Dołącz — ma zobaczyć, że CZEKA na decyzję, i dowiedzieć się, jak się o niej dowie. Ty dostajesz prośbę (dzwonek + /moje-gry) i akceptujesz. Sprawdź, czy druga strona widzi zmianę bez odświeżania strony.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- P4 — płatny, zaczyna się za 45 minut --------------------------------
  -- Godzina blisko „teraz" jest tu potrzebna: numer BLIK odsłania się
  -- uczestnikowi dopiero na godzinę przed meczem (`canSeeBlikPhone`).
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods,
                      accepted_sports_cards, sports_card_discount_grosz, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Hala — sesja testowa',
    (teraz + interval '45 minutes')::date,
    date_trunc('minute', teraz + interval '45 minutes')::time, NULL, 10, 'public',
    'P4 — płatny, karta sportowa, BLIK',
    '[PRZED] SPRAWDŹ: druga osoba przed zapisaniem widzi ZDANIE, że numer BLIK zobaczy po dołączeniu — nie sam numer. Po zapisaniu numer jest widoczny (mecz zaczyna się za mniej niż godzinę). Sprawdź też cenę z kartą sportową i bez.',
    2500, ARRAY['blik','gotowka']::text[], ARRAY['multisport']::text[], 1000, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, ja, ja_n, 'blik');

  -- P5 — mecz z wczoraj: wynik i rozliczenie ----------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_results, track_payments, team_mode)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz - interval '1 day')::date, '19:00', '20:30', 6, 'public',
    'P5 — po meczu: wynik i kasa',
    '[PRZED] SPRAWDŹ: wpisz wynik z golami, oznacz kto zapłacił („Wszyscy oddali"), wyślij rozliczenie ekipie. Czy wiadomość do wysłania da się przeczytać bez tłumaczenia?',
    2000, ARRAY['blik','gotowka']::text[], true, true, 'reczne')
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, ja, ja_n, 'blik', true),
    (eid, NULL, 'Kuba (gość)', 'gotowka', false),
    (eid, NULL, 'Michał (gość)', 'blik', false),
    (eid, NULL, 'Adam (gość)', 'blik', true);

  -- P6 — gość bez konta do przejęcia wpisu ------------------------------
  -- Najbardziej niedoceniana ścieżka w Bojo: w stałej ekipie ci sami goście
  -- wracają co tydzień, więc ta sama strata („nie ma konta, nie dostaje
  -- powiadomień") powtarza się 50 razy w roku, nie raz.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, allow_guest_adds)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '4 days')::date, '18:30', '20:00', 10, 'public',
    'P6 — gość bez konta',
    '[PRZED] SPRAWDŹ: wyślij gościowi zaproszenie do przejęcia wpisu (przycisk przy jego nazwisku). Druga osoba otwiera link na swoim telefonie i przejmuje wpis — ma wejść do składu jako ona, nie jako nowy zapis obok gościa.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Gość do przejęcia', true);

  -- P7 — ekipa z meczem --------------------------------------------------
  INSERT INTO groups (name, created_by, description)
  VALUES ('[PRZED] Ekipa testowa', ja, 'Ekipa do sesji przedpremierowej — kasowana razem z resztą danych testowych.')
  RETURNING id INTO gid;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, group_id)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '5 days')::date, '20:00', '21:30', 10, 'private',
    'P7 — mecz ekipy (prywatny)',
    '[PRZED] SPRAWDŹ: zaproś drugą osobę do ekipy kodem. Ma zobaczyć ten mecz, mimo że jest PRYWATNY — bo należy do ekipy. Napisz coś na tablicy ekipy i w rozmowie meczu, sprawdź powiadomienia po drugiej stronie.', gid)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_comments (event_id, user_id, user_name, body)
  VALUES (eid, ja, ja_n, 'Zbieramy się 10 minut wcześniej, brama od strony parkingu.');

  RAISE NOTICE 'Gotowe: 7 stanów startowych + ekipa. Scenariusz sesji: docs/testy-przedpremierowe.md';
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Mecz bez `lat`/`lng` jest na liście i NIE MA GO na mapie — pinezka nie ma
-- gdzie stanąć. Do tej pory żaden seed współrzędnych nie ustawiał, więc każdy
-- widok mapy (`/wydarzenia` w trybie mapy, `/mapa?gry=1`) na danych testowych
-- był pusty. Wyglądało to na zepsutą mapę, a było brakiem danych — zgłoszone
-- wprost („na liście są, na mapie pusto").
--
-- Rozrzut wokół centrum Poznania, wyliczony z tytułu meczu: DETERMINISTYCZNY
-- (ten sam mecz zawsze w tym samym miejscu, więc zrzuty ekranu się nie
-- ruszają) i różny dla różnych meczów (pinezki nie siedzą jedna na drugiej).
-- Mecze przypięte do obiektu z katalogu (`field_id`) zostawiamy w spokoju:
-- ich położenie zna `fields`, a aplikacja bierze je stamtąd, gdy mecz nie ma
-- własnego (patrz `toEvent()` w `lib/events.ts`).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[PRZED]%'
   AND lat IS NULL
   AND field_id IS NULL;


-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  split_part(title, ' — ', 2)  AS stan,
  event_date                   AS termin,
  event_time                   AS godzina,
  max_players                  AS miejsc,
  (SELECT count(*) FROM event_participants p
    WHERE p.event_id = e.id AND NOT p.is_reserve AND NOT p.pending_approval
      AND p.rsvp <> 'maybe')   AS w_skladzie,
  '/wydarzenia/' || e.id       AS adres
FROM events e
WHERE description LIKE '[PRZED]%'
ORDER BY title;
