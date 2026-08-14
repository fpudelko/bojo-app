-- ============================================================
-- Bojo — przykładowe wydarzenia do zrzutów ekranu na landing
-- ============================================================
-- Cel: landing dla niezalogowanych ma pokazywać PRAWDZIWE zrzuty ekranu
-- (nie makiety rysowane w JSX) trzech widoków: /wydarzenia/[id] przed meczem,
-- /wydarzenia/[id] po meczu (z wynikiem) i /wydarzenia (lista otwartych gier).
-- Ten plik dokłada do PRODUKCYJNEJ bazy garść ładnie wypełnionych wydarzeń pod
-- konto właściciela (j4n.brz0@gmail.com), żeby było co fotografować.
--
-- Wszystkie wiersze mają marker `[DEMO-LANDING]` w opisie — sprzątanie:
--   DELETE FROM events WHERE description LIKE '[DEMO-LANDING]%';
-- (kasuje kaskadowo uczestników, komentarze i wynik).
--
-- Bezpieczne do wielokrotnego uruchomienia: najpierw czyści po markerze.
-- ============================================================

DELETE FROM events WHERE description LIKE '[DEMO-LANDING]%';

DO $$
DECLARE
  org      UUID := (SELECT id FROM auth.users WHERE email = 'j4n.brz0@gmail.com');
  org_name TEXT;
  eid_a UUID;
  eid_b UUID;
