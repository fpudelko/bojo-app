-- Testy powiadomień o zmianie stanu meczu (migracja `139`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `rls.sql` pilnuje granic dostępu, `przypomnienia.sql`
-- logiki zadania cron, `poczta-goscia.sql` kanału pocztowego. Tutaj chodzi
-- o coś czwartego: KIEDY wyzwalacz ma się odezwać, a kiedy ma milczeć.
-- To jest ta warstwa, w której `065` przez czternaście migracji różniło się
-- od `114` i nikt tego nie widział — bo różnica nie jest błędem składni ani
-- błędem dostępu, tylko brakiem dwóch linijek warunku.
--
-- CZEGO TO NIE DA SIĘ SPRAWDZIĆ INACZEJ. `tsc` i Vitest nie mają bazy,
-- Playwright chodzi przez interfejs — a interfejs nigdy nie wyśle UPDATE-u
-- zmieniającego datę meczu odwołanego, bo formularz edycji jest poprawny.
-- Wyzwalacz odpala się jednak niezależnie od tego, którędy przyszła zmiana:
-- z aplikacji, z panelu Supabase czy ze skryptu.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _z_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'ZMIANY: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

CREATE OR REPLACE FUNCTION _z_sekcja(opis TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── %', opis;
END $$;

\set ORG     '''dddddddd-0000-4000-8000-000000000001'''
\set GRACZ1  '''dddddddd-0000-4000-8000-000000000002'''
\set GRACZ2  '''dddddddd-0000-4000-8000-000000000003'''
\set POZNIEJ '''dddddddd-0000-4000-8000-000000000004'''

\set ODWOLANY '''cccccccc-0000-4000-8000-000000000001'''
\set MINIONY  '''cccccccc-0000-4000-8000-000000000002'''
\set PRZYSZLY '''cccccccc-0000-4000-8000-000000000003'''
\set WRACA    '''cccccccc-0000-4000-8000-000000000004'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:ORG::uuid,     'org.zmiany@test.local',     now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:GRACZ1::uuid,  'gracz1.zmiany@test.local',  now(), '{"display_name":"Grzegorz Pierwszy"}'::jsonb),
  (:GRACZ2::uuid,  'gracz2.zmiany@test.local',  now(), '{"display_name":"Grażyna Druga"}'::jsonb),
  (:POZNIEJ::uuid, 'pozniej.zmiany@test.local', now(), '{"display_name":"Późny Piotr"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Cztery mecze o tym samym kształcie składu (organizator + dwoje graczy),
-- różniące się WYŁĄCZNIE tym, co sprawdzają.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, status)
VALUES
  (:ODWOLANY::uuid, :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 5, '20:00', 10, 'public', 'Mecz odwołany', 'cancelled'),
  (:MINIONY::uuid,  :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() - 5, '20:00', 10, 'public', 'Mecz miniony', 'active'),
  (:PRZYSZLY::uuid, :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 5, '20:00', 10, 'public', 'Mecz przyszły', 'active'),
  (:WRACA::uuid,    :ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 5, '20:00', 10, 'public', 'Mecz do przywrócenia', 'active');

INSERT INTO event_participants (event_id, user_id, name) VALUES
  (:ODWOLANY::uuid, :ORG::uuid,    'Ola Organizatorka'),
  (:ODWOLANY::uuid, :GRACZ1::uuid, 'Grzegorz Pierwszy'),
  (:ODWOLANY::uuid, :GRACZ2::uuid, 'Grażyna Druga'),
  (:MINIONY::uuid,  :ORG::uuid,    'Ola Organizatorka'),
  (:MINIONY::uuid,  :GRACZ1::uuid, 'Grzegorz Pierwszy'),
  (:MINIONY::uuid,  :GRACZ2::uuid, 'Grażyna Druga'),
  (:PRZYSZLY::uuid, :ORG::uuid,    'Ola Organizatorka'),
  (:PRZYSZLY::uuid, :GRACZ1::uuid, 'Grzegorz Pierwszy'),
  (:PRZYSZLY::uuid, :GRACZ2::uuid, 'Grażyna Druga'),
  (:WRACA::uuid,    :ORG::uuid,    'Ola Organizatorka'),
  (:WRACA::uuid,    :GRACZ1::uuid, 'Grzegorz Pierwszy'),
  (:WRACA::uuid,    :GRACZ2::uuid, 'Grażyna Druga');

-- ---------------------------------------------------------------------------
SELECT _z_sekcja('Zmiana terminu — strażniki dołożone w 139');
-- ---------------------------------------------------------------------------

-- Mecz ODWOŁANY. Do `139` ten UPDATE wysyłał całemu składowi „Nowy termin: …",
-- czyli komunikat, który czyta się jak „mecz wraca".
UPDATE events SET event_time = '21:00' WHERE id = :ODWOLANY::uuid;

SELECT _z_oczekuj('zmiana godziny w meczu ODWOŁANYM nie powiadamia nikogo',
  (SELECT count(*) FROM notifications
    WHERE type = 'zmiana_terminu' AND event_id = :ODWOLANY::uuid), 0);

-- Mecz z PRZESZŁOŚCI — poprawiana data to porządki, nie zaproszenie.
UPDATE events SET event_date = dzis_pl() - 4 WHERE id = :MINIONY::uuid;

SELECT _z_oczekuj('zmiana daty w meczu MINIONYM nie powiadamia nikogo',
  (SELECT count(*) FROM notifications
    WHERE type = 'zmiana_terminu' AND event_id = :MINIONY::uuid), 0);

-- Kontrola, że `139` niczego nie zabrało: mecz aktywny i przyszły powiadamia
-- tak samo jak przed migracją — skład z kontem, bez organizatora.
UPDATE events SET event_time = '21:30' WHERE id = :PRZYSZLY::uuid;

SELECT _z_oczekuj('zmiana godziny w meczu przyszłym powiadamia skład bez organizatora',
  (SELECT count(*) FROM notifications
    WHERE type = 'zmiana_terminu' AND event_id = :PRZYSZLY::uuid), 2);

SELECT _z_oczekuj('organizator nie dostaje powiadomienia o własnej zmianie',
  (SELECT count(*) FROM notifications
    WHERE type = 'zmiana_terminu' AND event_id = :PRZYSZLY::uuid
      AND user_id = :ORG::uuid), 0);

-- ---------------------------------------------------------------------------
SELECT _z_sekcja('Przywrócenie odwołanego meczu');
-- ---------------------------------------------------------------------------

-- Odwołanie: `070` pisze `mecz_odwolany` do obojga graczy.
UPDATE events SET status = 'cancelled' WHERE id = :WRACA::uuid;

SELECT _z_oczekuj('odwołanie powiadamia dwoje graczy',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_odwolany' AND event_id = :WRACA::uuid), 2);

-- Ktoś dołącza JUŻ PO odwołaniu — mecz odwołany wciąż da się otworzyć
-- z linku. Nie widział złej wiadomości, więc nie ma go po co prostować.
INSERT INTO event_participants (event_id, user_id, name)
VALUES (:WRACA::uuid, :POZNIEJ::uuid, 'Późny Piotr');

-- Przywrócenie.
UPDATE events SET status = 'active' WHERE id = :WRACA::uuid;

SELECT _z_oczekuj('przywrócenie powiadamia dokładnie tych, którzy dostali odwołanie',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid), 2);

SELECT _z_oczekuj('kto dołączył po odwołaniu, nie dostaje prostowania',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid
      AND user_id = :POZNIEJ::uuid), 0);

SELECT _z_oczekuj('organizator nie dostaje powiadomienia o własnym przywróceniu',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid
      AND user_id = :ORG::uuid), 0);

-- Druga runda odwołaj/przywróć tego samego dnia. To jest dokładnie ta obawa,
-- dla której `070` w ogóle milczało przy przywróceniu — tu rozwiązana
-- dedupem na dobę, a nie ciszą.
--
-- UWAGA NA TO, CO SIĘ TU LICZY. Drugie odwołanie pisze `mecz_odwolany` także
-- Piotrowi, który dołączył po pierwszym — więc przy drugim przywróceniu
-- Piotr dostaje swoje PIERWSZE sprostowanie i to jest poprawne: usłyszał złą
-- wiadomość, ma usłyszeć jej odwołanie. Dedup dotyczy OSOBY, nie meczu, i to
-- właśnie sprawdzamy: nikt nie dostaje dwóch sprostowań w jedną dobę.
UPDATE events SET status = 'cancelled' WHERE id = :WRACA::uuid;
UPDATE events SET status = 'active'    WHERE id = :WRACA::uuid;

SELECT _z_oczekuj('kto już dostał sprostowanie, nie dostaje drugiego tego samego dnia',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid
      AND user_id = :GRACZ1::uuid), 1);

SELECT _z_oczekuj('Piotr, odwołany dopiero w drugiej rundzie, dostaje swoje pierwsze',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid
      AND user_id = :POZNIEJ::uuid), 1);

SELECT _z_oczekuj('po dwóch rundach sprostowań jest tyle, ilu odwołanych ludzi',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :WRACA::uuid), 3);

-- Mecz z przeszłości przywraca się do porządków (wynik, rozliczenie),
-- nie po to, żeby ktoś na niego przyjechał.
UPDATE events SET status = 'cancelled' WHERE id = :MINIONY::uuid;
UPDATE events SET status = 'active'    WHERE id = :MINIONY::uuid;

SELECT _z_oczekuj('przywrócenie meczu MINIONEGO nie powiadamia nikogo',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_przywrocony' AND event_id = :MINIONY::uuid), 0);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Powiadomienia o zmianie: wszystkie asercje przeszły.'; END $$;
