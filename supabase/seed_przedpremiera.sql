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
  -- DRUGI ORGANIZATOR. Bez niego cała sesja pokazuje Bojo wyłącznie oczami
  -- osoby, która wszystko założyła — a to jest mniejszość użytkowników.
  -- Blok B (P8–P13) odwraca role: mecze zakłada Jakub, Ty jesteś w nich
  -- zwykłym graczem, rezerwowym, dłużnikiem, członkiem cudzej ekipy.
  on_   UUID := (SELECT id FROM auth.users WHERE email = 'test1@example.com');
  on_n  TEXT;
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
  IF on_ IS NULL THEN
    RAISE EXCEPTION 'Brak konta test1@example.com — uruchom najpierw supabase/seed-test-users.sql (hasło: test1234).';
  END IF;
  -- Kasowanie poprzedniego przebiegu siedzi ZA sprawdzeniami — nieudany seed
  -- ma zostawić bazę taką, jaką zastał, zamiast wyczyścić stare dane i nie
  -- postawić nowych.
  DELETE FROM events WHERE description LIKE '[PRZED]%';
  DELETE FROM groups WHERE name = '[PRZED] Ekipa testowa';

  ja_n := COALESCE((SELECT display_name FROM profiles WHERE id = ja), 'Organizator');
  on_n := COALESCE((SELECT display_name FROM profiles WHERE id = on_), 'Jakub Kowalski');

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


  -- ══════════════════════════════════════════════════════════════════
  -- BLOK B — TY JAKO ZWYKŁY CZŁOWIEK (organizuje Jakub, nie Ty)
  -- ══════════════════════════════════════════════════════════════════
  -- P1–P7 pokazują Bojo z fotela organizatora. To jest fotel, w którym
  -- siedzi JEDNA osoba z ekipy — pozostałych dziesięć widzi aplikację
  -- zupełnie inaczej: bez kontrolek, bez ustawień, za to z pytaniami
  -- „czy ja tu w ogóle jestem zapisany" i „ile mam zapłacić".
  -- Tych ekranów nie da się zobaczyć, będąc właścicielem wszystkiego.
  --
  -- Klikasz to SWOIM kontem. Druga osoba nie jest tu potrzebna.

  -- P8 — jestem w składzie cudzego meczu, płatnego ---------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods,
                      accepted_sports_cards, sports_card_discount_grosz, track_payments)
  VALUES (on_, on_n, 'piłka nożna', 'Hala — sesja testowa',
    (teraz + interval '45 minutes')::date,
    date_trunc('minute', teraz + interval '45 minutes')::time, NULL, 10, 'public',
    'P8 — cudzy mecz, jestem w składzie',
    '[PRZED] SPRAWDŹ (Twoim kontem): karta „Twoja płatność" z kwotą i numerem BLIK, brak JAKICHKOLWIEK kontrolek organizatora (ustawienia, wynik, usuwanie ludzi ze składu), działające „Wypisz się z meczu". To jest widok, który ma dziewięć osób na dziesięć.',
    2500, ARRAY['blik','gotowka']::text[], ARRAY['multisport']::text[], 1000, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '600 300 400');
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, on_, on_n);
  INSERT INTO event_participants (event_id, user_id, name, payment_method)
  VALUES (eid, ja, ja_n, 'blik');

  -- P9 — jestem na rezerwie i DOSTAŁEM ofertę zwolnionego miejsca ------
  -- Stanu „masz 45 minut na przyjęcie miejsca" nie da się zobaczyć bez
  -- drugiej osoby, która wypisze się w odpowiednim momencie — a to jest
  -- dokładnie ten ekran, na którym gracz podejmuje decyzję z zegarem.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, reserve_claim_minutes)
  VALUES (on_, on_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '2 days')::date, '19:00', '20:30', 2, 'public',
    'P9 — mam ofertę miejsca z rezerwy',
    '[PRZED] SPRAWDŹ (Twoim kontem): widać, że zwolniło się miejsce i ILE CZASU zostało na decyzję. Przyjmij je i sprawdź, czy wchodzisz do składu. Zegar tyka od 15 minut, masz 60 — czyli ok. 45 minut.', 60)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, on_, on_n);
  INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_offered_at)
  VALUES (eid, ja, ja_n, true, now() - interval '15 minutes');

  -- P10 — czekam na cudzą decyzję --------------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, require_approval)
  VALUES (on_, on_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '3 days')::date, '18:00', '19:30', 10, 'public',
    'P10 — czekam na akceptację',
    '[PRZED] SPRAWDŹ (Twoim kontem): czy WIDAĆ, że prośba wisi, i czy wiadomo, jak się dowiesz o decyzji. P3 sprawdza to samo od strony organizatora — tu chodzi o stronę czekającego, czyli o niepewność.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, on_, on_n);
  INSERT INTO event_participants (event_id, user_id, name, pending_approval)
  VALUES (eid, ja, ja_n, true);

  -- P11 — mecz zagrany, ZALEGAM z kasą ---------------------------------
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description,
                      cost_grosz, accepted_payment_methods, track_payments, track_results)
  VALUES (on_, on_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz - interval '2 days')::date, '20:00', '21:30', 6, 'public',
    'P11 — zalegam za zagrany mecz',
    '[PRZED] SPRAWDŹ (Twoim kontem): co widzi DŁUŻNIK. Czy wiadomo, ile i komu; czy jest numer do przelewu; czy da się oznaczyć, że zapłaciłeś. P5 pokazuje tę samą sytuację oczami organizatora — te dwa ekrany muszą się zgadzać.',
    2000, ARRAY['blik','gotowka']::text[], true, true)
  RETURNING id INTO eid;
  INSERT INTO event_blik (event_id, blik_phone) VALUES (eid, '600 300 400');
  INSERT INTO event_participants (event_id, user_id, name, payment_method, has_paid) VALUES
    (eid, on_, on_n, 'blik', true),
    (eid, ja,  ja_n, 'blik', false);

  -- P12 — ekipa, w której jestem TYLKO członkiem ------------------------
  INSERT INTO groups (name, created_by, description)
  VALUES ('[PRZED] Ekipa Jakuba', on_, 'Ekipa, której NIE jesteś założycielem — sprawdzasz, czego nie możesz.')
  RETURNING id INTO gid;
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (gid, ja, 'member') ON CONFLICT DO NOTHING;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, group_id)
  VALUES (on_, on_n, 'piłka nożna', 'Boisko — sesja testowa',
    (teraz + interval '6 days')::date, '19:30', '21:00', 10, 'private',
    'P12 — mecz cudzej ekipy',
    '[PRZED] SPRAWDŹ (Twoim kontem): mecz PRYWATNY, widzisz go tylko dlatego, że jesteś w ekipie. Wejdź w ekipę i sprawdź, czego NIE MOŻESZ: edycji ekipy, kodu zaproszenia, usuwania ludzi. Jeśli któraś z tych rzeczy jest klikalna, to jest błąd uprawnień, nie kosmetyka.', gid)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, on_, on_n), (eid, ja, ja_n);
  INSERT INTO group_posts (group_id, user_id, user_name, body)
  VALUES (gid, on_, on_n, 'Cześć wszystkim — w piątek gramy o 19:30.');

  -- P13 — jestem DELEGATEM od składu na cudzym meczu --------------------
  -- Delegaci (migracje 089/090) to funkcja, której chyba nikt nigdy nie
  -- kliknął ręcznie: uprawnienia są cząstkowe, więc łatwo o ekran, który
  -- albo pokazuje za dużo, albo za mało.
  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      end_time, max_players, visibility, title, description, allow_guest_adds)
  VALUES (on_, on_n, 'piłka nożna', 'Orlik — sesja testowa',
    (teraz + interval '7 days')::date, '20:00', '21:30', 10, 'public',
    'P13 — jestem delegatem od składu',
    '[PRZED] SPRAWDŹ (Twoim kontem): masz zarządzać SKŁADEM i niczym więcej. Dopisanie gościa i usunięcie kogoś ze składu MA działać; zmiana terminu, ceny, ustawień i odwołanie meczu NIE. Nadmiar uprawnień jest tu groźniejszy niż ich brak.', true)
  RETURNING id INTO eid;
  INSERT INTO event_participants (event_id, user_id, name) VALUES (eid, on_, on_n), (eid, ja, ja_n);
  INSERT INTO event_participants (event_id, user_id, name, is_guest)
  VALUES (eid, NULL, 'Bartek (gość Jakuba)', true);
  INSERT INTO event_delegates (event_id, user_id, can_manage_squad, granted_by)
  VALUES (eid, ja, true, on_) ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Gotowe: 13 stanów + dwie ekipy. P1-P7 z fotela organizatora, P8-P13 z fotela zwykłego gracza. Scenariusz: docs/testy-przedpremierowe.md';
END $$;

-- ============================================================
-- LISTA KONTROLNA — wynik zapytania to Twoja checklista
-- ============================================================
SELECT
  split_part(title, ' — ', 1)  AS nr,
  -- Najważniejsza kolumna w tej tabeli: czyj to mecz. P1–P7 są Twoje,
  -- P8–P13 cudze — i o to w blokach chodzi.
  CASE WHEN e.organizer_id = (SELECT id FROM auth.users WHERE email = 'franekks@gmail.com')
       THEN 'TY' ELSE 'Jakub' END AS organizator,
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
-- Po LICZBIE, nie po tekście: sortowanie tekstowe wstawia P10 między P1 a P2.
ORDER BY substring(split_part(title, ' — ', 1) FROM 2)::int;
