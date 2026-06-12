-- ============================================================
-- Boiska do siatkówki plażowej — powiat poznański (16 obiektów)
-- Źródło: napiachu.pl, posir.poznan.pl, strony własne obiektów
-- GPS i dane kontaktowe zweryfikowane czerwiec 2025
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
  52.41850, 16.97420,
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
);

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
   NULL, NULL, 0);
