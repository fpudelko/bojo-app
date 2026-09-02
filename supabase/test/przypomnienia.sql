-- Testy przypomnień (`wyslij_przypomnienia()`, migracja 129) — uruchamiane
-- przez `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `rls.sql` pilnuje GRANIC DOSTĘPU; tutaj chodzi o logikę:
-- kto dostaje przypomnienie, z jaką treścią i czy powtórzone uruchomienie
-- niczego nie dubluje. Mieszanie obu w jednym pliku zamazałoby ten podział,
-- a przy pierwszym padniętym teście kazałoby zgadywać, o którą warstwę chodzi.
--
-- DLACZEGO TO W OGÓLE TESTUJEMY W BAZIE. Funkcji nie da się sprawdzić ani
-- `tsc`, ani Vitest (nie mają bazy), ani Playwrightem (chodzi przez interfejs,
-- a tu nie ma żadnego interfejsu — wywołuje ją zadanie `pg_cron`). Bez tego
-- pliku jedyną informacją, że przypomnienia działają, byłby telefon
-- organizatora — albo jego brak.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _p_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'PRZYPOMNIENIA: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

CREATE OR REPLACE FUNCTION _p_sekcja(opis TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── %', opis;
END $$;

\set ORG    '''eeeeeeee-0000-4000-8000-000000000001'''
\set GRACZ  '''eeeeeeee-0000-4000-8000-000000000002'''
\set REZ    '''eeeeeeee-0000-4000-8000-000000000003'''
\set JUTRO  '''ffffffff-0000-4000-8000-000000000001'''
\set WCZORA '''ffffffff-0000-4000-8000-000000000002'''
\set CZYSTY '''ffffffff-0000-4000-8000-000000000003'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:ORG::uuid,   'org.przypomnienia@test.local',   now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:GRACZ::uuid, 'gracz.przypomnienia@test.local', now(), '{"display_name":"Grzegorz Gracz"}'::jsonb),
  (:REZ::uuid,   'rez.przypomnienia@test.local',   now(), '{"display_name":"Rafał Rezerwowy"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Mecz JUTRO: 2 w składzie na 4 miejsca (organizator gra), 1 na rezerwie,
-- 1 gość bez konta. Braki są celowe — sprawdzamy dopisek dla organizatora.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, cost_grosz)
VALUES (:JUTRO::uuid, :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        (now() AT TIME ZONE 'Europe/Warsaw')::date + 1, '20:00', 4, 'public', 'Jutrzejsza gierka', 2000);

INSERT INTO event_participants (event_id, user_id, name, is_reserve) VALUES
  (:JUTRO::uuid, :ORG::uuid,   'Ola Organizatorka', false),
  (:JUTRO::uuid, :GRACZ::uuid, 'Grzegorz Gracz',    false),
  (:JUTRO::uuid, :REZ::uuid,   'Rafał Rezerwowy',   true);
INSERT INTO event_participants (event_id, user_id, name, is_guest)
VALUES (:JUTRO::uuid, NULL, 'Gość Bez Konta', true);

-- Mecz WCZORAJ: płatny, nikt nie oddał, wynik nieprowadzony.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title,
                    cost_grosz, track_results)
VALUES (:WCZORA::uuid, :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        (now() AT TIME ZONE 'Europe/Warsaw')::date - 1, '20:00', 4, 'public', 'Wczorajsza gierka',
        2000, false);
INSERT INTO event_participants (event_id, user_id, name, has_paid)
VALUES (:WCZORA::uuid, :GRACZ::uuid, 'Grzegorz Gracz', false);

-- Mecz WCZORAJ, w pełni domknięty: za darmo, bez wyników. Nie ma o co prosić.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title,
                    cost_grosz, track_results)
VALUES (:CZYSTY::uuid, :ORG::uuid, 'Ola Organizatorka', 'siatkówka', 'Hala Testowa',
        (now() AT TIME ZONE 'Europe/Warsaw')::date - 1, '18:00', 12, 'public', 'Rozliczona gierka',
        0, false);
INSERT INTO event_participants (event_id, user_id, name, has_paid)
VALUES (:CZYSTY::uuid, :GRACZ::uuid, 'Grzegorz Gracz', true);

SELECT _p_sekcja('Przypomnienia o meczu (migracja 129)');

SELECT wyslij_przypomnienia();

-- --- Kto dostał „jutro grasz" -----------------------------------------------
SELECT _p_oczekuj('gracz ze składu dostaje przypomnienie o jutrzejszym meczu',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND type = 'przypomnienie_o_meczu' AND user_id = :GRACZ::uuid), 1);

SELECT _p_oczekuj('organizator dostaje DOKŁADNIE JEDNO, mimo że też gra',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND type = 'przypomnienie_o_meczu' AND user_id = :ORG::uuid), 1);

-- Rezerwowy: „jutro grasz" byłoby dla niego nieprawdą.
SELECT _p_oczekuj('rezerwowy NIE dostaje przypomnienia „jutro grasz"',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND type = 'przypomnienie_o_meczu' AND user_id = :REZ::uuid), 0);

-- Gość bez konta nie ma gdzie dostać powiadomienia (brak `user_id`) — to jest
-- ta sama luka, którą dla odwołania meczu domyka strona „Twój zapis" (`128`).
SELECT _p_oczekuj('w sumie dwa przypomnienia na mecz — gość bez konta nie ma dokąd',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND type = 'przypomnienie_o_meczu'), 2);

-- --- Treść ------------------------------------------------------------------
-- 3/4, nie 2/4: gość bez konta ZAJMUJE miejsce w składzie (reguła domeny,
-- ta sama, którą liczy `czy_na_rezerwe`) — po prostu nie ma dokąd wysłać mu
-- przypomnienia. Pierwsza wersja tej asercji zakładała 2/4 i to ONA była zła.
SELECT _p_oczekuj('organizator widzi, ilu brakuje',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND user_id = :ORG::uuid
      AND type = 'przypomnienie_o_meczu'
      AND body LIKE '%brakuje 1%' AND body LIKE '%3/4%'), 1);

SELECT _p_oczekuj('gracz NIE dostaje prośby o dociąganie ludzi — to nie jego sprawa',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND user_id = :GRACZ::uuid
      AND type = 'przypomnienie_o_meczu' AND body LIKE '%brakuje%'), 0);

SELECT _p_oczekuj('treść niesie godzinę i miejsce, tytuł niesie nazwę meczu',
  (SELECT count(*) FROM notifications
    WHERE event_id = :JUTRO::uuid AND type = 'przypomnienie_o_meczu'
      AND body LIKE 'Jutro 20:00 · Orlik Testowy%'
      AND title = 'Jutrzejsza gierka'), 2);

-- --- Po meczu ---------------------------------------------------------------
-- ODMIANA, nie samo „czy zawiera". Pierwsza wersja tej asercji sprawdzała
-- `body LIKE '%nie oddało%'` i dlatego PRZEPUŚCIŁA „1 osób jeszcze nie
-- oddało" — błąd wyszedł dopiero na produkcji, w powiadomieniu, które poszło
-- ludziom na telefony (naprawione migracją `131`). Test, który akceptuje
-- każdą odmianę, nie jest testem odmiany.
SELECT _p_oczekuj('organizator dostaje prośbę o domknięcie — z poprawną odmianą przy JEDNEJ osobie',
  (SELECT count(*) FROM notifications
    WHERE event_id = :WCZORA::uuid AND type = 'po_meczu_do_domkniecia'
      AND user_id = :ORG::uuid
      AND body LIKE '%1 osoba jeszcze nie oddała%'), 1);

-- Pełna tabelka odmiany, łącznie z wyjątkiem 12-14 — to on wywraca naiwną
-- regułę „końcówka 2-4 → liczba mnoga" (`withCount()` w `lib/plural.ts`
-- powstało z tego samego powodu).
SELECT _p_oczekuj('odmiana: 1 / 2 / 5 / 12 / 22',
  (SELECT count(*) FROM (VALUES
     (1,  '1 osoba jeszcze nie oddała'),
     (2,  '2 osoby jeszcze nie oddały'),
     (4,  '4 osoby jeszcze nie oddały'),
     (5,  '5 osób jeszcze nie oddało'),
     (12, '12 osób jeszcze nie oddało'),
     (14, '14 osób jeszcze nie oddało'),
     (22, '22 osoby jeszcze nie oddały')
   ) AS t(n, oczekiwane)
    WHERE odmien_nie_oddalo(t.n) = t.oczekiwane), 7);

SELECT _p_oczekuj('mecz bez zaległości NIE generuje prośby o domknięcie',
  (SELECT count(*) FROM notifications WHERE event_id = :CZYSTY::uuid), 0);

SELECT _p_oczekuj('gracz nie dostaje prośby o rozliczenie cudzego meczu',
  (SELECT count(*) FROM notifications
    WHERE type = 'po_meczu_do_domkniecia' AND user_id = :GRACZ::uuid), 0);

-- --- Idempotencja -----------------------------------------------------------
-- Zadanie cron potrafi wystartować dwa razy (restart bazy, ręczne wywołanie
-- obok harmonogramu). Duplikat powiadomienia o meczu czyta się jak ZMIANA
-- w meczu — czyli gorzej niż brak przypomnienia.
SELECT _p_oczekuj('drugie uruchomienie nie wysyła niczego',
  (SELECT wyslij_przypomnienia())::bigint, 0);

-- Liczone WYŁĄCZNIE po meczach z tego pliku: w bazie testowej stoi jeszcze
-- `seed_regresja.sql` z własnymi terminami, a te też potrafią wpaść w „jutro"
-- albo „wczoraj". Globalna liczba byłaby wtedy testem seeda, nie funkcji.
SELECT _p_oczekuj('po dwóch uruchomieniach liczba powiadomień bez zmian',
  (SELECT count(*) FROM notifications
    WHERE type IN ('przypomnienie_o_meczu', 'po_meczu_do_domkniecia')
      AND event_id IN (:JUTRO::uuid, :WCZORA::uuid, :CZYSTY::uuid)), 3);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Przypomnienia: wszystkie asercje przeszły.'; END $$;
