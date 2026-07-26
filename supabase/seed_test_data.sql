-- ============================================================
-- Bojo — dane testowe
-- ============================================================
-- To NIE jest migracja (nie numerowana, nie uruchamia się automatycznie).
-- Wklej całość w Supabase → SQL Editor i uruchom ręcznie.
--
-- Bezpieczne do wielokrotnego uruchamiania: na start czyści poprzednie dane
-- testowe (wszystkie wydarzenia, których tytuł zaczyna się od "[TEST]" —
-- usunięcie wydarzenia kasuje też jego uczestników przez ON DELETE CASCADE),
-- a potem tworzy je od nowa.
--
-- WYMAGANIA — te konta muszą już istnieć w auth.users (wystarczy, że raz się
-- zalogowały do apki — e-mail/hasło lub Google):
--   Organizatorzy: franciszekpudelko@gmail.com, franekks@gmail.com,
--                  j4n.brz0@gmail.com
--   Uczestnicy:    test1@example.com … test10@example.com
--
-- Wszystkie wydarzenia mają datę w ciągu najbliższych 7 dni od dziś.
-- ============================================================

DELETE FROM events WHERE title LIKE '[TEST]%';

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
  -- 1. Podstawowy publiczny, darmowy mecz — zero zaawansowanych opcji
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '18:00', 10, 'public',
    '[TEST] 1 — Podstawowy publiczny, darmowy mecz',
    'Testuj: zwykłe dołączanie i wypisanie się, brak płatności, brak zaawansowanych opcji. 4/10 zajętych.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

  -- ========================================================
  -- 2. Bramkarze: limit 2, trzeci automatycznie na rezerwie
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       goalkeepers_enabled, max_goalkeepers)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 2, '19:00', 12, 'public',
    '[TEST] 2 — Bramkarze: limit 2, trzeci na rezerwie',
    'Testuj: rozróżnianie bramkarz/zawodnik, limit 2 bramkarzy — trzeci chętny (Test 5) powinien wylądować na rezerwie.',
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
  -- 3. Limit bramkarzy = 1 (niestandardowy, niski limit)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       goalkeepers_enabled, max_goalkeepers)
  VALUES (org3, org3_name, 'futsal', 'Hala OSiR', CURRENT_DATE + 3, '20:00', 8, 'public',
    '[TEST] 3 — Limit bramkarzy = 1',
    'Testuj: niestandardowy limit bramkarzy (1). Drugi chętny bramkarz (Test 7) powinien wylądować na rezerwie.',
    true, 1)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper, is_reserve, status) VALUES
    (eid, org3, org3_name, false, false, 'potwierdzony'),
    (eid, t6, t6_name, true, false, 'potwierdzony'),
    (eid, t7, t7_name, true, true, 'potwierdzony');

  -- ========================================================
  -- 4. Wymaga akceptacji — 2 potwierdzonych + 3 czekające prośby
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_approval)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '20:00', 10, 'public',
    '[TEST] 4 — Wymaga akceptacji: 2 potwierdzonych + 3 czekające',
    'Testuj: panel "Prośby o dołączenie" — akceptuj/odrzuć. 3 osoby czekają.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, pending_approval) VALUES
    (eid, org1, org1_name, 'potwierdzony', false),
    (eid, t1, t1_name, 'potwierdzony', false),
    (eid, t2, t2_name, 'zaproszony', true),
    (eid, t3, t3_name, 'zaproszony', true),
    (eid, t4, t4_name, 'zaproszony', true);

  -- ========================================================
  -- 5. Wymaga akceptacji — pusty stan (nikt jeszcze nie prosił)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_approval)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 2, '17:00', 10, 'public',
    '[TEST] 5 — Wymaga akceptacji: pusta lista próśb',
    'Testuj: przy 0 próśb sekcja "Prośby o dołączenie" powinna być widoczna z komunikatem "Na razie nikt nie czeka na akceptację", a nie zniknąć całkiem.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org2, org2_name, 'potwierdzony'),
    (eid, t5, t5_name, 'potwierdzony');

  -- ========================================================
  -- 6. Płatne 20 zł, tylko BLIK (numer widoczny w nagłówku)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 4, '18:30', 10, 'public',
    '[TEST] 6 — Płatne 20 zł, tylko BLIK',
    'Testuj: numer BLIK widoczny w nagłówku wydarzenia (nie tylko w dialogu zapisu) i przy zapisie. Bez kart sportowych.',
    2000, ARRAY['blik']::text[], '500 600 700')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_paid) VALUES
    (eid, org3, org3_name, 'potwierdzony', NULL, true),
    (eid, t1, t1_name, 'potwierdzony', 'blik', true),
    (eid, t2, t2_name, 'potwierdzony', 'blik', false);

  -- ========================================================
  -- 7. Płatne 30 zł, gotówka, Multisport ze znaną zniżką -10 zł
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods,
                       accepted_sports_cards, sports_card_discount_grosz)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 3, '19:00', 10, 'public',
    '[TEST] 7 — Płatne 30 zł, gotówka, Multisport -10 zł',
    'Testuj: Test 3 ma kartę Multisport → płaci 20 zł zamiast 30 zł (kwota przekreślona + nowa). Test 4 bez karty płaci pełną cenę.',
    3000, ARRAY['gotowka']::text[], ARRAY['multisport']::text[], 1000)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org1, org1_name, 'potwierdzony', NULL, false, NULL, true),
    (eid, t3, t3_name, 'potwierdzony', 'gotowka', true, 'multisport', false),
    (eid, t4, t4_name, 'potwierdzony', 'gotowka', false, NULL, false);

  -- ========================================================
  -- 8. Karta sportowa BEZ podanej kwoty zniżki + "Inna karta" nazwana
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone,
                       accepted_sports_cards, sports_card_discount_grosz, sports_card_other_name)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '18:00', 10, 'public',
    '[TEST] 8 — Zniżka z karty bez podanej kwoty + "Inna karta" = OK System',
    'Testuj: zniżka nieznana → gracz z kartą widzi "zapytaj organizatora o szczegóły" zamiast wyliczonej ceny. "Inna karta" ma własną nazwę "OK System" zamiast ogólnika.',
    2500, ARRAY['blik','gotowka']::text[], '600 111 222',
    ARRAY['multisport','fitprofit','inne']::text[], NULL, 'OK System')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_sports_card, sports_card_provider, has_paid) VALUES
    (eid, org2, org2_name, 'potwierdzony', NULL, false, NULL, true),
    (eid, t5, t5_name, 'potwierdzony', 'blik', true, 'inne', false),
    (eid, t6, t6_name, 'potwierdzony', 'gotowka', true, 'fitprofit', false);

  -- ========================================================
  -- 9. Płatne 15 zł, wszystkie 3 metody płatności naraz
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description,
                       cost_grosz, accepted_payment_methods, blik_phone)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 6, '17:30', 10, 'public',
    '[TEST] 9 — Płatne 15 zł, wszystkie metody płatności',
    'Testuj: BLIK + Gotówka + Inne zaakceptowane naraz — wybór metody przy zapisie i wyświetlanie przy każdym uczestniku.',
    1500, ARRAY['blik','gotowka','inne']::text[], '700 222 333')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, payment_method, has_paid) VALUES
    (eid, org3, org3_name, 'potwierdzony', NULL, true),
    (eid, t7, t7_name, 'potwierdzony', 'blik', true),
    (eid, t8, t8_name, 'potwierdzony', 'gotowka', false),
    (eid, t9, t9_name, 'potwierdzony', 'inne', false);

  -- ========================================================
  -- 10. Obserwujący (RSVP "Może")
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '18:00', 10, 'public',
    '[TEST] 10 — Obserwujący (RSVP "Może")',
    'Testuj: Test 2 i Test 3 obserwują (nie zajmują miejsca) — sprawdź osobną sekcję "Obserwujesz" w Moje mecze i na landing page.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, rsvp, is_reserve) VALUES
    (eid, org1, org1_name, 'potwierdzony', 'yes', false),
    (eid, t1, t1_name, 'potwierdzony', 'yes', false),
    (eid, t2, t2_name, 'potwierdzony', 'maybe', true),
    (eid, t3, t3_name, 'potwierdzony', 'maybe', true);

  -- ========================================================
  -- 11. Komplet + 3 osoby na liście rezerwowej
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 1, '19:30', 6, 'public',
    '[TEST] 11 — Komplet (6/6) + 3 os. na rezerwie',
    'Testuj: widok "Komplet — zapisz się na rezerwę", lista rezerwowa widoczna tylko dla organizatora.')
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
  -- 12. Goście bez konta (w tym bramkarz-gość), dopisani przez organizatora
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, goalkeepers_enabled)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 3, '18:00', 10, 'public',
    '[TEST] 12 — Goście bez konta, dopisani przez organizatora',
    'Testuj: odznaka "gość", linijka "dodał(a): Jan" pod gościem, bramkarz-gość.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, is_goalkeeper, status) VALUES
    (eid, org3, org3_name, false, NULL, false, 'potwierdzony'),
    (eid, t1, t1_name, false, NULL, false, 'potwierdzony'),
    (eid, NULL, 'Kolega Jana', true, org3, false, 'potwierdzony'),
    (eid, NULL, 'Gość Bramkarz', true, org3, true, 'potwierdzony');

  -- ========================================================
  -- 13. Śledzenie obecności — 4 różne statusy (test "Potwierdzenia")
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, track_attendance)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 4, '19:00', 10, 'public',
    '[TEST] 13 — Śledzenie obecności: 4 różne statusy',
    'Testuj: kartę "Potwierdzenia" — select z jawnym wyborem statusu (zaproszony/potwierdzony/odrzucił/brak odp.) zamiast klik-cykl.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t1, t1_name, 'zaproszony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'odrzucony'),
    (eid, t4, t4_name, 'brak_odpowiedzi');

  -- ========================================================
  -- 14. Potwierdzenie SMS — numery telefonów ustawione
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, require_sms_confirmation)
  VALUES (org2, org2_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 5, '20:00', 10, 'public',
    '[TEST] 14 — Potwierdzenie SMS (numery ustawione)',
    'Testuj: przy uczestnikach z numerem telefonu powinien być widoczny przycisk "Wyślij SMS z potwierdzeniem" w karcie Potwierdzenia.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, phone) VALUES
    (eid, org2, org2_name, 'potwierdzony', NULL),
    (eid, t5, t5_name, 'zaproszony', '600111222'),
    (eid, t6, t6_name, 'zaproszony', '600333444');

  -- ========================================================
  -- 15. Drużyny (kapitanowie), składy opublikowane
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode, teams_published)
  VALUES (org3, org3_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 2, '18:00', 10, 'public',
    '[TEST] 15 — Drużyny (kapitanowie), opublikowane',
    'Testuj: publiczny widok składów (PublishedTeamsCard), gwiazdka kapitana, plakietki drużyn A/B.',
    'kapitanowie', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain) VALUES
    (eid, org3, org3_name, 'potwierdzony', 'A', true),
    (eid, t7, t7_name, 'potwierdzony', 'A', false),
    (eid, t8, t8_name, 'potwierdzony', 'B', true),
    (eid, t9, t9_name, 'potwierdzony', 'B', false);

  -- ========================================================
  -- 16. Drużyny (losowe), skład roboczy — niepublikowany
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, team_mode, teams_published)
  VALUES (org1, org1_name, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 6, '19:00', 10, 'public',
    '[TEST] 16 — Drużyny (losowe), skład roboczy',
    'Testuj: skład przydzielony, ale nieopublikowany — organizator widzi "roboczy", gracze jeszcze nie widzą podziału.',
    'losowe', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, org1, org1_name, 'potwierdzony', 'A'),
    (eid, t10, t10_name, 'potwierdzony', 'B');

  -- ========================================================
  -- 17. Siatkówka, publiczny, prosty wariant sportu
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org2, org2_name, 'siatkówka', 'Hala Lubon', CURRENT_DATE + 3, '17:00', 12, 'public',
    '[TEST] 17 — Siatkówka, publiczny, prosty',
    'Testuj: inny sport niż piłka nożna — bez opcji bramkarza (nie dotyczy siatkówki).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org2, org2_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony');

  -- ========================================================
  -- 18. Koszykówka, prywatny (dostęp tylko przez link/kod)
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'koszykówka', 'Boisko Świerczewo', CURRENT_DATE + 4, '18:00', 8, 'private',
    '[TEST] 18 — Koszykówka, prywatny',
    'Testuj: wydarzenie prywatne — nie pojawia się w publicznej liście, dostęp przez link/kod dołączenia (JoinCodePanel).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org3, org3_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

  -- ========================================================
  -- 19. Siatkówka plażowa — uczestnicy mogą dopisywać gości
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description, allow_guest_adds)
  VALUES (org1, org1_name, 'siatkówka plażowa', 'Plaża Rusałka', CURRENT_DATE + 7, '16:00', 12, 'public',
    '[TEST] 19 — Siatkówka plażowa: uczestnicy dopisują gości',
    'Testuj: zalogowany na Test 4 → w widoku uczestnika powinno być pole "Dopisz znajomego bez konta" (nie tylko dla organizatora).',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, org1, org1_name, 'potwierdzony'),
    (eid, t4, t4_name, 'potwierdzony');

  -- ========================================================
  -- 20. Futsal, dokładny komplet (test widoku "Komplet")
  -- ========================================================
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                       max_players, visibility, title, description)
  VALUES (org3, org3_name, 'futsal', 'Hala OSiR', CURRENT_DATE + 5, '19:00', 8, 'public',
    '[TEST] 20 — Futsal: dokładny komplet (8/8)',
    'Testuj: 8/8 zajętych. Zaloguj się na konto spoza tej listy (np. własne) i sprawdź sticky bar "Komplet — zapisz się na rezerwę".')
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

  RAISE NOTICE 'Gotowe — dodano 20 testowych wydarzeń z uczestnikami.';
END $$;
