-- ============================================================
-- Bojo — przykładowe wydarzenia i grupa do zrzutów ekranu na landing
-- ============================================================
-- Cel: landing dla niezalogowanych ma pokazywać PRAWDZIWE zrzuty ekranu
-- (nie makiety rysowane w JSX). Ten plik dokłada do PRODUKCYJNEJ bazy garść
-- ładnie wypełnionych wydarzeń i jedną grupę pod konto, z którego robione są
-- zrzuty, żeby było co fotografować.
--
-- WAŻNE — opis (`events.description`, `groups.description`) renderuje się
-- WPROST na stronie (EventDetailClient.tsx, GroupDetailClient.tsx). Pierwsza
-- wersja tego pliku miała tam marker "[DEMO-LANDING] Przykładowe…" i było go
-- widać na zrzucie ekranu wysyłanym na landing. Nie rób tego drugi raz —
-- opisy niżej są neutralne, brzmią jak prawdziwe wpisy organizatora.
--
-- Numer BLIK od migracji `120` siedzi w osobnej tabeli `event_blik`
-- (RLS: widzi go tylko organizator/delegat/uczestnik), nie w `events`.
--
-- Znakowanie do sprzątania idzie przez `custom_location_name` — kolumna
-- używana WYŁĄCZNIE jako podpowiedź w formularzu edycji lokalizacji, kiedy
-- `field_id`/`field_name` nie są ustawione. Skoro tu zawsze ustawiamy realny
-- `field_id`, `custom_location_name` nigdzie się nie renderuje — bezpieczny,
-- niewidoczny znacznik. Sprzątanie:
--   DELETE FROM events WHERE custom_location_name = '__landing-demo__';
--   DELETE FROM groups WHERE name = 'Ekipa z Grunwaldu' AND created_by = (SELECT id FROM auth.users WHERE email = 'edooqoo@gmail.com');
--
-- Bezpieczne do wielokrotnego uruchomienia: najpierw czyści po znaczniku.
-- ============================================================

DELETE FROM events WHERE custom_location_name = '__landing-demo__';
DELETE FROM groups WHERE name = 'Ekipa z Grunwaldu' AND created_by = (SELECT id FROM auth.users WHERE email = 'edooqoo@gmail.com');

DO $$
DECLARE
  org      UUID := (SELECT id FROM auth.users WHERE email = 'edooqoo@gmail.com');
  org_name TEXT;
  t1 UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  t2 UUID := (SELECT id FROM auth.users WHERE email = 'test2@example.com');
  t3 UUID := (SELECT id FROM auth.users WHERE email = 'test3@example.com');
  t4 UUID := (SELECT id FROM auth.users WHERE email = 'test4@example.com');
  t5 UUID := (SELECT id FROM auth.users WHERE email = 'test5@example.com');
  n1 TEXT; n2 TEXT; n3 TEXT; n4 TEXT; n5 TEXT;
  gid UUID;
  eid_a UUID;
  eid_b UUID;
