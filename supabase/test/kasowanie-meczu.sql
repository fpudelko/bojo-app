-- Testy kasowania meczu (migracja `148`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. Kasowanie danych jest w tym repo strefą podwyższonego
-- ryzyka, a akurat tej ścieżki nie widzi żadne inne narzędzie: `tsc` i Vitest
-- nie mają bazy, Playwright klika interfejs i zobaczyłby najwyżej „nie udało
-- się", a `rls.sql` sprawdza, kto co widzi, nie co się dzieje przy DELETE.
--
-- Pilnowany błąd był cichy dokładnie tam, gdzie boli: wyzwalacz
-- powiadomieniowy na `BEFORE DELETE ON event_participants` wstawiał wiersz
-- wskazujący na mecz, który właśnie znikał, i klucz obcy wywracał CAŁE
-- kasowanie. Organizator widział mecz, którego nie da się usunąć — a warunek
-- (ktoś czeka na akceptację zapisu) jest na tyle zwyczajny, że trafia się
-- każdemu, kto włączył „Wymagaj akceptacji".

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _k_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'KASOWANIE MECZU: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

\o
\echo ''
\echo '── Mecz z nierozpatrzoną prośbą o dołączenie'
\o /dev/null

DO $$
DECLARE
  org   UUID; gracz UUID; eid UUID; ile BIGINT;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (extensions.gen_random_uuid(), 'kasowanie-org@test.pl', now()) RETURNING id INTO org;
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (extensions.gen_random_uuid(), 'kasowanie-gracz@test.pl', now()) RETURNING id INTO gracz;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, require_approval)
  VALUES (org, 'Organizator', 'piłka nożna', 'Boisko testowe', current_date + 3, '19:00',
          10, 'public', '[TEST-KAS] Mecz z prośbą', true)
  RETURNING id INTO eid;

  INSERT INTO event_participants (event_id, user_id, name, pending_approval)
  VALUES (eid, gracz, 'Gracz czekający', true);

  -- To samo, co robi `deleteEvent()` z `lib/events.ts`.
  DELETE FROM events WHERE id = eid;

  SELECT count(*) INTO ile FROM events WHERE id = eid;
  PERFORM _k_oczekuj('mecz z czekającą prośbą daje się usunąć', ile, 0);

  SELECT count(*) INTO ile FROM event_participants WHERE event_id = eid;
  PERFORM _k_oczekuj('uczestnicy znikają razem z meczem (kaskada)', ile, 0);

  SELECT count(*) INTO ile FROM notifications WHERE event_id = eid;
  PERFORM _k_oczekuj('po skasowanym meczu nie zostaje powiadomienie', ile, 0);
END $$;

\o
\echo ''
\echo '── Odrzucenie POJEDYNCZEJ prośby dalej powiadamia'
\o /dev/null

-- Druga strona tej samej zmiany. Poprawka wychodzi z wyzwalacza, gdy nie ma
-- wiersza meczu — gdyby wyszła zawsze, kasowanie działałoby, a powiadomienie
-- „prośba odrzucona" przestałoby istnieć i nikt by tego nie zauważył.
DO $$
DECLARE
  org UUID; gracz UUID; eid UUID; ile BIGINT;
BEGIN
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (extensions.gen_random_uuid(), 'kasowanie-org2@test.pl', now()) RETURNING id INTO org;
  INSERT INTO auth.users (id, email, email_confirmed_at)
  VALUES (extensions.gen_random_uuid(), 'kasowanie-gracz2@test.pl', now()) RETURNING id INTO gracz;

  INSERT INTO events (organizer_id, organizer_name, sport, field_name, event_date, event_time,
                      max_players, visibility, title, require_approval)
  VALUES (org, 'Organizator', 'piłka nożna', 'Boisko testowe', current_date + 3, '20:00',
          10, 'public', '[TEST-KAS] Mecz, z którego odrzucamy', true)
  RETURNING id INTO eid;

  INSERT INTO event_participants (event_id, user_id, name, pending_approval)
  VALUES (eid, gracz, 'Gracz odrzucony', true);

  -- Organizator odrzuca prośbę: znika JEDEN wpis, mecz zostaje.
  DELETE FROM event_participants WHERE event_id = eid AND user_id = gracz;

  SELECT count(*) INTO ile
    FROM notifications WHERE event_id = eid AND user_id = gracz AND type = 'prosba_odrzucona';
  PERFORM _k_oczekuj('odrzucony dostaje powiadomienie', ile, 1);

  DELETE FROM events WHERE id = eid;
END $$;

DROP FUNCTION _k_oczekuj(TEXT, BIGINT, BIGINT);

\o
\echo ''
\echo '✓ Kasowanie meczu: wszystkie asercje przeszły.'