BEGIN
  IF org IS NULL THEN
    RAISE EXCEPTION 'Brak konta j4n.brz0@gmail.com — nie ma pod kogo podpiąć wydarzeń.';
  END IF;
  org_name := COALESCE((SELECT display_name FROM profiles WHERE id = org), 'Jan Brzo');

  -- A — PRZED MECZEM: jutro wieczorem, 8/14, wolne miejsca, płatny, Multisport,
  -- bramkarz w składzie, kilka komentarzy. To ma być zrzut ekranu widoku
  -- /wydarzenia/[id] pokazywany na landingu jako "widok wydarzenia przed meczem".
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved,
    cost_grosz, accepted_payment_methods, blik_phone,
    accepted_sports_cards, sports_card_discount_grosz
  ) VALUES (
    org, org_name, 'piłka nożna', 'c0000000-0000-0000-0000-000000000008', 'Boisko Grunwald', 52.40492, 16.89920,
    'Czwartkowa ligówka',
    '[DEMO-LANDING] Przykładowe wydarzenie do zrzutu ekranu na landing (widok „przed meczem"). Bezpieczne do usunięcia po zrobieniu screenshotów.',
    CURRENT_DATE + 1, '18:00', '19:30',
    14, 'public', true, 2, false,
    1500, ARRAY['blik','gotowka']::text[], '500100200',
    ARRAY['multisport']::text[], 1000
  ) RETURNING id INTO eid_a;

  INSERT INTO event_participants (event_id, user_id, name, is_guest, is_goalkeeper) VALUES
    (eid_a, org, org_name, false, false),
    (eid_a, NULL, 'Marek Wiśniewski', true, true),
    (eid_a, NULL, 'Ania Pawlak', true, false),
    (eid_a, NULL, 'Tomasz Lis', true, false),
    (eid_a, NULL, 'Kacper Wójcik', true, false),
    (eid_a, NULL, 'Bartosz Kaczmarek', true, false),
    (eid_a, NULL, 'Damian Wróbel', true, false),
    (eid_a, NULL, 'Łukasz Sikora', true, false);

  -- event_comments.user_id jest NOT NULL — goście bez konta nie komentują,
  -- więc wszystkie komentarze idą od jedynego prawdziwego konta w tym seedzie.
  INSERT INTO event_comments (event_id, user_id, user_name, body) VALUES
    (eid_a, org, org_name, 'Ekipa, pamiętajcie o turfach — nawierzchnia sztuczna.'),
    (eid_a, org, org_name, 'Dogramy do 14, jak ktoś ma chętnego znajomego to śmiało.');

  -- B — PO MECZU: trzy dni temu, komplet 14/14, wynik wpisany, płatności
  -- odhaczone, kilka komentarzy po grze. Zrzut ekranu widoku "po meczu".
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, track_results, track_payments, show_payment_status,
    cost_grosz, accepted_payment_methods, blik_phone
  ) VALUES (
    org, org_name, 'piłka nożna', 'c0000000-0000-0000-0000-000000000001', 'Orlik Rataje', 52.39089, 16.94492,
    'Niedzielna liga',
    '[DEMO-LANDING] Przykładowe wydarzenie do zrzutu ekranu na landing (widok „po meczu"). Bezpieczne do usunięcia po zrobieniu screenshotów.',
    CURRENT_DATE - 3, '19:00', '20:30',
    14, 'public', true, true, true,
    1500, ARRAY['blik','gotowka']::text[], '500100200'
  ) RETURNING id INTO eid_b;

  INSERT INTO event_participants (event_id, user_id, name, is_guest, has_paid) VALUES
    (eid_b, org, org_name, false, true),
    (eid_b, NULL, 'Marek Wiśniewski', true, true),
    (eid_b, NULL, 'Ania Pawlak', true, true),
    (eid_b, NULL, 'Tomasz Lis', true, true),
    (eid_b, NULL, 'Kacper Wójcik', true, true),
    (eid_b, NULL, 'Bartosz Kaczmarek', true, false),
    (eid_b, NULL, 'Damian Wróbel', true, true),
    (eid_b, NULL, 'Łukasz Sikora', true, true),
    (eid_b, NULL, 'Sebastian Pawlak', true, true),
    (eid_b, NULL, 'Grzegorz Adamczyk', true, true),
    (eid_b, NULL, 'Marcin Dudek', true, true),
    (eid_b, NULL, 'Rafał Baran', true, true),
    (eid_b, NULL, 'Krzysztof Michalski', true, false),
    (eid_b, NULL, 'Dawid Olszewski', true, true);

  INSERT INTO match_results (event_id, score_a, score_b, recorded_by, winner) VALUES
    (eid_b, 6, 4, org, 'A');

  INSERT INTO event_comments (event_id, user_id, user_name, body) VALUES
    (eid_b, org, org_name, 'Dzięki za grę! Ten sam skład za dwa tygodnie?');

  -- C, D — jeszcze DWA otwarte wydarzenia o innej porze/sporcie, żeby lista
  -- /wydarzenia miała czym wypełnić kafelki (widok "lista otwartych gier").
  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, cost_grosz
  ) VALUES (
    org, org_name, 'siatkówka', 'c0000000-0000-0000-0000-000000000009', 'Hala Sportowa Politechniki Poznańskiej', 52.40266, 16.94807,
    'Siatkówka 6v6 — hala',
    '[DEMO-LANDING] Przykładowe wydarzenie do zrzutu ekranu na landing (lista /wydarzenia). Bezpieczne do usunięcia po zrobieniu screenshotów.',
    CURRENT_DATE + 2, '19:00', '20:30',
    12, 'public', 0
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
    max_players, visibility, cost_grosz
  ) VALUES (
    org, org_name, 'siatkówka plażowa', '00000000-0000-0000-0000-000000000003', 'Beach Arena — Beach Volleyball Academy', 52.45084, 16.86222,
    'Plażówka po pracy',
    '[DEMO-LANDING] Przykładowe wydarzenie do zrzutu ekranu na landing (lista /wydarzenia). Bezpieczne do usunięcia po zrobieniu screenshotów.',
    CURRENT_DATE + 4, '17:30', '19:00',
    8, 'public', 800
  ) RETURNING id INTO eid_b;
  INSERT INTO event_participants (event_id, user_id, name, is_guest) VALUES
    (eid_b, org, org_name, false),
    (eid_b, NULL, 'Adrian Mazur', true),
    (eid_b, NULL, 'Paweł Krawczyk', true),
    (eid_b, NULL, 'Krzysztof Michalski', true),
    (eid_b, NULL, 'Patryk Stępień', true);

  INSERT INTO events (
    organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
    title, description, event_date, event_time, end_time,
    max_players, visibility, cost_grosz
  ) VALUES (
    org, org_name, 'koszykówka', 'fe0fffcf-3ddf-42ae-836a-fe761c7299cb', 'Boisko do koszykówki', 52.412883, 16.930522,
    'Streetball 3x3',
    '[DEMO-LANDING] Przykładowe wydarzenie do zrzutu ekranu na landing (lista /wydarzenia). Bezpieczne do usunięcia po zrobieniu screenshotów.',
    CURRENT_DATE + 5, '18:00', '19:30',
    6, 'public', 0
  ) RETURNING id INTO eid_a;
  INSERT INTO event_participants (event_id, user_id, name, is_guest) VALUES
    (eid_a, org, org_name, false),
    (eid_a, NULL, 'Oskar Witkowski', true),
    (eid_a, NULL, 'Hubert Górski', true),
    (eid_a, NULL, 'Filip Rutkowski', true);

  RAISE NOTICE 'Gotowe. Wydarzenie "przed meczem": %', (SELECT id FROM events WHERE title = 'Czwartkowa ligówka' AND description LIKE '[DEMO-LANDING]%');
  RAISE NOTICE 'Wydarzenie "po meczu": %', (SELECT id FROM events WHERE title = 'Niedzielna liga' AND description LIKE '[DEMO-LANDING]%');
END $$;