BEGIN
  IF org IS NULL THEN
    RAISE EXCEPTION 'Brak konta edooqoo@gmail.com — nie ma pod kogo podpiąć wydarzeń.';
  END IF;
  org_name := COALESCE((SELECT display_name FROM profiles WHERE id = org), 'Edo');
  n1 := COALESCE((SELECT display_name FROM profiles WHERE id = t1), 'Jakub Kowalski');
  n2 := COALESCE((SELECT display_name FROM profiles WHERE id = t2), 'Mateusz Nowak');
  n3 := COALESCE((SELECT display_name FROM profiles WHERE id = t3), 'Piotr Wiśniewski');
  n4 := COALESCE((SELECT display_name FROM profiles WHERE id = t4), 'Kacper Wójcik');
  n5 := COALESCE((SELECT display_name FROM profiles WHERE id = t5), 'Michał Kamiński');

  -- GRUPA — właściciel dostaje się do group_members automatycznie
  -- (trigger `on_group_created`, migracja 044).
  INSERT INTO groups (name, description, sport, city, field_id, field_name, created_by)
  VALUES (
    'Ekipa z Grunwaldu',
    'Stała ekipa na Grunwaldzie — gramy w czwartki wieczorem, czasem coś dokładamy w weekend. Otwarci na nowych, wystarczy dołączyć przez link.',
    'piłka nożna', 'Poznań',
    'c0000000-0000-0000-0000-000000000008', 'Boisko Grunwald',
    org
  ) RETURNING id INTO gid;

  IF t1 IS NOT NULL THEN INSERT INTO group_members (group_id, user_id, role) VALUES (gid, t1, 'member'); END IF;
  IF t2 IS NOT NULL THEN INSERT INTO group_members (group_id, user_id, role) VALUES (gid, t2, 'member'); END IF;
  IF t3 IS NOT NULL THEN INSERT INTO group_members (group_id, user_id, role) VALUES (gid, t3, 'member'); END IF;
  IF t4 IS NOT NULL THEN INSERT INTO group_members (group_id, user_id, role) VALUES (gid, t4, 'member'); END IF;
  IF t5 IS NOT NULL THEN INSERT INTO group_members (group_id, user_id, role) VALUES (gid, t5, 'member'); END IF;

  -- MECZ — przed meczem, przypięty do grupy powyżej (żeby "Najbliższy mecz"
  -- na widoku grupy i standalone widok wydarzenia to ten sam, spójny zrzut).
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved,
    cost_grosz, accepted_payment_methods,
    accepted_sports_cards, sports_card_discount_grosz, group_id, custom_location_name
  ) VALUES (
    org, org_name, 'piłka nożna', 'c0000000-0000-0000-0000-000000000008', 'Boisko Grunwald', 52.40492, 16.89920,
    'Czwartkowa ligówka',
    'Gramy na sztucznej trawie, zabierzcie turfy. Zbiórka 15 minut przed, rozgrzewka wspólna.',
    CURRENT_DATE + 1, '18:00', '19:30',
    14, 'public', true, 2, false,
    1500, ARRAY['blik','gotowka']::text[],
    ARRAY['multisport']::text[], 1000, gid, '__landing-demo__'
  ) RETURNING id INTO eid_a;

  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid_a, '500100200');

  INSERT INTO event_participants (event_id, user_id, name, is_goalkeeper) VALUES
    (eid_a, org, org_name, false),
    (eid_a, t1, n1, false),
    (eid_a, t2, n2, true),
    (eid_a, t3, n3, false),
    (eid_a, t4, n4, false),
    (eid_a, NULL, 'Bartosz Kaczmarek', false),
    (eid_a, NULL, 'Damian Wróbel', false),
    (eid_a, NULL, 'Łukasz Sikora', false);

  INSERT INTO event_comments (event_id, user_id, user_name, body) VALUES
    (eid_a, org, org_name, 'Dogramy do 14, jak ktoś ma chętnego znajomego to śmiało.'),
    (eid_a, t1, n1, 'Będę, mogę wziąć piłki zapasowe.');

  -- MECZ — po meczu, komplet, wynik wpisany.
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, track_results, track_payments, show_payment_status,
    cost_grosz, accepted_payment_methods, custom_location_name
  ) VALUES (
    org, org_name, 'piłka nożna', 'c0000000-0000-0000-0000-000000000001', 'Orlik Rataje', 52.39089, 16.94492,
    'Niedzielna liga',
    'Ligowe 7v7, drugi mecz z rzędu na tym boisku. Kto zostaje na piwo, daje znać na grupie.',
    CURRENT_DATE - 3, '19:00', '20:30',
    14, 'public', true, true, true,
    1500, ARRAY['blik','gotowka']::text[], '__landing-demo__'
  ) RETURNING id INTO eid_b;

  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid_b, '500100200');

  INSERT INTO event_participants (event_id, user_id, name, has_paid) VALUES
    (eid_b, org, org_name, true),
    (eid_b, t1, n1, true),
    (eid_b, t2, n2, true),
    (eid_b, t3, n3, true),
    (eid_b, t4, n4, true),
    (eid_b, t5, n5, false);
  INSERT INTO event_participants (event_id, user_id, name, is_guest, has_paid) VALUES
    (eid_b, NULL, 'Sebastian Pawlak', true, true),
    (eid_b, NULL, 'Grzegorz Adamczyk', true, true),
    (eid_b, NULL, 'Marcin Dudek', true, true),
    (eid_b, NULL, 'Rafał Baran', true, true),
    (eid_b, NULL, 'Krzysztof Michalski', true, false),
    (eid_b, NULL, 'Dawid Olszewski', true, true),
    (eid_b, NULL, 'Bartosz Kaczmarek', true, true),
    (eid_b, NULL, 'Damian Wróbel', true, true);

  INSERT INTO match_results (event_id, score_a, score_b, recorded_by, winner) VALUES
    (eid_b, 6, 4, org, 'A');

  INSERT INTO event_comments (event_id, user_id, user_name, body) VALUES
    (eid_b, org, org_name, 'Dzięki za grę! Ten sam skład za dwa tygodnie?');

  -- Dwa dodatkowe otwarte wydarzenia — żeby lista /wydarzenia miała czym
  -- wypełnić kafelki obok "Czwartkowej ligówki".
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, cost_grosz, custom_location_name
  ) VALUES (
    org, org_name, 'siatkówka', 'c0000000-0000-0000-0000-000000000009', 'Hala Sportowa Politechniki Poznańskiej', 52.40266, 16.94807,
    'Siatkówka 6v6 — hala',
    'Gramy w hali 2×30 min, równe składy losowane na miejscu. Obuwie na halę obowiązkowe.',
    CURRENT_DATE + 2, '19:00', '20:30',
    12, 'public', 0, '__landing-demo__'
  ) RETURNING id INTO eid_a;
  INSERT INTO event_participants (event_id, user_id, name, is_guest) VALUES
    (eid_a, org, org_name, false),
    (eid_a, NULL, 'Igor Jakubowski', true),
    (eid_a, NULL, 'Filip Rutkowski', true),
    (eid_a, NULL, 'Wojciech Zawadzki', true),
    (eid_a, NULL, 'Konrad Sadowski', true),
    (eid_a, NULL, 'Kamil Walczak', true),
    (eid_a, NULL, 'Patryk Stępień', true),
    (eid_a, NULL, 'Hubert Górski', true),
    (eid_a, NULL, 'Oskar Witkowski', true),
    (eid_a, NULL, 'Dawid Olszewski', true);

  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, cost_grosz, custom_location_name
  ) VALUES (
    org, org_name, 'siatkówka plażowa', '00000000-0000-0000-0000-000000000003', 'Beach Arena — Beach Volleyball Academy', 52.45084, 16.86222,
    'Plażówka po pracy',
    'Piasek, dwa boiska, luźna gra do dwóch wygranych setów. Miksujemy pary między setami.',
    CURRENT_DATE + 4, '17:30', '19:00',
    8, 'public', 800, '__landing-demo__'
  ) RETURNING id INTO eid_b;
  INSERT INTO event_participants (event_id, user_id, name, is_guest) VALUES
    (eid_b, org, org_name, false),
    (eid_b, NULL, 'Adrian Mazur', true),
    (eid_b, NULL, 'Paweł Krawczyk', true),
    (eid_b, NULL, 'Krzysztof Michalski', true),
    (eid_b, NULL, 'Patryk Stępień', true);

  RAISE NOTICE 'Grupa: %', gid;
  RAISE NOTICE 'Gotowe.';
END $$;

SELECT 'grupa' AS typ, id, name AS tytul FROM groups WHERE name = 'Ekipa z Grunwaldu'
UNION ALL
SELECT 'wydarzenie', id, title FROM events WHERE custom_location_name = '__landing-demo__'
ORDER BY typ, tytul;
