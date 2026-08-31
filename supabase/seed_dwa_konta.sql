-- ============================================================
-- Bojo — SEED POD TESTY DWOMA REALNYMI KONTAMI
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[DWA]" w opisie) i tworzy wszystko od nowa.
--
-- PO CO TO JEST. `seed_przedpremiera.sql` zakłada „Ty + obca osoba bez konta"
-- — dobre pod jednorazową sesję przed wpuszczeniem ludzi. `seed_taktyka.sql`
-- zakłada dwa realne konta, ale tylko pod jedną zakładkę. Tu chodzi o coś
-- innego: MASZ oba konta i chcesz na bieżąco sprawdzać różne przejścia z obu
-- stron naraz — jak organizator (franekks) i jak drugi gracz
-- (franciszekpudelko). Dwanaście osobnych scenariuszy, każdy sprawdza jedną
-- rzecz, tak jak `seed_regresja.sql` — ale tu OBIE strony są prawdziwymi
-- kontami, więc powiadomienia, dzwonek i rozmowy działają naprawdę, nie tylko
-- w bazie.
--
-- WYMAGANIA
--   • migracje do `126` włącznie uruchomione,
--   • konto franekks@gmail.com — organizator wszystkiego,
--   • konto franciszekpudelko@gmail.com — drugi gracz; loguj się na nie
--     osobno (drugą przeglądarkę/tryb prywatny albo drugi telefon), żeby
--     zobaczyć powiadomienia i dzwonek tak, jak zobaczy je realny użytkownik.
--
-- JAK PRZEZ TO PRZEJŚĆ
-- Zaloguj się na oba konta (dwie przeglądarki albo jedna + tryb prywatny).
-- Wejdź na /moje-gry na koncie franekks — mecze mają w tytule numer
-- („D01 …"), opis zaczyna się od „SPRAWDŹ:" i mówi, co zrobić NA KTÓRYM
-- koncie i czego się spodziewać. Idziesz po kolei, przełączając się między
-- kontami tam, gdzie opis o to prosi. Na końcu pliku — lista kontrolna
-- z adresami i kodem dołączenia do ekipy.
--
-- PO TEŚCIE: `supabase/wyczysc-testowe.sql` kasuje to razem z resztą danych
-- testowych. Nie zostawiaj tego w bazie, do której wpuszczasz ludzi.
-- ============================================================

DO $$
DECLARE
  ja    UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  fp    UUID := (SELECT id FROM auth.users WHERE email = 'franciszekpudelko@gmail.com');
  ja_n  TEXT;
  fp_n  TEXT;
  eid   UUID;
  gid   UUID;
  kod   TEXT;
  -- Godzina D06 jest czytana w strefie PRZEGLĄDARKI, a `event_time` siedzi
  -- w bazie bez strefy — patrz `seed_przedpremiera.sql`, ten sam powód: bez
  -- przeliczenia numer BLIK nie odsłoniłby się w oknie „za godzinę przed
  -- meczem" (`canSeeBlikPhone`).
  teraz TIMESTAMP := (now() AT TIME ZONE 'Europe/Warsaw');
  brak  TEXT[] := '{}';
BEGIN
  -- SPRAWDZENIE SCHEMATU — jeden znacznik na obszar funkcji, nie na każdą
  -- migrację z osobna (ten seed używa niemal całego schematu). Cel: jeden
  -- czytelny komunikat, czego brakuje, zamiast „column ... does not exist"
  -- w połowie przebiegu — patrz `seed_przedpremiera.sql` po uzasadnienie.
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF to_regclass('public.event_player_invites') IS NULL THEN
    brak := brak || '060_zaproszenia_na_mecz.sql — brak tabeli event_player_invites'::text;
  END IF;
  IF to_regclass('public.dm_conversations') IS NULL THEN
    brak := brak || '125_rozmowy_prywatne.sql — brak tabeli dm_conversations'::text;
  END IF;
  IF to_regclass('public.group_posts') IS NULL THEN
    brak := brak || '093_tablica_grupy.sql — brak tabeli group_posts'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz do aplikacji.';
  END IF;
  IF fp IS NULL THEN
    RAISE EXCEPTION 'Brak konta franciszekpudelko@gmail.com w auth.users — zaloguj się na nie raz do aplikacji.';
  END IF;

  -- Kasowanie poprzedniego przebiegu ZA sprawdzeniami — nieudany seed ma
  -- zostawić bazę taką, jaką zastał, patrz `seed_przedpremiera.sql`.
  DELETE FROM events WHERE description LIKE '[DWA]%';
  DELETE FROM groups WHERE name = '[DWA] Ekipa testowa';
  DELETE FROM dm_messages WHERE content LIKE '[DWA]%';
  DELETE FROM dm_conversations
   WHERE (low_user_id = LEAST(ja, fp) AND high_user_id = GREATEST(ja, fp))
     AND NOT EXISTS (
       SELECT 1 FROM dm_messages m
       WHERE m.low_user_id = LEAST(ja, fp) AND m.high_user_id = GREATEST(ja, fp)
     );

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Franek');
  fp_n := COALESCE((SELECT display_name FROM profiles WHERE id = fp), 'Franciszek');

  -- D01 — wolne miejsca + rozmowa meczu ----------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 1, '19:00', '20:30', 10, 'public',
    'D01 — wolne miejsca',
    '[DWA] SPRAWDŹ: [franciszekpudelko] otwiera mecz i klika „Dołącz" — wchodzi do składu od razu, licznik się aktualizuje bez odświeżania. Obie strony piszą coś w zakładce „Rozmowa" — [franekks] ma zobaczyć chmurkę i różową plakietkę na dolnej nawigacji, gdy druga strona odpisze.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D02 — komplet i kolejka: rezerwa, potem oferta po wypisaniu -----------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 2, '19:00', '20:30', 2, 'public',
    'D02 — komplet i kolejka',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Dołącz" przy komplecie — komunikat ma mówić WPROST o rezerwie, nie „Dołączyłeś do meczu!". Potem [franekks] wypisuje gościa „Kolega" ze składu (przycisk przy jego nazwisku). [franciszekpudelko] ma dostać OFERTĘ zwolnionego miejsca — powiadomienie w dzwonku i widoczny stan na stronie meczu, nie ciche wejście do składu (auto-awansu nie ma, to decyzja produktowa).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Kolega', true);

  -- D03 — bramkarze, osobny limit ------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 3, '19:00', '20:30', 10, 'public',
    'D03 — bramkarze, osobny limit',
    '[DWA] SPRAWDŹ: limit bramkarzy to 1, jeden gość już go zajął. [franciszekpudelko] dołącza jako bramkarz (przełącznik roli w oknie dołączania) — mimo że w POLU jest mnóstwo wolnych miejsc, ma wylądować na REZERWIE bramkarzy, bo tryb jest „osobny limit". To jest różnica względem D04 — warto zobaczyć oba na raz.',
    true, 1, true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, name, is_guest, is_goalkeeper)
  VALUES (eid, 'Gość — bramkarz', true, true);

  -- D04 — bramkarze, wspólna pula ------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      goalkeepers_enabled, max_goalkeepers, goalkeeper_slots_reserved)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 3, '20:00', '21:30', 10, 'public',
    'D04 — bramkarze, wspólna pula',
    '[DWA] SPRAWDŹ: ten sam limit bramkarzy (1), ale tryb „wspólna pula". [franciszekpudelko] dołącza jako bramkarz — wchodzi normalnie do składu, bez osobnej kolejki. Porównaj z D03: identyczne ustawienia liczbowe, inny skutek.',
    true, 1, false)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D05 — wymaga akceptacji ------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 4, '19:00', '20:30', 10, 'public',
    'D05 — wymaga akceptacji',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Dołącz" — ma zobaczyć, że CZEKA na decyzję organizatora, i dowiedzieć się, jak się o niej dowie. [franekks] dostaje prośbę (dzwonek albo /moje-gry) i akceptuje. [franciszekpudelko] sprawdza, czy stan zmienił się BEZ odświeżania strony.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D06 — płatny, karta sportowa, BLIK, blisko startu ----------------------
  -- Godzina blisko „teraz": numer BLIK odsłania się dopiero na godzinę przed
  -- startem (`canSeeBlikPhone`) — patrz `seed_przedpremiera.sql`, ten sam trik.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods,
                      accepted_sports_cards, sports_card_discount_grosz, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Hala — testy dwóch kont',
    (teraz + interval '45 minutes')::date,
    date_trunc('minute', teraz + interval '45 minutes')::time, NULL, 10, 'public',
    'D06 — płatny, karta sportowa, BLIK',
    '[DWA] SPRAWDŹ: [franciszekpudelko] PRZED zapisaniem otwiera okno dołączania i wybiera BLIK — ma zobaczyć ZDANIE, że numer pokaże się po dołączeniu, nie sam numer. Zaznacz i odznacz „mam kartę sportową" — cena ma się różnić o 10 zł. Po zapisaniu numer BLIK jest widoczny na karcie „Twoja płatność" (mecz zaczyna się za mniej niż godzinę).',
    2500, ARRAY['blik','gotowka']::text[], ARRAY['multisport']::text[], 1000, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, ja, ja_n, 'blik');

  -- D07 — gość bez konta → przejęcie wpisu ---------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, allow_guest_adds)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 5, '18:30', '20:00', 10, 'public',
    'D07 — gość bez konta',
    '[DWA] SPRAWDŹ: przy „Gość do przejęcia" kliknij „Zaproś do Bojo" (przycisk przy jego nazwisku) — skopiuj link. Otwórz go na koncie [franciszekpudelko] i przejmij wpis. Ma wejść do składu JAKO ON, wpis gościa ma zniknąć — nie może powstać drugi wiersz obok.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, name, is_guest)
  VALUES (eid, 'Gość do przejęcia', true);

  -- D08 — ekipa: kod dołączenia, prywatny mecz przez grupę, tablica -------
  INSERT INTO groups (name, created_by, description)
  VALUES ('[DWA] Ekipa testowa', ja, 'Ekipa do testów dwoma kontami — kasowana razem z resztą danych testowych.')
  RETURNING id, join_code INTO gid, kod;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, group_id)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 6, '20:00', '21:30', 10, 'private',
    'D08 — mecz ekipy (prywatny)',
    '[DWA] SPRAWDŹ: [franciszekpudelko] NIE jest jeszcze w ekipie — na /grupy wybierz „Masz kod?" i wpisz kod z listy kontrolnej na końcu tego seeda. Po dołączeniu ma zobaczyć TEN mecz, mimo że jest PRYWATNY (bo należy do ekipy) — i dostać powiadomienie o wpisie, który [franekks] doda niżej na tablicy ekipy. Dołącz też do składu i napisz coś w Rozmowie meczu.', gid)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO group_posts (group_id, user_id, user_name, body)
  VALUES (gid, ja, ja_n, '[DWA] Zbieramy się 10 minut wcześniej, brama od strony parkingu. Kto jeszcze dołącza?');

  -- D09 — imienne zaproszenie na mecz --------------------------------------
  -- Osobne od D08: to jest zaproszenie NA KONKRETNY MECZ (migracja 060), nie
  -- widoczność przez ekipę — działa nawet bez wspólnej grupy.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 7, '19:00', '20:30', 10, 'public',
    'D09 — imienne zaproszenie na mecz',
    '[DWA] SPRAWDŹ: [franciszekpudelko] ma zobaczyć ten mecz w zakładce „Zaproszenia" na /moje-gry, mimo że nie klikał żadnego linku — zaproszenie NIE zajmuje miejsca w składzie. Zareaguj (dołącz albo odrzuć) i sprawdź, czy zaproszenie znika z listy.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_player_invites (event_id, user_id, invited_by)
  VALUES (eid, fp, ja);

  -- D10 — rozegrany mecz: wynik, rozliczenie, historia ---------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_results, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE - 1, '19:00', '20:30', 6, 'public',
    'D10 — po meczu: wynik i kasa',
    '[DWA] SPRAWDŹ: [franekks] wpisuje wynik z golami, oznacza kto zapłacił (zostaw [franciszekpudelko] jako niezapłaconego, oznacz resztę), wysyła rozliczenie ekipie — czy wiadomość da się przeczytać bez tłumaczenia? [franciszekpudelko] sprawdza kartę „Twoja płatność" (ma pokazywać, że jest winien) i zakładkę „Historia" na /moje-gry — mecz ma tam być, ze statystykami widocznymi też na własnym profilu gracza.',
    2000, ARRAY['blik','gotowka']::text[], true, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, ja, ja_n, 'blik', true),
    (eid, fp, fp_n, 'gotowka', false);
  INSERT INTO event_participants (event_id, name, is_guest, payment_method, has_paid) VALUES
    (eid, 'Kuba (gość)', true, 'blik', true);

  -- D11 — mecz odwołany -----------------------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, status)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — testy dwóch kont',
    CURRENT_DATE + 8, '19:00', '20:30', 10, 'public',
    'D11 — mecz odwołany',
    '[DWA] SPRAWDŹ: [franciszekpudelko] otwiera mecz — ma zobaczyć baner o odwołaniu zamiast możliwości zapisu, bez czerwonego odliczenia do startu.',
    'cancelled')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- D12 — obserwuję, potem dołączam -----------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — testy dwóch kont',
    CURRENT_DATE + 9, '19:00', '20:30', 10, 'public',
    'D12 — obserwuję, potem dołączam',
    '[DWA] SPRAWDŹ: [franciszekpudelko] klika „Obserwuj" — ma pojawić się na liście, ale NIE zajmować miejsca w składzie (licznik się nie rusza) i widnieć w zakładce „Obserwuję" na /moje-gry. Potem klika „Dołącz" z tego samego miejsca — wchodzi do składu, bez błędu „już zapisany".')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- Rozmowa prywatna — jeden wiadomość startowa, żeby [franciszekpudelko]
  -- od razu zobaczył różową plakietkę na /rozmowy i chmurkę na dolnej
  -- nawigacji, zamiast klikać w pustkę. Odpowiedź jest już żywym testem.
  INSERT INTO dm_conversations (low_user_id, high_user_id)
  VALUES (LEAST(ja, fp), GREATEST(ja, fp))
  ON CONFLICT DO NOTHING;
  INSERT INTO dm_messages (low_user_id, high_user_id, sender_id, sender_name, content)
  VALUES (LEAST(ja, fp), GREATEST(ja, fp), ja, ja_n,
    '[DWA] Cześć! To testowa wiadomość prywatna — odpisz stąd, żeby sprawdzić drugą stronę.');

  RAISE NOTICE 'Gotowe: 12 scenariuszy + rozmowa prywatna + ekipa (kod: %). Wejdź na /moje-gry na obu kontach.', kod;
