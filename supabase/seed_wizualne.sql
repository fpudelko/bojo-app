-- ============================================================
-- Bojo — dane dla testów wizualnych
-- ============================================================
-- Osobny seed od `seed_regresja.sql`: tam mecze są rozrzucone po kalendarzu,
-- żeby dało się klikać ręką, tu mają stałe ODSTĘPY od dnia uruchomienia.
--
-- DLACZEGO NIE DATY NA SZTYWNO: pierwsza wersja miała `2030-06-20` i zamrożony
-- zegar przeglądarki (`page.clock`). Efekt: GoTrue wystawia token ważny godzinę
-- od PRAWDZIWEGO „teraz", a przeglądarka z zegarem w 2030 uznaje go za dawno
-- wygasły i wylogowuje użytkownika. Wszystkie 17 scenariuszy padło na tym,
-- że po zalogowaniu nie było żadnych przycisków.
--
-- Odstępy są stałe, więc etykiety względne („za 3 dni") wychodzą identycznie
-- przy każdym przebiegu. Same daty się zmieniają — dlatego zrzuty obejmują
-- FRAGMENTY bez daty, nie całą stronę.
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
  -- `gracz` to konto, którym loguje się większość scenariuszy
  -- (`KONTA.gracz` w e2e/scenariusze.spec.ts) — mecze, w których ma BYĆ
  -- w składzie od początku, muszą go dostać tutaj.
  gracz UUID := (SELECT id FROM auth.users WHERE email = 'test6@example.com');
  n1 TEXT; n2 TEXT; n3 TEXT; n4 TEXT; n5 TEXT; n_gracz TEXT;
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
  n_gracz := COALESCE((SELECT display_name FROM profiles WHERE id = gracz), 'Zuzanna Lewandowska');

  -- W01 — wolne miejsca, zwykły zapis ---------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, goalkeepers_enabled)
  VALUES ('11111111-1111-4111-8111-111111111111', org, n1, 'piłka nożna', 'Orlik Rataje',
    CURRENT_DATE + 3, '18:00', '19:30', 10, 'public',
    'Czwartkowa gierka',
    '[WIZ] Mecz z wolnymi miejscami — zrzut stanu wyjściowego i po dołączeniu.', false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1), (eid, g2, n2);

  -- W02 — komplet, zapis idzie na rezerwę ------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, goalkeepers_enabled)
  VALUES ('22222222-2222-4222-8222-222222222222', org, n1, 'piłka nożna', 'Boisko Malta',
    CURRENT_DATE + 4, '19:00', '20:30', 3, 'public',
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
    CURRENT_DATE + 5, '20:00', '21:30', 14, 'public',
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
    CURRENT_DATE + 6, '20:00', '21:30', 14, 'public',
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
    CURRENT_DATE + 7, '18:00', '19:30', 10, 'public',
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
    CURRENT_DATE + 8, '19:00', '20:30', 3, 'public',
    'Wtorek — kolejka rezerwowa',
    '[WIZ] Skład pełny, w kolejce dwie osoby — widok organizatora z przyciskiem „Do składu".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name)
  VALUES (eid, org, n1), (eid, g2, n2), (eid, g3, n3);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, created_at)
  VALUES (eid, g4, n4, true, now() - interval '2 hours'),
         (eid, g5, n5, true, now() - interval '1 hour');

  -- W07 — mecz płatny ---------------------------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods)
  VALUES ('77777777-7777-4777-8777-777777777777', org, n1, 'piłka nożna', 'Orlik Rataje',
    CURRENT_DATE + 9, '18:00', '19:30', 10, 'public',
    'Środa — płatny',
    '[WIZ] Mecz płatny z dwiema metodami — okno dołączania wymaga wyboru.',
    1500, ARRAY['gotowka','blik']::text[])
  RETURNING id INTO eid;
  -- Numer BLIK od migracji `120` mieszka w osobnej tabeli (RLS — patrz `121`).
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '555111222');
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);

  -- W08 — mecz odwołany --------------------------------------------------
  -- Baner „Mecz odwołany" widać wyłącznie na meczu ze `status = cancelled`,
  -- a odwołanie z poziomu testu wymagałoby natywnego `confirm()` i psułoby
  -- dane innym scenariuszom. Prościej mieć taki mecz od razu w seedzie.
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, status)
  VALUES ('88888888-8888-4888-8888-888888888888', org, n1, 'piłka nożna', 'Orlik Rataje',
    CURRENT_DATE + 10, '18:00', '19:30', 10, 'public',
    'Czwartek — odwołany',
    '[WIZ] Mecz odwołany — baner ostrzegawczy i brak możliwości zapisu.', 'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1), (eid, g2, n2);

  -- W09 — mecz prywatny ---------------------------------------------------
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES ('99999999-9999-4999-8999-999999999999', org, n1, 'piłka nożna', 'Boisko Malta',
    CURRENT_DATE + 11, '19:00', '20:30', 10, 'private',
    'Piątek — tylko z linku',
    '[WIZ] Mecz prywatny — plakietka „Prywatne" i inny opis udostępniania.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1);

  -- W10 — mecz, który się już odbył ---------------------------------------
  -- Data w PRZESZŁOŚCI, więc nie da się zapisać, a organizator widzi miejsce
  -- na wynik. To jedyny mecz w tym seedzie z datą wstecz — reszta liczy się
  -- od dziś do przodu.
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, track_results)
  VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', org, n1, 'piłka nożna', 'Orlik Winogrady',
    CURRENT_DATE - 3, '18:00', '19:30', 10, 'public',
    'Zeszły tydzień — zagrane',
    '[WIZ] Mecz z przeszłości — brak zapisu, widoczna sekcja wyniku.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name)
  VALUES (eid, org, n1), (eid, g2, n2), (eid, g3, n3);


  -- W11 — mecz płatny, KTÓRY JUŻ SIĘ ODBYŁ, z graczem w składzie -------
  -- Po co osobno od W07: `canSeeBlikPhone()` odsłania numer uczestnikowi
  -- dopiero na godzinę przed meczem, więc na meczu za tydzień nie da się
  -- sprawdzić, czy numer w ogóle DOCHODZI z bazy (od migracji `120` leci
  -- osadzeniem z `event_blik`, a nie kolumną w `events`).
  --
  -- Data w PRZESZŁOŚCI zamiast „za pół godziny" jest tu świadoma: godzina
  -- meczu jest czytana w strefie PRZEGLĄDARKI, a data siedzi w bazie bez
  -- strefy. Mecz „za 30 minut" wychodziłby więc inaczej w CI (UTC) niż na
  -- komputerze w Polsce i test raz przechodziłby, raz nie. Mecz sprzed
  -- doby jest przeszły w każdej strefie.
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods)
  VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', org, n1, 'piłka nożna', 'Boisko Malta',
    CURRENT_DATE - 1, '19:00', '20:30', 10, 'public',
    'Wczoraj — płatny, numer BLIK odsłonięty',
    '[WIZ] Uczestnik ma zobaczyć numer BLIK; ktoś spoza składu — zdanie, że zobaczy go po dołączeniu.',
    1500, ARRAY['gotowka','blik']::text[])
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '555111222');
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, org, n1, 'blik'), (eid, gracz, n_gracz, 'blik');

  -- W12 — rozmowa meczu -------------------------------------------------
  -- Zakładkę Rozmowa widzi uczestnik, organizator i członek ekipy meczu
  -- (`czy_widzi_rozmowe_meczu()`, migracja `120`). Ten mecz nie należy do
  -- żadnej ekipy, więc rozstrzyga sam skład: `gracz` jest w środku,
  -- `drugiGracz` nie.
  INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', org, n1, 'piłka nożna', 'Orlik Rataje',
    CURRENT_DATE + 12, '18:00', '19:30', 10, 'public',
    'Za tydzień — rozmowa',
    '[WIZ] Rozmowa meczu: uczestnik czyta i pisze, ktoś spoza składu nie ma nawet zakładki.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, org, n1), (eid, gracz, n_gracz);
  INSERT INTO event_comments (event_id, user_id, user_name, body)
  VALUES (eid, org, n1, 'Parkujemy od strony szkoły, brama otwarta od 17:45.');

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
 WHERE description LIKE '[WIZ]%'
   AND lat IS NULL
   AND field_id IS NULL;

