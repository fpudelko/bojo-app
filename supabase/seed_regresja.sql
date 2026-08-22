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

DELETE FROM events WHERE description LIKE '[REG]%';

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
BEGIN
  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF t1 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10 — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;

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
