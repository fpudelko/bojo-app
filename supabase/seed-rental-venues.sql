-- ============================================================
-- Boiska/hale na wynajem — Poznań i okolice
-- Balony pneumatyczne, hale sportowe, zadaszenia stałe
-- Źródło: posir.poznan.pl, arenadebiec.pl, centrumplek.pl, wtkkf.pl
-- GPS przybliżone (fix_coords.py dokona weryfikacji)
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
);

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
  ('cc000008-0000-0000-0000-000000000008', 'umowiony', 'email',         0);
