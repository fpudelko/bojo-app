-- ============================================================
-- Bojo — SEED POD SESJĘ PRZEDPREMIEROWĄ (dwa telefony, ~45 minut)
-- ============================================================
-- To NIE jest migracja. Wklej całość w Supabase → SQL Editor i uruchom.
-- Bezpieczne do wielokrotnego uruchamiania: kasuje poprzedni przebieg
-- (marker „[PRZED]" w opisie) i tworzy wszystko od nowa.
--
-- CZYM SIĘ RÓŻNI OD `seed_regresja.sql`. Tamten ma 43 mecze i każdy sprawdza
-- JEDNĄ rzecz — to materiał na testy automatyczne, nie na klikanie ręką.
-- Ten ma siedem meczów i ekipę, ustawionych tak, żeby dało się przejść JEDNĄ
-- CIĄGŁĄ HISTORIĘ w kolejności, w jakiej przejdzie ją realna ekipa. Chodzi
-- o błędy INTEGRACYJNE — te, których nie widać w rozłącznych krokach, bo
-- pojawiają się dopiero, gdy jeden stan wynika z poprzedniego.
--
-- Siedem stanów, żebyś nie tracił dwudziestu minut na klikanie danych
-- wejściowych, zanim zaczniesz testować to, co chcesz sprawdzić.
--
-- WYMAGANIA
--   • migracje do `121` włącznie uruchomione (`120` i `121` — patrz ich
--     nagłówki, kolejność ma znaczenie),
--   • konto `franekks@gmail.com` — jesteś organizatorem wszystkiego,
--   • DRUGI CZŁOWIEK z drugim telefonem; nie potrzebuje konta na starcie,
--     bo zakłada je w trakcie (to jest część testu).
--
-- SCENARIUSZ SESJI: docs/testy-przedpremierowe.md
--
-- PO TEŚCIE: `supabase/wyczysc-testowe.sql` kasuje to razem z resztą danych
-- testowych. Nie zostawiaj tego w bazie, do której wpuszczasz ludzi.
-- ============================================================

DO $$
DECLARE
  ja    UUID := (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com');
  ja_n  TEXT;
  eid   UUID;
  gid   UUID;
  -- Godzina meczu jest czytana w strefie PRZEGLĄDARKI, a `event_time` siedzi
  -- w bazie bez strefy. Serwer Supabase chodzi na UTC, telefon w Polsce nie —
  -- bez tego przeliczenia „za 45 minut" wyszłoby na telefonie jako „za 2 godz.
  -- 45 min" i numer BLIK by się nie odsłonił (`canSeeBlikPhone`).
  teraz TIMESTAMP := (now() AT TIME ZONE 'Europe/Warsaw');
  brak  TEXT[] := '{}';   -- migracje, których brakuje w bazie (patrz sprawdzenie niżej)
BEGIN
  -- SPRAWDZENIE SCHEMATU. Migracje uruchamia się w tym repo RĘCZNIE, więc baza
  -- bywa starsza niż plik, który do niej wklejasz. Bez tego seed wywraca się
  -- dopiero w środku, na pierwszym INSERT-cie dotykającym nowej kolumny,
  -- komunikatem Postgresa „column ... does not exist" — a ten mówi, CZEGO nie
  -- ma, i nie mówi ani DLACZEGO, ani co z tym zrobić. Przyczyna jest zawsze ta
  -- sama: migracja nie została puszczona. Sprawdzamy więc po jednym znaczniku
  -- na migrację i wypisujemy WSZYSTKIE braki naraz, żeby nie odkrywać ich po
  -- jednym, przebieg po przebiegu.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'events'
                    AND column_name = 'reserve_claim_minutes') THEN
    brak := brak || CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'events'
                      AND column_name = 'reserve_claim_hours')
      THEN '118_rezerwa_czas_w_minutach.sql — w bazie siedzi jeszcze stara kolumna reserve_claim_hours (godziny)'
      ELSE '118_rezerwa_czas_w_minutach.sql — brak kolumny events.reserve_claim_minutes'
    END::text;
  ELSIF EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.events'::regclass
                   AND conname = 'events_reserve_claim_hours_check') THEN
    -- Kolumna ma nową nazwę, ale wisi na niej ograniczenie z `058` (CHECK 1..72)
    -- — czyli `118` przeszła tylko w połowie (sama zmiana nazwy, bez
    -- przeliczenia na minuty). Bez tej gałęzi seed wywala się dopiero na
    -- „violates check constraint events_reserve_claim_hours_check".
    brak := brak || '118_rezerwa_czas_w_minutach.sql — przeszła tylko w połowie: kolumna ma nową nazwę, ale zostało ograniczenie CHECK 1..72 i wartości w godzinach (puść CAŁY plik jeszcze raz, jest odporny na powtórzenie)'::text;
  END IF;
  IF to_regclass('public.event_blik') IS NULL THEN
    brak := brak || '120_rozmowa_i_blik_tylko_dla_swoich.sql — brak tabeli event_blik'::text;
  END IF;
  IF cardinality(brak) > 0 THEN
    RAISE EXCEPTION E'Baza nie ma zmian z migracji:\n  • %\n\nUruchom brakujące pliki z supabase/migrations w Supabase → SQL Editor (nic nie robi tego za Ciebie) i puść ten seed jeszcze raz.',
      array_to_string(brak, E'\n  • ');
  END IF;

  IF ja IS NULL THEN
    RAISE EXCEPTION 'Brak konta franekks@gmail.com w auth.users — zaloguj się raz w aplikacji.';
  END IF;
  -- Kasowanie poprzedniego przebiegu siedzi ZA sprawdzeniami — nieudany seed
  -- ma zostawić bazę taką, jaką zastał, zamiast wyczyścić stare dane i nie
  -- postawić nowych.
  DELETE FROM events WHERE description LIKE '[PRZED]%';
  DELETE FROM groups WHERE name = '[PRZED] Ekipa testowa';

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Organizator');

  -- P1 — mecz, do którego zaprosisz drugą osobę linkiem -----------------
  -- Wolne miejsca, nic nadzwyczajnego. To jest wejście do historii: wysyłasz
  -- link komuś, kto NIE MA KONTA, i patrzysz, ile kroków dzieli go od składu.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '1 day')::date, '19:00', '20:30', 10, 'public',
    'P1 — zaproszenie linkiem',
    '[PRZED] SPRAWDŹ: wyślij link drugiej osobie BEZ konta. Ma dojść do składu: otworzyć link, założyć konto, dołączyć. Policz kroki i miejsca, w których się zawaha.')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- P2 — komplet: druga osoba wchodzi na rezerwę ------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '2 days')::date, '19:00', '20:30', 2, 'public',
    'P2 — komplet i kolejka',
    '[PRZED] SPRAWDŹ: druga osoba zapisuje się przy komplecie — komunikat ma WPROST mówić o rezerwie. Potem Ty wypisujesz gościa ze składu i patrzysz, czy rezerwowy dostaje ofertę miejsca (i powiadomienie).')
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Marek (gość organizatora)', true);

  -- P3 — mecz wymagający akceptacji -------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '3 days')::date, '20:00', '21:30', 10, 'public',
    'P3 — prośba o akceptację',
    '[PRZED] SPRAWDŹ: druga osoba klika Dołącz — ma zobaczyć, że CZEKA na decyzję, i dowiedzieć się, jak się o niej dowie. Ty dostajesz prośbę (dzwonek + /moje-gry) i akceptujesz. Sprawdź, czy druga strona widzi zmianę bez odświeżania strony.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);

  -- P4 — płatny, zaczyna się za 45 minut --------------------------------
  -- Godzina blisko „teraz" jest tu potrzebna: numer BLIK odsłania się
  -- uczestnikowi dopiero na godzinę przed meczem (`canSeeBlikPhone`).
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods,
                      accepted_sports_cards, sports_card_discount_grosz, track_payments)
  VALUES (ja, ja_n, 'piłka nożna', 'Hala — sesja testowa',
    (teraz + interval '45 minutes')::date,
    date_trunc('minute', teraz + interval '45 minutes')::time, NULL, 10, 'public',
    'P4 — płatny, karta sportowa, BLIK',
    '[PRZED] SPRAWDŹ: druga osoba przed zapisaniem widzi ZDANIE, że numer BLIK zobaczy po dołączeniu — nie sam numer. Po zapisaniu numer jest widoczny (mecz zaczyna się za mniej niż godzinę). Sprawdź też cenę z kartą sportową i bez.',
    2500, ARRAY['blik','gotowka']::text[], ARRAY['multisport']::text[], 1000, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, ja, ja_n, 'blik');

  -- P5 — mecz z wczoraj: wynik i rozliczenie ----------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_results, track_payments, team_mode)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz - interval '1 day')::date, '19:00', '20:30', 6, 'public',
    'P5 — po meczu: wynik i kasa',
    '[PRZED] SPRAWDŹ: wpisz wynik z golami, oznacz kto zapłacił („Wszyscy oddali"), wyślij rozliczenie ekipie. Czy wiadomość do wysłania da się przeczytać bez tłumaczenia?',
    2000, ARRAY['blik','gotowka']::text[], true, true, 'reczne')
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '500 100 200');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, ja, ja_n, 'blik', true),
    (eid, NULL, 'Kuba (gość)', 'gotowka', false),
    (eid, NULL, 'Michał (gość)', 'blik', false),
    (eid, NULL, 'Adam (gość)', 'blik', true);

  -- P6 — gość bez konta do przejęcia wpisu ------------------------------
  -- Najbardziej niedoceniana ścieżka w Bojo: w stałej ekipie ci sami goście
  -- wracają co tydzień, więc ta sama strata („nie ma konta, nie dostaje
  -- powiadomień") powtarza się 50 razy w roku, nie raz.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, allow_guest_adds)
  VALUES (ja, ja_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '4 days')::date, '18:30', '20:00', 10, 'public',
    'P6 — gość bez konta',
    '[PRZED] SPRAWDŹ: wyślij gościowi zaproszenie do przejęcia wpisu (przycisk przy jego nazwisku). Druga osoba otwiera link na swoim telefonie i przejmuje wpis — ma wejść do składu jako ona, nie jako nowy zapis obok gościa.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Gość do przejęcia', true);

  -- P7 — ekipa z meczem --------------------------------------------------
  INSERT INTO groups (name, created_by, description)
  VALUES ('[PRZED] Ekipa testowa', ja, 'Ekipa do sesji przedpremierowej — kasowana razem z resztą danych testowych.')
  RETURNING id INTO gid;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, group_id)
  VALUES (ja, ja_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '5 days')::date, '20:00', '21:30', 10, 'private',
    'P7 — mecz ekipy (prywatny)',
    '[PRZED] SPRAWDŹ: zaproś drugą osobę do ekipy kodem. Ma zobaczyć ten mecz, mimo że jest PRYWATNY — bo należy do ekipy. Napisz coś na tablicy ekipy i w rozmowie meczu, sprawdź powiadomienia po drugiej stronie.', gid)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, ja, ja_n);
  INSERT INTO event_comments (event_id, user_id, user_name, body)
  VALUES (eid, ja, ja_n, 'Zbieramy się 10 minut wcześniej, brama od strony parkingu.');

  RAISE NOTICE 'Gotowe: 7 stanów startowych + ekipa. Scenariusz sesji: docs/testy-przedpremierowe.md';
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
 WHERE description LIKE '[PRZED]%'
   AND lat IS NULL
   AND field_id IS NULL;


-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  split_part(title, ' — ', 2)  AS stan,
  event_date                   AS termin,
  event_time                   AS godzina,
  max_players                  AS miejsc,
  (SELECT count(*) FROM event_participants p
    WHERE p.event_id = e.id AND NOT p.is_reserve AND NOT p.pending_approval
      AND p.rsvp <> 'maybe')   AS w_skladzie,
  '/wydarzenia/' || e.id       AS adres
FROM events e
WHERE description LIKE '[PRZED]%'
ORDER BY title;
