-- ============================================================
-- Boiska do siatkówki plażowej — powiat poznański
-- Źródło: ręczne wyszukiwanie, napiachu.pl, posir.poznan.pl
-- ============================================================

INSERT INTO fields (
  id, name, address, lat, lng,
  sport, available, surface, is_indoor,
  phone, website, source,
  operator, description, image_url, opening_hours,
  fee, has_changing_rooms, has_shower, has_toilets,
  capacity, pitch_count, venue_type, access_type,
  district, postcode, is_verified_venue, condition
) VALUES

-- 1. POSiR Rusałka — 8 boisk, bezpłatne (rezerwacja online)
(
  gen_random_uuid(),
  'POSiR Rusałka — Boiska Siatkówki Plażowej',
  'ul. Golęcińska 27, 60-626 Poznań',
  52.43820, 16.89950,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 835 79 07',
  'https://posir.poznan.pl/obiekty/rusalka/boiska-do-siatkowki-plazowej',
  'manual',
  'POSiR Poznań',
  'Największy kompleks boisk do siatkówki plażowej w Poznaniu — 8 pełnowymiarowych kortów na piasku nad Jeziorem Rusałka. Bezpłatne, wymagana rezerwacja online. Co roku gospodarz turnieju Lotto Plaża Wolności.',
  'https://posir.poznan.pl/images/rusalka/siatkowka-plazowa.jpg',
  'Mo-Su 08:00-21:00',
  false, true, true, true,
  NULL, 8, 'volleyball_beach', 'public',
  'Jeżyce', '60-626', true, 'good'
),

-- 2. Piach i Podróże (POSiR Rataje) — 4 boiska, płatne
(
  gen_random_uuid(),
  'Piach i Podróże — Boiska Plażowe',
  'Os. Piastowskie 106A, 61-164 Poznań',
  52.39180, 16.99820,
  ARRAY['siatkówka plażowa', 'beach tennis'],
  true, 'sand', false,
  '+48 668 675 147',
  'https://piachipodroze.pl',
  'manual',
  'Beach Volleyball Academy / Proskos',
  '4 pełnowymiarowe boiska do siatkówki plażowej przy POSiR Rataje. Beach bar, leżaki, beach tennis, obozy i turnieje. Rezerwacja telefonicznie lub e-mailowo. Koszt: 8 zł/os/h.',
  'https://piachipodroze.pl/wp-content/uploads/boiska-rataje.jpg',
  'Mo-Fr 10:00-22:00; Sa-Su 09:00-22:00',
  true, true, true, true,
  NULL, 4, 'volleyball_beach', 'public',
  'Nowe Miasto', '61-164', true, 'good'
),

-- 3. Beach Arena BVA — Park Kasprowicza — 4 boiska, płatne
(
  gen_random_uuid(),
  'Beach Arena — Beach Volleyball Academy',
  'Park im. Jana Kasprowicza 1, 60-238 Poznań',
  52.40510, 16.90830,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://bvacademy.pl/beach-arena/',
  'manual',
  'Beach Volleyball Academy (BVA)',
  '4 profesjonalne boiska w Parku Kasprowicza. Siedziba Beach Volleyball Academy — szkolenia dla dzieci od ok. 99 zł/mies. (dofinansowanie Miasta), wynajem dla grup, Beach Bar, prysznice, oficjalne piłki Mikasa.',
  'https://bvacademy.pl/wp-content/uploads/beach-arena-poznan.jpg',
  'Mo-Su 09:00-22:00',
  true, true, true, true,
  NULL, 4, 'volleyball_beach', 'public',
  'Grunwald', '60-238', true, 'good'
),

-- 4. POSiR Chwiałka — Wilda — 3 boiska, bezpłatne*
(
  gen_random_uuid(),
  'POSiR Chwiałka — Boiska Siatkówki Plażowej',
  'ul. Chwiałkowskiego 34, 60-171 Poznań',
  52.39560, 16.90220,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 835 18 01',
  'https://posir.poznan.pl/obiekty/chwialka',
  'manual',
  'POSiR Poznań',
  '3 boiska na piasku kwarcowym przy kąpielisku Chwiałka. Boiska oświetlone — gra możliwa po zmroku. Wejście na kąpielisko: 11,50 zł (po 18:00 — 6 zł); boiska dostępne osobno od ulicy. Turniej "Chwiałka Volley" we wrześniu.',
  NULL,
  'Mo-Su 07:00-21:00',
  false, true, true, true,
  NULL, 3, 'volleyball_beach', 'public',
  'Wilda', '60-171', true, 'good'
),

