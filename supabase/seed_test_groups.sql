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
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony'),
    (eid, t4, t4_name, 'potwierdzony');

  -- ---- 2. Mecz mojej grupy, w którym już gram ------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t2, t2_name, 'siatkówka', 'Hala Chwiałka', CURRENT_DATE + 3, '20:00', 12, 'private', g_siatka,
    'Siatkówka we czwartek',
    '[TEST-G] Mecz ekipy „Siatka po pracy", jesteś już zapisany. NIE MOŻE dublować się w „Mecze Twoich ekip" — ma być tylko w „Twoje najbliższe mecze".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, me, me_name, 'potwierdzony'),
    (eid, t3, t3_name, 'potwierdzony'),
    (eid, t7, t7_name, 'potwierdzony');

  -- ---- 3. Mecz mojej grupy, który obserwuję --------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t3, t3_name, 'piłka nożna', 'Boisko Golęcin', CURRENT_DATE + 4, '18:30', 10, 'private', g_sroda,
    'Piłka na Golęcinie',
    '[TEST-G] Mecz Twojej ekipy, który OBSERWUJESZ. Ma być w sekcji „Obserwujesz", a nie w „Mecze Twoich ekip" — obserwowanie to już odpowiedź.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status, rsvp) VALUES
    (eid, t3, t3_name, 'potwierdzony', 'yes'),
    (eid, me, me_name, 'potwierdzony', 'maybe'),
    (eid, t4, t4_name, 'potwierdzony', 'yes'),
    (eid, t5, t5_name, 'potwierdzony', 'yes');

  -- ---- 4. Mecz grupy, do której NIE należę — kontrola negatywna ------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t5, t5_name, 'piłka nożna', 'Orlik Dębiec', CURRENT_DATE + 2, '21:00', 10, 'private', g_obce,
    'Wtorkowa gra na Dębcu',
    '[TEST-G] Mecz ekipy „Ekipa z Dębca", do której NIE należysz. NIE MOŻE pojawić się na Twojej stronie głównej. Jeśli go tam widzisz — to błąd.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t5, t5_name, 'potwierdzony'),
    (eid, t6, t6_name, 'potwierdzony'),
    (eid, t7, t7_name, 'potwierdzony');

  -- ---- 5. Komplet, jestem na rezerwie --------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t1, t1_name, 'piłka nożna', 'Hala OSiR Piątkowo', CURRENT_DATE + 5, '19:30', 4, 'private', g_sroda,
    'Halówka w Piątkowie',
    '[TEST-G] Komplet, a Ty jesteś na rezerwie. Nagłówek ma pokazać samo „Komplet" — BEZ „dołącz do rezerwy", bo już jesteś zapisany.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, status) VALUES
    (eid, t1, t1_name, false, 'potwierdzony'),
    (eid, t2, t2_name, false, 'potwierdzony'),
    (eid, t3, t3_name, false, 'potwierdzony'),
    (eid, t4, t4_name, false, 'potwierdzony'),
    (eid, me, me_name, true,  'potwierdzony');

  -- ---- 6. Komplet, nie ma mnie w ogóle -------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t2, t2_name, 'koszykówka', 'Boisko Rataje', CURRENT_DATE + 3, '17:00', 4, 'private', g_kosz,
    'Kosz w środę po pracy',
    '[TEST-G] Komplet i nie masz z tym meczem nic wspólnego. TU nagłówek MA pokazać „Komplet — dołącz do rezerwy". Porównaj z „Halówka w Piątkowie".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t2, t2_name, 'potwierdzony'),
    (eid, t8, t8_name, 'potwierdzony'),
    (eid, t9, t9_name, 'potwierdzony'),
    (eid, t10, t10_name, 'potwierdzony');

  -- ---- 7. Mój mecz BEZ grupy — do przypięcia -------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (me, me_name, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 6, '18:00', 10, 'private',
    'Piątkowe granie na Winogradach',
    '[TEST-G] Twój mecz BEZ grupy. Wejdź w „Zarządzaj wydarzeniem" → Grupa i przypnij go do „Środowa Liga". Po zapisie ma się pojawić na liście meczów tej grupy. Sprawdź też odpięcie („Bez grupy").')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, me, me_name, 'potwierdzony'),
    (eid, t1, t1_name, 'potwierdzony'),
    (eid, t8, t8_name, 'potwierdzony');

  -- ---- 8. Cudzy mecz bez grupy — test uprawnień admina ---------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description)
  VALUES (t9, t9_name, 'piłka nożna', 'Boisko Sołacz', CURRENT_DATE + 4, '20:30', 10, 'private',
    'Czwartkowa gra na Sołaczu',
    '[TEST-G] CUDZY mecz bez grupy — dokładnie sytuacja kumpla, który założył mecze poza grupą. Jako administrator masz widzieć „Zarządzaj wydarzeniem" i móc przypiąć go do grupy. Bez praw admina panel ma być niewidoczny.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t9, t9_name, 'potwierdzony'),
    (eid, t10, t10_name, 'potwierdzony');

  -- ---- 9. Mecz, na który jestem zaproszony ---------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description)
  VALUES (t8, t8_name, 'koszykówka', 'Hala Arena', CURRENT_DATE + 5, '18:00', 10, 'private', g_kosz,
    'Kosz w hali Arena',
    '[TEST-G] Masz na ten mecz IMIENNE ZAPROSZENIE. Ma być na samej górze strony głównej w sekcji „Zaproszenia". Sprawdź „Nie tym razem" — po odrzuceniu ma zniknąć i NIE wrócić po odświeżeniu.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t8, t8_name, 'potwierdzony'),
    (eid, t9, t9_name, 'potwierdzony');
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
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, me, me_name, 'potwierdzony'),
    (eid, t8, t8_name, 'potwierdzony');

  -- ---- 11. Długi tytuł — kontrola layoutu ----------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, group_id, title, description, cost_grosz)
  VALUES (t4, t4_name, 'piłka nożna', 'Kompleks Sportowy Politechniki Poznańskiej', CURRENT_DATE + 6, '21:00', 14, 'private', g_sroda,
    'Cotygodniowe granie ekipy ze Środowej Ligi na Politechnice',
    '[TEST-G] Bardzo długi tytuł i długa nazwa obiektu. Karta na stronie głównej i na liście grupy nie ma się rozjeżdżać w bok — tekst ma być ucięty wielokropkiem. Sprawdź na telefonie.',
    2500)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, status) VALUES
    (eid, t4, t4_name, 'potwierdzony'),
    (eid, t5, t5_name, 'potwierdzony'),
    (eid, t6, t6_name, 'potwierdzony');

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
