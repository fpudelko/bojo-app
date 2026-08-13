-- ============================================================
-- Bojo — dane dla testów wizualnych
-- ============================================================
-- Osobny seed od `seed_regresja.sql` z jednego powodu: TU DATY SĄ NA SZTYWNO.
--
-- Tamten używa `CURRENT_DATE + 3`, żeby mecze zawsze były w przyszłości —
-- świetne do klikania ręką, bezużyteczne przy porównywaniu zrzutów ekranu.
-- Napis „śr. 14 sie" zmieniałby się codziennie i każdy zrzut różniłby się od
-- wzorca bez żadnej zmiany w kodzie.
--
-- Zegar przeglądarki w testach jest zamrożony (`page.clock`), więc etykiety
-- względne („Dzisiaj", „za 2 dni") też wychodzą powtarzalnie.
--
-- Marker: [WIZ]. Uruchamiany automatycznie przez `scripts/stos-lokalny.sh`.
-- ============================================================

DELETE FROM events WHERE description LIKE '[WIZ]%';

DO $$
DECLARE
  org  UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  g2   UUID := (SELECT id FROM auth.users WHERE email = 'test2@example.com');
  g3   UUID := (SELECT id FROM auth.users WHERE email = 'test3@example.com');
  g4   UUID := (SELECT id FROM auth.users WHERE email = 'test4@example.com');
  g5   UUID := (SELECT id FROM auth.users WHERE email = 'test5@example.com');
  n1 TEXT; n2 TEXT; n3 TEXT; n4 TEXT; n5 TEXT;
  eid UUID;
  i INT;
BEGIN
  IF org IS NULL THEN
    RAISE EXCEPTION 'Brak kont testowych — uruchom najpierw seed-test-users.sql';
  END IF;

  n1 := COALESCE((SELECT display_name FROM profiles WHERE id = org), 'Jakub Kowalski');
  n2 := COALESCE((SELECT display_name FROM profiles WHERE id = g2),  'Mateusz Nowak');
  n3 := COALESCE((SELECT display_name FROM profiles WHERE id = g3),  'Piotr Wiśniewski');
  n4 := COALESCE((SELECT display_name FROM profiles WHERE id = g4),  'Kacper Wójcik');
  n5 := COALESCE((SELECT display_name FROM profiles WHERE id = g5),  'Michał Kamiński');

  -- W01 — wolne miejsca, zwykły zapis ---------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, goalkeepers_enabled)
  VALUES ('11111111-1111-4111-8111-111111111111', org, n1, 'piłka nożna', 'Orlik Rataje',
    '2030-06-20', '18:00', '19:30', 10, 'public',
    'Czwartkowa gierka',
    '[WIZ] Mecz z wolnymi miejscami — zrzut stanu wyjściowego i po dołączeniu.', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1), (eid, g2, n2);

  -- W02 — komplet, zapis idzie na rezerwę ------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, goalkeepers_enabled)
  VALUES ('22222222-2222-4222-8222-222222222222', org, n1, 'piłka nożna', 'Boisko Malta',
    '2030-06-21', '19:00', '20:30', 3, 'public',
    'Piątkowy komplet',
    '[WIZ] Skład pełny — sprawdza komunikat o rezerwie i szarą kolorystykę.', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name)
  VALUES (eid, org, n1), (eid, g2, n2), (eid, g3, n3);

  -- W03 — rezerwacja miejsc dla bramkarzy, komplet w polu ---------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES ('33333333-3333-4333-8333-333333333333', org, n1, 'piłka nożna', 'Orlik Winogrady',
    '2030-06-22', '20:00', '21:30', 14, 'public',
    'Sobota — rezerwacja dla bramkarzy',
    '[WIZ] 12 w polu, wolne tylko miejsca dla bramkarzy. Licznik ma to rozbić na role.',
    true, 2, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);
  FOR i IN 1..11 LOOP
    INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
    VALUES (eid, NULL, 'Zawodnik ' || i, false);
  END LOOP;

  -- W04 — wspólna pula, ten sam skład ----------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES ('44444444-4444-4444-8444-444444444444', org, n1, 'piłka nożna', 'Orlik Winogrady',
    '2030-06-23', '20:00', '21:30', 14, 'public',
    'Niedziela — wspólna pula',
    '[WIZ] Ustawienie jak W03, ale bez rezerwacji miejsc. Licznik ma mówić co innego.',
    true, 2, false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);
  FOR i IN 1..11 LOOP
    INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper)
    VALUES (eid, NULL, 'Zawodnik ' || i, false);
  END LOOP;

  -- W05 — prośby o akceptację ------------------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES ('55555555-5555-4555-8555-555555555555', org, n1, 'piłka nożna', 'Orlik Rataje',
    '2030-06-24', '18:00', '19:30', 10, 'public',
    'Poniedziałek — wymaga akceptacji',
    '[WIZ] Dwie prośby czekają na decyzję organizatora.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);
  INSERT INTO event_participants (event_id, user_id, name, pending_approval)
  VALUES (eid, g4, n4, true), (eid, g5, n5, true);

  -- W06 — kolejka rezerwowa u organizatora ------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES ('66666666-6666-4666-8666-666666666666', org, n1, 'piłka nożna', 'Boisko Malta',
    '2030-06-25', '19:00', '20:30', 3, 'public',
    'Wtorek — kolejka rezerwowa',
    '[WIZ] Skład pełny, w kolejce dwie osoby — widok organizatora z przyciskiem „Do składu".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name)
  VALUES (eid, org, n1), (eid, g2, n2), (eid, g3, n3);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, g4, n4, true, '2030-06-01 10:00:00+00'),
         (eid, g5, n5, true, '2030-06-01 11:00:00+00');

  -- W07 — mecz płatny ---------------------------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, blik_phone)
  VALUES ('77777777-7777-4777-8777-777777777777', org, n1, 'piłka nożna', 'Orlik Rataje',
    '2030-06-26', '18:00', '19:30', 10, 'public',
    'Środa — płatny',
    '[WIZ] Mecz płatny z dwiema metodami — okno dołączania wymaga wyboru.',
    1500, ARRAY['gotowka','blik']::text[], '555111222')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);

END $$;