-- 5. POSiR Strzeszynek — 2 boiska, bezpłatne*
(
  gen_random_uuid(),
  'POSiR Strzeszynek — Boiska Siatkówki Plażowej',
  'ul. Koszalińska 15, 60-449 Poznań',
  52.37900, 16.85800,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 847 00 60',
  'https://posir.poznan.pl/obiekty/strzeszynek',
  'manual',
  'POSiR Poznań',
  '2 boiska przy kąpielisku nad Jeziorem Strzeszyńskim. Wejście na plażę sezonowo płatne. Boiska otoczone piłkochwytami.',
  NULL,
  'Mo-Su 08:00-20:00',
  false, true, true, true,
  NULL, 2, 'volleyball_beach', 'public',
  'Piątkowo', '60-449', true, 'good'
),

-- 6. Restauracja Oaza Strzeszynek — 4 boiska, bezpłatne
(
  gen_random_uuid(),
  'Oaza Strzeszynek — Boiska Plażowe',
  'ul. Koszalińska 15 (teren ośrodka), 60-449 Poznań',
  52.37820, 16.85720,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 848 31 29',
  'https://strzeszynek.pl',
  'manual',
  'Restauracja Oaza',
  '4 boiska na terenie ośrodka Oaza przy Jeziorze Strzeszyńskim. Dostęp bezpłatny. Plac zabaw, leżaki, parasole, wypożyczalnia sprzętu wodnego.',
  NULL,
  'Mo-Su 10:00-22:00',
  false, false, false, true,
  NULL, 4, 'volleyball_beach', 'public',
  'Piątkowo', '60-449', true, 'good'
),

-- 7. POSiR MOS Wyspiańskiego — 2 boiska, płatne
(
  gen_random_uuid(),
  'POSiR MOS — Boiska Siatkówki Plażowej',
  'ul. Stanisława Wyspiańskiego 27, 60-751 Poznań',
  52.39100, 16.92700,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 877 23 29',
  'https://posir.poznan.pl/obiekty/mos/boiska-do-siatkowki-plazowej',
  'manual',
  'POSiR Poznań / MOS',
  '2 boiska plażowe przy MOS (Miejski Ośrodek Sportu). Rezerwacja przez biuro MOS, ul. Gdańska 1.',
  NULL,
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, true, true,
  NULL, 2, 'volleyball_beach', 'public',
  'Grunwald', '60-751', true, 'good'
),

-- 8. Politechnika Poznańska CSPP — 1 boisko
(
  gen_random_uuid(),
  'CSPP Politechnika Poznańska — Boisko Plażowe',
  'ul. Piotrowo 4, 61-138 Poznań',
  52.40870, 16.94620,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://cspp.put.poznan.pl',
  'manual',
  'Centrum Sportu i Rekreacji Politechniki Poznańskiej',
  '1 boisko do siatkówki plażowej na terenie kampusu Politechniki. Do końca czerwca pierwszeństwo dla studentów i pracowników PP; sezonowo otwarte dla zewnętrznych. Godz. 8:00–22:00.',
  NULL,
  'Mo-Su 08:00-22:00',
  true, true, true, true,
  NULL, 1, 'volleyball_beach', 'club',
  'Wilda', '61-138', true, 'good'
),

-- 9. Univ. Przyrodniczy CKF — 2 boiska
(
  gen_random_uuid(),
  'CKF Uniwersytet Przyrodniczy — Boiska Plażowe',
  'ul. Wojska Polskiego 28, 60-637 Poznań',
  52.40070, 16.89680,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://sparrow.up.poznan.pl/ckf/',
  'manual',
  'Centrum Kultury Fizycznej UP Poznań',
  '2 boiska przy kampusie Uniwersytetu Przyrodniczego. Ok. 15 zł/h. Głównie dla studentów i pracowników; dostęp zewnętrzny możliwy.',
  NULL,
  'Mo-Fr 08:00-22:00; Sa-Su 09:00-20:00',
  true, true, true, true,
  NULL, 2, 'volleyball_beach', 'club',
  'Jeżyce', '60-637', true, 'good'
),

-- 10. OAZA Kórnik — 3 boiska, bezpłatne
(
  gen_random_uuid(),
  'OAZA Kórnickie Centrum Rekreacji — Boiska Plażowe',
  'ul. Ignacego Krasickiego 1, 62-035 Kórnik',
  52.23800, 17.09500,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 61 649 88 75',
  'https://oaza.kornik.pl/blonie/siatkowka-plazowa',
  'manual',
  'Kórnickie Centrum Rekreacji i Sportu OAZA',
  '3 boiska przy kąpielisku nad jeziorem w Kórniku. Bezpłatne. Wypożyczalnia sprzętu wodnego, leżaki z parasolami, plac zabaw. Organizowane turnieje (finały mistrzostw).',
  NULL,
  'Mo-Su 10:00-20:00',
  false, true, true, true,
  NULL, 3, 'volleyball_beach', 'public',
  NULL, '62-035', true, 'good'
),

