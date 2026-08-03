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
