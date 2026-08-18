-- ============================================================
-- Bojo — SCENARIUSZE DO ZAKŁADKI „TAKTYKA" (migracja 103)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[TAK]" w opisie) i tworzy wszystko od nowa.
--
-- PO CO TO JEST
-- Zakładka „Taktyka" pojawia się dopiero po opublikowaniu składów, więc żeby
-- ją w ogóle zobaczyć, trzeba mieć mecz z podziałem na drużyny. Ręczne
-- klikanie takiego meczu (utwórz → zapisz dziesięć osób → podziel → opublikuj)
-- zajmuje kilka minut ZA KAŻDYM RAZEM, a sprawdzić trzeba kilkanaście
-- wariantów: różne wielkości składu, różne sporty, nierówne drużyny, długie
-- nazwiska. Ten skrypt stawia je wszystkie naraz.
--
-- WYMAGANIA
--   • migracje do `103` włącznie uruchomione,
--   • konta test1..test10@example.com (supabase/seed-test-users.sql),
--   • konto franekks@gmail.com — organizator wszystkich meczów,
--   • konto franciszekpudelko@gmail.com — ZAPISANE do każdego meczu, czyli to,
--     na którym realnie klikasz. Mecze są PRYWATNE, więc widzi je organizator
--     i uczestnicy; bez zapisania nie zobaczyłbyś ich wcale.
--
-- WAŻNE: zakładka „Taktyka" jest dziś widoczna WYŁĄCZNIE dla administratora
-- platformy. Jeśli jej nie widzisz mimo opublikowanych składów — sprawdź, czy
-- na koncie, z którego patrzysz, masz `profiles.is_admin = true`:
--
--   UPDATE profiles SET is_admin = true
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');
--
-- Wymaga też migracji `104` — bez niej zakładka się otworzy, ale każdy zapis
-- skończy się komunikatem o polityce bezpieczeństwa.
--
-- JAK PRZEZ TO PRZEJŚĆ
-- Wejdź na /moje-gry. Mecze mają w tytule numer („T01 …"), a opis zaczyna się
-- od „SPRAWDŹ:" i kończy oczekiwanym wynikiem. T01–T09 to warianty do
-- obejrzenia, T10–T13 to przypadki brzegowe, w których coś ma się NIE pojawić
-- albo nie rozjechać. Na końcu pliku jest zapytanie z listą kontrolną
-- i adresami.
-- ============================================================

DELETE FROM events WHERE description LIKE '[TAK]%';

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

  -- Konto, które ma być ZAPISANE do wszystkich meczów. Osobne od organizatora:
  -- mecze zakłada `franekks`, a gra i ogląda je `franciszekpudelko` — czyli
  -- to konto, na którym realnie klikasz w telefonie.
  fp   UUID := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');

  ja_n TEXT;
  fp_n TEXT;
  eid  UUID;
BEGIN
  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF t1 IS NULL OR t10 IS NULL THEN
    RAISE EXCEPTION 'Brak kont test1..test10 — uruchom najpierw supabase/seed-test-users.sql.';
  END IF;
  IF fp IS NULL THEN
    RAISE EXCEPTION 'Brak konta franciszekpudelko@gmail.com w auth.users — zaloguj się na nie raz do aplikacji.';
  END IF;

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Franek');
  fp_n := COALESCE((SELECT display_name FROM profiles WHERE id = fp), 'Franciszek');

-- ============================================================
-- A. RÓŻNE WIELKOŚCI SKŁADU — czy boisko się mieści na telefonie
-- ============================================================

  -- T01: najczęstszy przypadek w Bojo -----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 2, '19:00', 10, 'private',
    'T01 — 5v5, składy opublikowane',
    '[TAK] SPRAWDŹ: zakładka „Taktyka" jest widoczna, a w niej DWA boiska (Zieloni i Pomarańczowi). OCZEKIWANE: domyślne ustawienie 2-2, pigułki do wyboru tylko na 5 i 6 graczy, wszyscy gracze na dole w „Bez pozycji". Stuknij pozycję, potem gracza — nazwisko ląduje na boisku, a lista pod spodem się skraca.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp,  fp_n,     'A'), (eid, t1, 'Kuba Nowak',      'A'),
    (eid, t2,  'Michał Zieliński', 'A'), (eid, t3, 'Paweł Krupa', 'A'),
    (eid, t4,  'Bartek Sobczyk',   'A'),
    (eid, t5,  'Adam Wierzba',     'B'), (eid, t6, 'Filip Rak',   'B'),
    (eid, t7,  'Janek Bąk',        'B'), (eid, t8, 'Olek Duda',   'B'),
    (eid, t9,  'Tomek Wilk',       'B');

  -- T02: siódemka — najczęstsza przy większym orliku ---------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko Malta', CURRENT_DATE + 3, '20:00', 14, 'private',
    'T02 — 7v7 z bramkarzami',
    '[TAK] SPRAWDŹ: dwóch graczy ma rolę bramkarza. OCZEKIWANE: na liście „Bez pozycji" bramkarze mają rękawicę 🧤, a pigułki ustawień pokazują warianty na 7 i 8 (3-2-1, 2-3-1, 3-1-2). Ustaw bramkarza na pozycji BR i sprawdź, czy inicjały na kółku są czytelne.',
    true, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp,  fp_n,               'A', true),  (eid, t1, 'Kuba Nowak',       'A', false),
    (eid, t2,  'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa',      'A', false),
    (eid, t4,  'Bartek Sobczyk',   'A', false), (eid, t5, 'Adam Wierzba',     'A', false),
    (eid, t6,  'Filip Rak',        'A', false),
    (eid, t7,  'Janek Bąk',        'B', true),  (eid, t8, 'Olek Duda',        'B', false),
    (eid, t9,  'Tomek Wilk',       'B', false), (eid, t10, 'Rafał Zych',      'B', false);
  INSERT INTO event_participants (event_id, name, is_guest, team, is_goalkeeper) VALUES
    (eid, 'Gość Marek',   true, 'B', false),
    (eid, 'Gość Sebastian', true, 'B', false),
    (eid, 'Gość Wojtek',  true, 'B', false);

  -- T03: pełna jedenastka — najciaśniejszy możliwy widok ------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Stadion Miejski', CURRENT_DATE + 4, '17:00', 22, 'private',
    'T03 — 11v11, najciaśniejsze boisko',
    '[TAK] SPRAWDŹ: to jest test czytelności. Ustaw 4-4-2, potem 4-2-3-1 i 3-5-2. OCZEKIWANE: kółka się nie nachodzą, nazwiska nie wychodzą poza murawę, skrajni obrońcy mieszczą się w kadrze. Jeśli coś się zlewa — to jest właśnie ten scenariusz, o którym trzeba mi powiedzieć.',
    true, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp, fp_n, 'A', true), (eid, t1, 'Kuba Nowak', 'A', false),
    (eid, t2, 'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa', 'A', false),
    (eid, t4, 'Bartek Sobczyk', 'A', false), (eid, t5, 'Adam Wierzba', 'A', false),
    (eid, t6, 'Filip Rak', 'B', true), (eid, t7, 'Janek Bąk', 'B', false),
    (eid, t8, 'Olek Duda', 'B', false), (eid, t9, 'Tomek Wilk', 'B', false),
    (eid, t10, 'Rafał Zych', 'B', false);
  -- Reszta jako goście, żeby dobić do 11+11 bez zakładania kolejnych kont.
  INSERT INTO event_participants (event_id, name, is_guest, team)
  SELECT eid, 'Gracz A' || i, true, 'A' FROM generate_series(6, 10) AS i;
  -- Drużyna B ma o jednego konta mniej (t6..t10 to pięć osób wobec sześciu
  -- w A), więc dobija się o jednego gościa więcej — inaczej wyszłoby 11 vs 10
  -- i scenariusz „najciaśniejsze boisko" testowałby ciasno tylko po jednej
  -- stronie.
  INSERT INTO event_participants (event_id, name, is_guest, team)
  SELECT eid, 'Gracz B' || i, true, 'B' FROM generate_series(6, 11) AS i;

  -- T04: ósemka ----------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Winogrady', CURRENT_DATE + 5, '18:30', 16, 'private',
    'T04 — 8v8',
    '[TAK] SPRAWDŹ: pigułki ustawień na 8 i 9 (3-3-1, 4-2-1, 3-3-2, 4-3-1). OCZEKIWANE: po zmianie ustawienia gracze JUŻ USTAWIENI zostają na swoich numerach pozycji — nie wracają wszyscy na ławkę. To celowe: zmiana 4-4-2 na 4-3-3 ma ruszyć tylko to, co się naprawdę zmieniło.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'),
    (eid, t5, 'Adam Wierzba', 'B'), (eid, t6, 'Filip Rak', 'B'),
    (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B');
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES
    (eid, 'Gość Adrian', true, 'A'), (eid, 'Gość Bruno', true, 'A'), (eid, 'Gość Cezary', true, 'A'),
    (eid, 'Gość Damian', true, 'B'), (eid, 'Gość Emil', true, 'B'), (eid, 'Gość Fabian', true, 'B'),
    (eid, 'Gość Gustaw', true, 'B');

-- ============================================================
-- B. INNE SPORTY
-- ============================================================

  -- T05 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'siatkówka', 'Hala Arena', CURRENT_DATE + 6, '19:00', 12, 'private',
    'T05 — siatkówka 6v6',
    '[TAK] SPRAWDŹ: siatkówka nie ma „ustawień", tylko rotację. OCZEKIWANE: jedna pigułka (3-3) z opisem o pozycjach P1–P6, sześć miejsc na boisku, ZERO mowy o bramkarzu. Jeśli boisko z liniami piłkarskimi wygląda tu głupio — to jest do zgłoszenia.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'), (eid, t5, 'Adam Wierzba', 'A'),
    (eid, t6, 'Filip Rak', 'B'), (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B'),
    (eid, t9, 'Tomek Wilk', 'B'), (eid, t10, 'Rafał Zych', 'B');
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES (eid, 'Gość Hubert', true, 'B');

  -- T06 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'koszykówka', 'Boisko Ratajczaka', CURRENT_DATE + 7, '18:00', 6, 'private',
    'T06 — koszykówka 3v3',
    '[TAK] SPRAWDŹ: mały skład, własny zestaw ustawień. OCZEKIWANE: pigułka „2" (czyli 1-2: rozgrywający i dwóch na skrzydłach), trzy miejsca na drużynę.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

-- ============================================================
-- C. PRZYPADKI BRZEGOWE — tu coś ma się NIE pojawić albo nie rozjechać
-- ============================================================

  -- T07: bez publikacji — zakładki NIE MA -------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Dębiec', CURRENT_DATE + 8, '19:00', 10, 'private',
    'T07 — składy PODZIELONE, ale NIEopublikowane',
    '[TAK] SPRAWDŹ: gracze mają przypisane drużyny, ale składy nie są opublikowane. OCZEKIWANE: zakładki „Taktyka" NIE MA w pasku. Opublikuj składy w zakładce Skład — zakładka ma się pojawić od razu, bez odświeżania strony.',
    false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

  -- T08: wszyscy w jednej drużynie --------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Grunwald', CURRENT_DATE + 9, '20:00', 10, 'private',
    'T08 — druga drużyna PUSTA',
    '[TAK] SPRAWDŹ: wszyscy trafili do drużyny Zielonych, Pomarańczowi są puści. OCZEKIWANE: przy pustej drużynie zamiast boiska stoi zdanie „Nikt nie jest przypisany do tej drużyny" — nie puste boisko i nie błąd.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A');

  -- T09: nierówne drużyny ------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Jeżyce', CURRENT_DATE + 10, '19:30', 12, 'private',
    'T09 — nierówne drużyny (6 vs 4)',
    '[TAK] SPRAWDŹ: jedna drużyna ma sześciu, druga czterech. OCZEKIWANE: każda dostaje ustawienia pod SWOJĄ liczbę graczy — sześcioosobowa inne pigułki niż czteroosobowa. Tak wygląda realny mecz, gdy dwie osoby się spóźnią.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'A'), (eid, t4, 'Bartek Sobczyk', 'A'), (eid, t5, 'Adam Wierzba', 'A'),
    (eid, t6, 'Filip Rak', 'B'), (eid, t7, 'Janek Bąk', 'B'), (eid, t8, 'Olek Duda', 'B'),
    (eid, t9, 'Tomek Wilk', 'B');

  -- T10: bardzo długie nazwiska -----------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Naramowice', CURRENT_DATE + 11, '18:00', 10, 'private',
    'T10 — bardzo długie imiona i nazwiska',
    '[TAK] SPRAWDŹ: nazwiska są celowo absurdalnie długie. OCZEKIWANE: pod kółkiem na boisku widać SAMO IMIĘ (pierwszy człon), ucięte jeśli trzeba, i nie rozpycha sąsiadów. Na ławce nazwisko może być pełne — tam jest miejsce.',
    true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'),
    (eid, t1, 'Krzysztof Bączkiewicz-Wodziczko', 'A'),
    (eid, t2, 'Włodzimierz Przybyszewski', 'A'),
    (eid, t3, 'Bartłomiej Świętochowski', 'A'),
    (eid, t4, 'Aleksander Chrząszczyżewoszycki', 'A'),
    (eid, t5, 'LIONEL ANDREAS ŚREDNICKI', 'B'),
    (eid, t6, 'Maksymilian Wielkopolski', 'B'),
    (eid, t7, 'Sebastian Nieprzecinający', 'B'),
    (eid, t8, 'Grzegorz Brzęczyszczykiewicz', 'B'),
    (eid, t9, 'Konstanty Ildefons Gałczyński', 'B');

  -- T11: mecz odwołany ---------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, status)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Piątkowo', CURRENT_DATE + 12, '19:00', 10, 'private',
    'T11 — mecz ODWOŁANY z opublikowanymi składami',
    '[TAK] SPRAWDŹ: mecz odwołany, ale składy były opublikowane. OCZEKIWANE: zakładki „Taktyka" NIE MA — nie ma czego ustawiać dla meczu, który się nie odbędzie.',
    true, 'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name, team) VALUES
    (eid, fp, fp_n, 'A'), (eid, t1, 'Kuba Nowak', 'A'), (eid, t2, 'Michał Zieliński', 'A'),
    (eid, t3, 'Paweł Krupa', 'B'), (eid, t4, 'Bartek Sobczyk', 'B'), (eid, t5, 'Adam Wierzba', 'B');

