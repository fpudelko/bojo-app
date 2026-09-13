-- Testy zegara kolejki rezerwowej (migracja `143`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `sync_reserve_claim()` samą w sobie sprawdza już
-- `rls.sql` i pośrednio scenariusze aplikacji — ale wszystkie te ścieżki
-- WOŁAJĄ ją same, symulując czyjeś kliknięcie. Tu sprawdzamy dokładnie
-- odwrotny przypadek: co się dzieje, gdy NIKT nie kliknie i oferta wygaśnie
-- po cichu — czyli sam powód, dla którego `porzadkuj_kolejki_rezerwy()`
-- w ogóle powstało (audyt 2026-09-12, ustalenie `S-1`).

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _k_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'KOLEJKA REZERWY: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

CREATE OR REPLACE FUNCTION _k_sekcja(opis TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── %', opis;
END $$;

\set K_ORG   '''deadbeef-0000-4000-8000-000000000001'''
\set K_G2    '''deadbeef-0000-4000-8000-000000000002'''
\set K_REZ_A '''deadbeef-0000-4000-8000-000000000003'''
\set K_REZ_B '''deadbeef-0000-4000-8000-000000000004'''
\set K_MECZ    '''feedface-0000-4000-8000-000000000001'''
\set K_ROZEGRANY '''feedface-0000-4000-8000-000000000002'''
\set K_ODWOLANY  '''feedface-0000-4000-8000-000000000003'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:K_ORG::uuid,   'org.kolejka@test.local',   now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:K_G2::uuid,    'gracz2.kolejka@test.local', now(), '{"display_name":"Grzegorz Drugi"}'::jsonb),
  (:K_REZ_A::uuid, 'reza.kolejka@test.local',  now(), '{"display_name":"Rafał Rezerwowy"}'::jsonb),
  (:K_REZ_B::uuid, 'rezb.kolejka@test.local',  now(), '{"display_name":"Renata Rezerwowa"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Mecz za tydzień, 2 miejsca, okno oferty 180 min (domyślne).
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, reserve_enabled,
                    reserve_claim_minutes, visibility, title)
VALUES (:K_MECZ::uuid, :K_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        dzis_pl() + 7, '20:00', 2, true, 180, 'public', 'Gierka z kolejką');

INSERT INTO event_participants (event_id, user_id, name, is_reserve, zapisano_at) VALUES
  (:K_MECZ::uuid, :K_ORG::uuid,   'Ola Organizatorka', false, now() - interval '5 days'),
  (:K_MECZ::uuid, :K_G2::uuid,    'Grzegorz Drugi',    false, now() - interval '4 days'),
  (:K_MECZ::uuid, :K_REZ_A::uuid, 'Rafał Rezerwowy',   true,  now() - interval '3 days'),
  (:K_MECZ::uuid, :K_REZ_B::uuid, 'Renata Rezerwowa',  true,  now() - interval '2 days');

-- Mecz JUŻ ROZEGRANY (wczoraj), z kimś na rezerwie i wygasłą-by-była ofertą —
-- sweep MA GO POMIJAĆ: `sync_reserve_claim()` i tak wychodzi natychmiast dla
-- rozpoczętych meczów, ale zbiór, który przegląda `porzadkuj_kolejki_rezerwy()`,
-- ma nie marnować czasu na mecze, które się już odbyły.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, reserve_enabled,
                    reserve_claim_minutes, visibility, title)
VALUES (:K_ROZEGRANY::uuid, :K_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        dzis_pl() - 1, '20:00', 1, true, 180, 'public', 'Gierka wczorajsza');
INSERT INTO event_participants (event_id, user_id, name, is_reserve, zapisano_at)
VALUES (:K_ROZEGRANY::uuid, :K_REZ_A::uuid, 'Rafał Rezerwowy', true, now() - interval '1 day');

-- Mecz ODWOŁANY, w przyszłości, z kimś na rezerwie — też POMIJANY.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, reserve_enabled,
                    reserve_claim_minutes, visibility, title, status)
VALUES (:K_ODWOLANY::uuid, :K_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        dzis_pl() + 3, '20:00', 1, true, 180, 'public', 'Gierka odwołana', 'cancelled');
INSERT INTO event_participants (event_id, user_id, name, is_reserve, zapisano_at)
VALUES (:K_ODWOLANY::uuid, :K_REZ_B::uuid, 'Renata Rezerwowa', true, now() - interval '1 day');

SELECT _k_sekcja('Stan wyjściowy — Gracz 2 wypisuje się, oferta idzie do Rafała');

-- Wypisanie się przez usunięcie wiersza + wywołanie sync_reserve_claim —
-- dokładnie to, co robi `removeParticipant()` w `lib/events.ts`.
DELETE FROM event_participants WHERE event_id = :K_MECZ::uuid AND user_id = :K_G2::uuid;
SELECT sync_reserve_claim(:K_MECZ::uuid);

SELECT _k_oczekuj('Rafał dostał ofertę',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid
      AND claim_offered_at IS NOT NULL), 1);

SELECT _k_oczekuj('Renata jeszcze nie ma oferty',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_B::uuid
      AND claim_offered_at IS NOT NULL), 0);

SELECT _k_sekcja('Rafał zwleka — mija okno oferty, NIKT nie wchodzi na stronę meczu');

UPDATE event_participants SET claim_offered_at = now() - interval '4 hours'
 WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid;

-- BEZ wywołania sweepu: dokładnie stan, który S-1 znalazł na produkcji —
-- wygasła oferta stoi, Renata nie dostała niczego, skład 1 z 2.
SELECT _k_oczekuj('bez sweepu: wygasła oferta DALEJ wisi u Rafała',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid
      AND claim_offered_at IS NOT NULL AND oferta_wygasla_at IS NULL), 1);

SELECT _k_oczekuj('bez sweepu: Renata dalej bez oferty',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_B::uuid
      AND claim_offered_at IS NOT NULL), 0);

SELECT _k_sekcja('porzadkuj_kolejki_rezerwy() — to samo, co robi teraz zadanie cron');

SELECT _k_oczekuj('sweep przegląda przynajmniej ten jeden aktywny, przyszły mecz z rezerwą',
  (SELECT CASE WHEN porzadkuj_kolejki_rezerwy() >= 1 THEN 1 ELSE 0 END), 1);

SELECT _k_oczekuj('oferta Rafała wygasła (nie: świadome „odpuszczam" — inne pole)',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid
      AND claim_offered_at IS NULL AND oferta_wygasla_at IS NOT NULL
      AND claim_passed = false), 1);

SELECT _k_oczekuj('Rafał zostaje w kolejce (nie wypadł) — dalej is_reserve',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid AND is_reserve), 1);

SELECT _k_oczekuj('Renata dostała ofertę BEZ niczyjego kliknięcia',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_B::uuid
      AND claim_offered_at IS NOT NULL), 1);

SELECT _k_oczekuj('Rafał dostał powiadomienie „oferta_wygasla" — cisza była błędem',
  (SELECT count(*) FROM notifications
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_A::uuid
      AND type = 'oferta_wygasla'), 1);

SELECT _k_oczekuj('Renata dostała powiadomienie o nowej ofercie',
  (SELECT count(*) FROM notifications
    WHERE event_id = :K_MECZ::uuid AND user_id = :K_REZ_B::uuid
      AND type = 'reserve_claim_offered'), 1);

SELECT _k_sekcja('Mecze rozegrany i odwołany — sweep ich nie rusza');

SELECT _k_oczekuj('mecz JUŻ ROZEGRANY: rezerwowy bez żadnej zmiany',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_ROZEGRANY::uuid AND user_id = :K_REZ_A::uuid
      AND claim_offered_at IS NULL AND oferta_wygasla_at IS NULL), 1);

SELECT _k_oczekuj('mecz ODWOŁANY: rezerwowy bez żadnej zmiany',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :K_ODWOLANY::uuid AND user_id = :K_REZ_B::uuid
      AND claim_offered_at IS NULL AND oferta_wygasla_at IS NULL), 1);

SELECT _k_sekcja('Idempotencja — drugie uruchomienie zaraz po pierwszym');

SELECT count(*) AS przed FROM notifications WHERE event_id = :K_MECZ::uuid \gset
SELECT porzadkuj_kolejki_rezerwy();
SELECT count(*) AS po FROM notifications WHERE event_id = :K_MECZ::uuid \gset

SELECT _k_oczekuj('drugi przebieg nie wysyła żadnego NOWEGO powiadomienia',
  :po, :przed);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Kolejka rezerwy — zegar: wszystkie asercje przeszły.'; END $$;