END $$;

-- ============================================================
-- WSPÓŁRZĘDNE — żeby zaseedowane mecze były widoczne NA MAPIE
-- ============================================================
-- Ten sam deterministyczny rozrzut co w `seed_przedpremiera.sql`
-- i `seed_taktyka.sql` — mecz zawsze w tym samym miejscu (zrzuty ekranu się
-- nie ruszają), różny dla różnych meczów (pinezki się nie nakładają).
UPDATE events
   SET lat = 52.4064 + ((hashtext(coalesce(title, id::text)) % 220) / 10000.0),
       lng = 16.9252 + ((hashtext(coalesce(title, id::text) || 'x') % 320) / 10000.0)
 WHERE description LIKE '[DWA]%'
   AND lat IS NULL
   AND field_id IS NULL;

-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  split_part(title, ' — ', 2)  AS scenariusz,
  event_date                   AS termin,
  event_time                   AS godzina,
  status,
  '/wydarzenia/' || id         AS adres
FROM events
WHERE description LIKE '[DWA]%'
ORDER BY title;

-- Kod dołączenia do „[DWA] Ekipa testowa" — potrzebny w D08.
SELECT join_code AS kod_ekipy, '/grupy' AS gdzie_wpisac
FROM groups WHERE name = '[DWA] Ekipa testowa';