-- ============================================================
-- D. STAN „PO WYPEŁNIENIU" — jedyny scenariusz, którego nie da się
--    zobaczyć bez klikania przez kilka minut
-- ============================================================

  -- T12 ------------------------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, description, teams_published, goalkeepers_enabled)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik Rataje', CURRENT_DATE + 1, '19:30', 14, 'private',
    'T12 — WSZYSTKO JUŻ USTAWIONE (taktyka, pozycje, czat)',
    '[TAK] SPRAWDŹ: to jest widok „po", którego normalnie trzeba by naklikać. Obie drużyny mają ustawienie, obsadzone pozycje, wybraną taktykę, notatkę o stałych fragmentach i kilka wiadomości w czacie. OCZEKIWANE: wszystko wczytuje się od razu po wejściu w zakładkę; czat drużyny Zielonych NIE zawiera wiadomości Pomarańczowych i odwrotnie.',
    true, true)
  RETURNING id INTO eid;

  INSERT INTO event_participants (event_id, user_id, name, team, is_goalkeeper) VALUES
    (eid, fp,  fp_n,               'A', true),  (eid, t1, 'Kuba Nowak',       'A', false),
    (eid, t2,  'Michał Zieliński', 'A', false), (eid, t3, 'Paweł Krupa',      'A', false),
    (eid, t4,  'Bartek Sobczyk',   'A', false), (eid, t5, 'Adam Wierzba',     'A', false),
    (eid, t6,  'Filip Rak',        'A', false),
    (eid, t7,  'Janek Bąk',        'B', true),  (eid, t8, 'Olek Duda',        'B', false),
    (eid, t9,  'Tomek Wilk',       'B', false), (eid, t10, 'Rafał Zych',      'B', false);
  INSERT INTO event_participants (event_id, name, is_guest, team) VALUES
    (eid, 'Gość Marek', true, 'B'), (eid, 'Gość Sebastian', true, 'B'), (eid, 'Gość Wojtek', true, 'B');

  -- Ustawienie i taktyka obu drużyn.
  INSERT INTO event_team_setup (event_id, team, schemat, taktyka, notatka, updated_by) VALUES
    (eid, 'A', '1-3-2-1',
      '{"krycie":"strefa","wyjscie":"krotko","pressing":"wysoki","tempo":"szybko"}'::jsonb,
      'Rożne bije Kuba, karne Michał. Stałe fragmenty krótko, bez wrzutek.', ja),
    (eid, 'B', '1-2-3-1',
      '{"krycie":"na-wlasnego","wyjscie":"dlugo","pressing":"niski","tempo":"spokojnie"}'::jsonb,
      'Gramy z kontry. Rożne bije Janek.', ja);

  -- Obsadzone pozycje: bramkarz + pierwsza linia każdej drużyny.
  -- Numery slotów odpowiadają `pozycjeZeSchematu()` z `lib/taktyka.ts`:
  -- 0 to bramkarz, potem kolejno od lewej w każdej linii.
  -- Obsadzone pozycje: bramkarz + kolejni gracze wg kolejności zapisu.
  -- `row_number() - 1` daje numery slotów zgodne z `pozycjeZeSchematu()`
  -- w `lib/taktyka.ts`: 0 to bramkarz, potem kolejno linia po linii.
  -- Świadomie NIE obsadzamy wszystkich pozycji — część ma zostać pusta, żeby
  -- było widać oba stany naraz: obsadzoną i wolną.
  INSERT INTO event_team_slots (event_id, team, slot, participant_id)
  SELECT eid, 'A', numer - 1, id FROM (
    SELECT p.id, row_number() OVER (ORDER BY p.created_at, p.name) AS numer
    FROM event_participants p WHERE p.event_id = eid AND p.team = 'A'
  ) q WHERE numer <= 5
  ON CONFLICT DO NOTHING;

  INSERT INTO event_team_slots (event_id, team, slot, participant_id)
  SELECT eid, 'B', numer - 1, id FROM (
    SELECT p.id, row_number() OVER (ORDER BY p.created_at, p.name) AS numer
    FROM event_participants p WHERE p.event_id = eid AND p.team = 'B'
  ) q WHERE numer <= 4
  ON CONFLICT DO NOTHING;

  -- Czat: osobny dla każdej drużyny — to jest cała rzecz do sprawdzenia.
  INSERT INTO event_team_messages (event_id, team, user_id, user_name, body, created_at) VALUES
    (eid, 'A', fp, fp_n, 'Gramy 3-2-1, ja na bramce. Kuba i Michał na bokach.', now() - interval '2 hours'),
    (eid, 'A', t1, 'Kuba Nowak', 'Ok. Ktoś bierze wodę?', now() - interval '1 hour 50 minutes'),
    (eid, 'A', t2, 'Michał Zieliński', 'Biorę. Będę 10 minut wcześniej.', now() - interval '1 hour 40 minutes'),
    (eid, 'B', t7, 'Janek Bąk', 'Cofamy się i gramy z kontry, nie wychodzimy wysoko.', now() - interval '1 hour 30 minutes'),
    (eid, 'B', t8, 'Olek Duda', 'Jasne. Kto na prawej obronie?', now() - interval '1 hour 20 minutes');

  RAISE NOTICE 'Gotowe: 12 scenariuszy taktyki. Wejdź na /moje-gry i zacznij od T12 — tam wszystko jest już ustawione.';
END $$;

-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(e.title, ' — ', 1)  AS nr,
  split_part(e.title, ' — ', 2)  AS scenariusz,
  e.sport,
  e.teams_published              AS skladty_opublikowane,
  e.status,
  (SELECT count(*) FROM event_participants p WHERE p.event_id = e.id AND p.team = 'A') AS zielonych,
  (SELECT count(*) FROM event_participants p WHERE p.event_id = e.id AND p.team = 'B') AS pomaranczowych,
  (SELECT count(*) FROM event_team_slots s WHERE s.event_id = e.id)    AS obsadzonych_pozycji,
  (SELECT count(*) FROM event_team_messages m WHERE m.event_id = e.id) AS wiadomosci,
  '/wydarzenia/' || e.id         AS adres
FROM events e
WHERE e.description LIKE '[TAK]%'
ORDER BY e.title;