-- 11. AKWEN Czerwonak — 1 boisko, płatne
(
  gen_random_uuid(),
  'AKWEN Centrum Sportu — Boisko Siatkówki Plażowej',
  'ul. Leśna 6, 62-004 Czerwonak',
  52.46950, 17.01200,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  '+48 510 908 777',
  'https://akwenczerwonak.pl/nasze-obiekty/boiska-sportowe/',
  'manual',
  'Centrum Rozwoju Kultury Fizycznej AKWEN',
  '1 boisko ogrodzone piłkochwytem 4 m. Rezerwacja wymagana (tel. 510 908 777 lub 790 722 544). Wypożyczenie sprzętu. Szatnie + prysznice, siłownia zewnętrzna, plac zabaw.',
  NULL,
  'Mo-Fr 10:00-22:00; Sa-Su 10:00-20:00',
  true, true, true, true,
  NULL, 1, 'volleyball_beach', 'public',
  NULL, '62-004', true, 'good'
),

-- 12. Suchy Las — ul. Poziomkowa — bezpłatne
(
  gen_random_uuid(),
  'Boisko Siatkówki Plażowej — ul. Poziomkowa',
  'ul. Poziomkowa, 62-002 Suchy Las',
  52.45300, 16.91800,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://www.suchylas.pl/dla-mieszkancow/sport-i-rekreacja/boiska/',
  'manual',
  'Gmina Suchy Las',
  'Publiczne boisko do siatkówki plażowej na piasku. Bezpłatne dla mieszkańców.',
  NULL,
  NULL,
  false, false, false, false,
  NULL, NULL, 'volleyball_beach', 'public',
  NULL, '62-002', true, 'fair'
),

-- 13. Suchy Las — ul. Szkółkarska — bezpłatne
(
  gen_random_uuid(),
  'Boisko Siatkówki Plażowej — ul. Szkółkarska',
  'ul. Szkółkarska, 62-002 Suchy Las',
  52.45100, 16.92000,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://www.suchylas.pl/dla-mieszkancow/sport-i-rekreacja/boiska/',
  'manual',
  'Gmina Suchy Las',
  'Publiczne boisko do siatkówki plażowej. Bezpłatne dla mieszkańców.',
  NULL,
  NULL,
  false, false, false, false,
  NULL, NULL, 'volleyball_beach', 'public',
  NULL, '62-002', true, 'fair'
),

-- 14. GOKiS Tulce (Kleszczewo) — 1 boisko, bezpłatne*
(
  gen_random_uuid(),
  'GOKiS Tulce — Boisko Siatkówki Plażowej',
  'ul. Szkolna 1, 63-005 Tulce',
  52.35800, 17.06500,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://gokis.kleszczewo.pl/boisko-do-siatkowki-plazowej-w-tulcach.html',
  'manual',
  'GOKiS Kleszczewo',
  '1 boisko przy hali sportowej w Tulcach. Bezpłatne — wymagana rezerwacja online (gokis.kleszczewo.pl). W godz. 8–15 pierwszeństwo dla SP w Tulcach. Coroczny turniej "Tulce Plaża Oldboy".',
  NULL,
  'Mo-Fr 15:00-21:00; Sa-Su 09:00-21:00',
  false, true, false, true,
  NULL, 1, 'volleyball_beach', 'school',
  NULL, '63-005', true, 'good'
),

-- 15. OSiR Mosina — 2 boiska
(
  gen_random_uuid(),
  'OSiR Mosina — Boiska Siatkówki Plażowej',
  'ul. Marii Konopnickiej 31, 62-050 Mosina',
  52.24380, 16.84820,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://osirmosina.pl/index.php/stadion/',
  'manual',
  'OSiR Mosina',
  '2 boiska do siatkówki plażowej przy stadionie OSiR Mosina. Kontakt z ośrodkiem w celu rezerwacji.',
  NULL,
  NULL,
  NULL, NULL, NULL, NULL,
  NULL, 2, 'volleyball_beach', 'public',
  NULL, '62-050', true, 'good'
),

-- 16. Stadion Miejski Buk — 2 boiska, publiczne
(
  gen_random_uuid(),
  'OSiR Buk — Boiska Siatkówki Plażowej',
  'ul. Sportowa 14, 64-320 Buk',
  52.35770, 16.52300,
  ARRAY['siatkówka plażowa'],
  true, 'sand', false,
  NULL,
  'https://osir-buk.pl/stadion-miejski.html',
  'manual',
  'OSiR Buk',
  '2 pełnowymiarowe boiska (8×8 m) przy stadionie miejskim. Na terenie też pole do piłki ręcznej plażowej (33×18 m). Publiczne, bezpłatne dla mieszkańców. Wakacyjne turnieje organizowane przez OSiR.',
  NULL,
  NULL,
  false, NULL, NULL, true,
  NULL, 2, 'volleyball_beach', 'public',
  NULL, '64-320', true, 'good'
);
