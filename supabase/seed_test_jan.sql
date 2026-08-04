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
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain)
    VALUES (eid, jan, jan_name, 'potwierdzony', 'A', true) RETURNING id INTO p_jan;
  INSERT INTO event_participants (event_id, user_id, name, status, team)
    VALUES (eid, t1, t1_name, 'potwierdzony', 'A') RETURNING id INTO p_t1;
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain)
    VALUES (eid, t2, t2_name, 'potwierdzony', 'B', true) RETURNING id INTO p_t2;
  INSERT INTO event_participants (event_id, user_id, name, status, team)
    VALUES (eid, t3, t3_name, 'potwierdzony', 'B') RETURNING id INTO p_t3;
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, t4, t4_name, 'potwierdzony', 'A'),
    (eid, t5, t5_name, 'potwierdzony', 'B');
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
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t6, t6_name, 'potwierdzony');

  -- ---- 3. Siatkówka z wynikiem — inny sport, inny kształt wyniku -----
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_results)
  VALUES (jan, jan_name, 'siatkówka', 'Hala Chwiałka', CURRENT_DATE - 5, '18:00', 12, 'public',
    'Siatkówka — turniej zakładowy',
    '[TEST-J] Wynik przy siatkówce (3:1). Sprawdź, czy interfejs wyniku nie mówi „bramki" przy sporcie, w którym bramek nie ma.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t7, t7_name, 'potwierdzony'),
    (eid, t8, t8_name, 'potwierdzony'),
    (eid, t9, t9_name, 'potwierdzony');
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
    INSERT INTO event_participants (event_id, user_id, name, status) VALUES
      (eid, t1, t1_name, 'potwierdzony'),
      (eid, jan, jan_name, 'potwierdzony'),
      (eid, t2, t2_name, 'potwierdzony'),
      (eid, t3, t3_name, 'potwierdzony');
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
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t4, t4_name, 'potwierdzony'),
    (eid, t5, t5_name, 'potwierdzony');

  -- ---- 6. Zaczyna się za 2 godziny ----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_attendance)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta',
          CURRENT_DATE, to_char(now() + interval '2 hours', 'HH24:MI'), 10, 'public',
    'Dzisiejsze granie na Malcie',
    '[TEST-J] Mecz zaczyna się DZIŚ za około 2 godziny. Sprawdź formatowanie daty („dziś, 19:30" zamiast pełnej daty) i czy nadal da się dołączyć. Ma włączoną obecność.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t6, t6_name, 'potwierdzony'),
    (eid, t7, t7_name, 'zaproszony'),
    (eid, t8, t8_name, 'zaproszony');

  -- ---- 7. Obecność — część osób nie potwierdziła --------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, track_attendance, confirmation_deadline_h)
  VALUES (jan, jan_name, 'piłka nożna', 'Orlik Junikowo', CURRENT_DATE + 1, '18:00', 10, 'public',
    'Wtorkowy trening',
    '[TEST-J] Obecność włączona, termin potwierdzenia 12 h. Trzy osoby potwierdziły, trzy nie odpowiedziały. Sprawdź panel obecności u organizatora i to, co widzi uczestnik, który jeszcze nie potwierdził.',
    true, 12)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'zaproszony'),
    (eid, t4, t4_name, 'zaproszony'),
    (eid, t5, t5_name, 'brak_odpowiedzi');

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
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain) VALUES
    (eid, jan, jan_name, 'potwierdzony', 'A', true),
    (eid, t6, t6_name, 'potwierdzony', 'B', true);
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, t7, t7_name, 'potwierdzony', 'A'),
    (eid, t8, t8_name, 'potwierdzony', 'B'),
    (eid, t9, t9_name, 'potwierdzony', 'A'),
    (eid, t10, t10_name, 'potwierdzony', 'B');

  -- ---- 9. Goście dopisani przez UCZESTNIKA, nie organizatora --------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, allow_guest_adds)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 4, '19:30', 12, 'public',
    'Sobotnia gra na Malcie',
    '[TEST-J] Trzy osoby bez konta, dopisane przez RÓŻNE osoby: dwie przez Test 1, jedna przez Jana. Przy każdej ma być widoczne „(dodany przez …)". Sprawdź, czy Test 1 może usunąć TYLKO swoich gości. Sam też kogoś dopisz.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony');
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, status) VALUES
    (eid, NULL, 'Kuba z pracy',   true, t1,  'potwierdzony'),
    (eid, NULL, 'Michał',         true, t1,  'potwierdzony'),
    (eid, NULL, 'Brat Krzyśka',   true, jan, 'potwierdzony');

  -- ---- 10. Miejsce spoza katalogu boisk ------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description,
                      custom_location_name, custom_address, lat, lng)
  VALUES (jan, jan_name, 'piłka nożna', 'Boisko przy szkole w Plewiskach', CURRENT_DATE + 5, '17:00', 10, 'public',
    'Granie w Plewiskach',
    '[TEST-J] Miejsce wpisane RĘCZNIE, nie wybrane z katalogu boisk. Sprawdź, czy nazwa i adres wyświetlają się poprawnie, czy mapa pokazuje właściwy punkt i czy link do nawigacji działa. Nie powinno być odnośnika do strony obiektu, bo obiektu w bazie nie ma.',
    'Boisko przy szkole w Plewiskach', 'ul. Szkolna 64, 62-064 Plewiska', 52.36530, 16.80240)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');

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
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, jan, jan_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony');
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
  INSERT INTO event_participants (event_id, user_id, name, status, team, is_captain) VALUES
    (eid, jan, jan_name, 'potwierdzony', 'A', true),
    (eid, t1,  t1_name,  'potwierdzony', 'B', true);
  INSERT INTO event_participants (event_id, user_id, name, status, team) VALUES
    (eid, fr,  fr_name,  'potwierdzony', 'A'),
    (eid, t2,  t2_name,  'potwierdzony', 'A'),
    (eid, t3,  t3_name,  'potwierdzony', 'A'),
    (eid, t4,  t4_name,  'potwierdzony', 'A'),
    (eid, t5,  t5_name,  'potwierdzony', 'A'),
    (eid, t6,  t6_name,  'potwierdzony', 'B'),
    (eid, t7,  t7_name,  'potwierdzony', 'B'),
    (eid, t8,  t8_name,  'potwierdzony', 'B'),
    (eid, t9,  t9_name,  'potwierdzony', 'B'),
    (eid, t10, t10_name, 'potwierdzony', 'B');
  INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by, status, team) VALUES
    (eid, NULL, 'Bartek',              true, jan, 'potwierdzony', 'A'),
    (eid, NULL, 'Kolega Bartka',       true, jan, 'potwierdzony', 'A'),
    (eid, NULL, 'Sąsiad z bloku',      true, t1,  'potwierdzony', 'A'),
    (eid, NULL, 'Wojtek',              true, t1,  'potwierdzony', 'B'),
    (eid, NULL, 'Znajomy z siłowni',   true, t1,  'potwierdzony', 'B'),
    (eid, NULL, 'Przemek',             true, jan, 'potwierdzony', 'B');

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
  INSERT INTO event_participants (event_id, user_id, name, status, has_paid, paid_amount) VALUES
    (eid, jan, jan_name, 'potwierdzony', true,  2500),
    (eid, t1,  t1_name,  'potwierdzony', true,  2500),
    (eid, t2,  t2_name,  'potwierdzony', false, 0),
    (eid, t3,  t3_name,  'potwierdzony', false, 0);

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
