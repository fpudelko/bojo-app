-- Testy zamykania zapisów (migracja `141`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `rls.sql` sprawdza, KTO CO WIDZI. Tutaj chodzi o coś
-- innego: kto może WEJŚĆ. Granicą nie jest polityka RLS, tylko dwie funkcje
-- `SECURITY DEFINER` (`dolacz_do_meczu`, `dolacz_do_meczu_jako_goscie`) —
-- jedyne wejście do `event_participants` dla zapisującego się. Ich warunki nie
-- są widoczne dla żadnego innego narzędzia w repo: Vitest nie ma bazy,
-- a Playwright chodzi przez interfejs, czyli po właściwej stronie bramki.
--
-- NAJWAŻNIEJSZA ASERCJA W TYM PLIKU jest tą najmniej oczywistą: gość, który
-- zapisał się PRZED zamknięciem i wraca po swój `claim_token`, musi go dalej
-- dostać. Strażnik postawiony o trzy linijki wyżej zamieniłby „zamknięcie
-- zapisów" w „odebranie ludziom dostępu do własnego wpisu" — i nikt by tego
-- nie zauważył, bo ścieżka odzyskiwania tokenu nie ma w interfejsie własnego
-- ekranu błędu.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _z_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'ZAPISY ZAMKNIĘTE: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

-- Wywołuje kod i sprawdza, że padł Z TĄ treścią. Sam fakt wyjątku nie
-- wystarcza: „Nie ma takiego meczu" i „Zapisy są zamknięte" to dwa różne
-- błędy, a test, który przyjmuje oba, przechodzi także wtedy, gdy strażnik
-- w ogóle nie zadziałał.
-- UWAGA NA KSZTAŁT TEJ FUNKCJI — pierwsza wersja była testem, który NIE MÓGŁ
-- PAŚĆ, i wyszło to dopiero przy sprawdzaniu od drugiej strony (zdjęty
-- strażnik, przebieg od zera — cała suita dalej zielona).
--
-- Wyglądała tak: `EXECUTE sql; RAISE EXCEPTION '… a zapis PRZESZEDŁ';`
-- wewnątrz bloku z `EXCEPTION WHEN OTHERS`. Dwie rzeczy naraz:
--
--   1. własny wyjątek „a zapis PRZESZEDŁ" NIÓSŁ W TREŚCI szukany fragment,
--      więc łapał się we własną gałąź `WHEN OTHERS` i przechodził jako sukces;
--   2. ten sam wyjątek wycofywał podtransakcję, więc wstawiony wiersz znikał
--      i asercja „żaden nowy wiersz nie powstał" też nie miała czego zobaczyć.
--
-- Dlatego wynik wychodzi z bloku FLAGĄ, a obie decyzje zapadają POZA nim.
CREATE OR REPLACE FUNCTION _z_oczekuj_blad(opis TEXT, sql TEXT, fragment TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_tresc text; v_przeszlo boolean := false;
BEGIN
  BEGIN
    EXECUTE sql;
    v_przeszlo := true;
  EXCEPTION WHEN OTHERS THEN
    v_tresc := SQLERRM;
  END;

  IF v_przeszlo THEN
    RAISE EXCEPTION 'ZAPISY ZAMKNIĘTE: % — oczekiwano odmowy, a zapis PRZESZEDŁ', opis;
  END IF;
  IF position(fragment IN v_tresc) = 0 THEN
    RAISE EXCEPTION 'ZAPISY ZAMKNIĘTE: % — oczekiwano błędu „%", dostano „%"', opis, fragment, v_tresc;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

/* Podstawia tożsamość dokładnie tak, jak robi to PostgREST — `auth.uid()`
   czyta `request.jwt.claim.sub`. Bez tego `dolacz_do_meczu` widzi NULL
   i pada na „Musisz być zalogowany", czyli test przechodziłby z innego
   powodu niż sprawdzany. */
CREATE OR REPLACE FUNCTION _z_jako(p_user UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_user::text, false);
END $$;

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Zapisy zamknięte (migracja 141)'; END $$;

-- Własna przestrzeń UUID-ów. `…00d1`+ — `poczta-goscia.sql` zajmuje `a1`
-- i `b1..b3`, `poczta-do-kont.sql` `c1..c3`. Bez `ON CONFLICT`: kolizja ma
-- paść jako `duplicate key`, natychmiast i pod właściwym adresem.
\set Z_ORG    '''eeeeeeee-0000-4000-8000-0000000000d1'''
\set Z_GRACZ  '''eeeeeeee-0000-4000-8000-0000000000d2'''
\set Z_NOWY   '''eeeeeeee-0000-4000-8000-0000000000d3'''
\set Z_MECZ   '''ffffffff-0000-4000-8000-0000000000d1'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:Z_ORG::uuid,   'zamk-org-d1@example.com',   now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:Z_GRACZ::uuid, 'zamk-gracz-d2@example.com', now(), '{"display_name":"Grzegorz Gracz"}'::jsonb),
  (:Z_NOWY::uuid,  'zamk-nowy-d3@example.com',  now(), '{"display_name":"Nowy Norbert"}'::jsonb);

-- 14 miejsc, więc pojemność NIGDY nie jest powodem odmowy — inaczej test
-- „nie wejdzie po zamknięciu" przechodziłby też przy kompletnym składzie.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title)
VALUES
  (:Z_MECZ::uuid, :Z_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 3, '20:00', 14, 'public', 'Mecz do zamknięcia');

INSERT INTO event_participants (event_id, user_id, name) VALUES
  (:Z_MECZ::uuid, :Z_ORG::uuid,   'Ola Organizatorka'),
  (:Z_MECZ::uuid, :Z_GRACZ::uuid, 'Grzegorz Gracz');

-- Gość, który zapisał się PRZED zamknięciem — bohater najważniejszej asercji.
INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email)
VALUES (:Z_MECZ::uuid, NULL, 'Gość Wcześniejszy', true, 'zamk-gosc-wczesniej@example.com');

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Przy OTWARTYCH zapisach nic się nie zmienia'; END $$;
-- ---------------------------------------------------------------------------
-- Asercja odniesienia. Bez niej cały plik dowodziłby wyłącznie tego, że zapis
-- nie działa — nie odróżniając „zamknięte" od „zepsute”.
SELECT _z_jako(:Z_NOWY::uuid);
SELECT dolacz_do_meczu(:Z_MECZ::uuid, 'Nowy Norbert');

SELECT _z_oczekuj('przy otwartych zapisach nowa osoba wchodzi normalnie',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :Z_MECZ::uuid AND user_id = :Z_NOWY::uuid), 1);

-- Sprzątamy, żeby dalsze testy miały ten sam stan wyjściowy.
DELETE FROM event_participants
 WHERE event_id = :Z_MECZ::uuid AND user_id = :Z_NOWY::uuid;

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Zamknięcie blokuje NOWE wejścia'; END $$;
-- ---------------------------------------------------------------------------
UPDATE events SET zapisy_zamkniete = true WHERE id = :Z_MECZ::uuid;

SELECT _z_jako(:Z_NOWY::uuid);
SELECT _z_oczekuj_blad('konto bez wpisu nie wejdzie do składu',
  format('SELECT dolacz_do_meczu(%L::uuid, %L)', :Z_MECZ, 'Nowy Norbert'),
  'Zapisy na ten mecz są zamknięte');

SELECT _z_oczekuj_blad('gość bez wpisu nie wejdzie do składu',
  format('SELECT dolacz_do_meczu_jako_goscie(%L::uuid, %L, %L)',
         :Z_MECZ, 'Gość Spóźniony', 'zamk-gosc-spozniony@example.com'),
  'Zapisy na ten mecz są zamknięte');

SELECT _z_oczekuj('żaden nowy wiersz nie powstał',
  (SELECT count(*) FROM event_participants WHERE event_id = :Z_MECZ::uuid), 3);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Rezerwa to też zapis'; END $$;
-- ---------------------------------------------------------------------------
-- Mecz z JEDNYM miejscem i kompletem: bez zamknięcia nowy chętny wylądowałby
-- na rezerwie. Po zamknięciu ma nie wejść nawet tam — człowiek stojący
-- w kolejce do meczu rozstrzygniętego czeka na coś, co nie nadejdzie.
\set Z_MALY '''ffffffff-0000-4000-8000-0000000000d2'''
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title)
VALUES (:Z_MALY::uuid, :Z_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
        dzis_pl() + 3, '20:00', 1, 'public', 'Komplet i zamknięte');
INSERT INTO event_participants (event_id, user_id, name)
VALUES (:Z_MALY::uuid, :Z_GRACZ::uuid, 'Grzegorz Gracz');

SELECT _z_jako(:Z_NOWY::uuid);
SELECT dolacz_do_meczu(:Z_MALY::uuid, 'Nowy Norbert');
SELECT _z_oczekuj('przy otwartych zapisach komplet spycha na rezerwę, nie odrzuca',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :Z_MALY::uuid AND user_id = :Z_NOWY::uuid AND is_reserve), 1);

DELETE FROM event_participants
 WHERE event_id = :Z_MALY::uuid AND user_id = :Z_NOWY::uuid;
UPDATE events SET zapisy_zamkniete = true WHERE id = :Z_MALY::uuid;

SELECT _z_oczekuj_blad('po zamknięciu nie wejdzie nawet na rezerwę',
  format('SELECT dolacz_do_meczu(%L::uuid, %L)', :Z_MALY, 'Nowy Norbert'),
  'Zapisy na ten mecz są zamknięte');

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Kto jest w środku, zostaje w środku'; END $$;
-- ---------------------------------------------------------------------------
-- TO JEST TA ASERCJA, DLA KTÓREJ STRAŻNIK STOI TAM, GDZIE STOI.
-- Gość zapisany przed zamknięciem wraca po swój `claim_token` (odzyskanie
-- linku do wpisu). Ma go dostać — z `already_joined = true`, nie z wyjątkiem.
SELECT _z_oczekuj('gość zapisany PRZED zamknięciem dalej odzyskuje swój wpis',
  (SELECT count(*) FROM dolacz_do_meczu_jako_goscie(
     :Z_MECZ::uuid, 'Gość Wcześniejszy', 'zamk-gosc-wczesniej@example.com')
   WHERE already_joined), 1);

-- Uczestnik z kontem ma dostać SWÓJ komunikat, nie ten o zamkniętych zapisach.
-- Inaczej człowiek już zapisany czyta „zapisy zamknięte" i nie wie, czy gra.
SELECT _z_jako(:Z_GRACZ::uuid);
SELECT _z_oczekuj_blad('zapisany słyszy „jesteś już zapisany", nie „zamknięte"',
  format('SELECT dolacz_do_meczu(%L::uuid, %L)', :Z_MECZ, 'Grzegorz Gracz'),
  'Jesteś już zapisany');

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Organizator i dopisywanie ręczne'; END $$;
-- ---------------------------------------------------------------------------
-- Organizator dopisujący gościa (`addGuest` w `lib/events.ts`) pisze do tabeli
-- wprost, z pominięciem obu funkcji — świadomie. To nie jest zapis, tylko
-- działanie osoby, która zapisy właśnie zamknęła.
INSERT INTO event_participants (event_id, user_id, name, is_guest)
VALUES (:Z_MECZ::uuid, NULL, 'Kolega z WhatsAppa', true);

SELECT _z_oczekuj('organizator dalej dopisze gościa ręcznie',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :Z_MECZ::uuid AND name = 'Kolega z WhatsAppa'), 1);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── To NIE jest odwołanie meczu'; END $$;
-- ---------------------------------------------------------------------------
-- Dwa stany są rozłączne i muszą takie zostać. Gdyby zamknięcie zapisów
-- dotykało `status`, cały skład dostałby „mecz odwołany" (`139`, `140`) —
-- komunikat dokładnie odwrotny do prawdy.
SELECT _z_oczekuj('mecz z zamkniętymi zapisami jest nadal aktywny',
  (SELECT count(*) FROM events
    WHERE id = :Z_MECZ::uuid AND status = 'active' AND zapisy_zamkniete), 1);

SELECT _z_oczekuj('zamknięcie zapisów nie wysłało ani jednego powiadomienia',
  (SELECT count(*) FROM notifications
    WHERE event_id = :Z_MECZ::uuid AND type IN ('mecz_odwolany', 'zmiana_warunkow_meczu')), 0);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Odemknięcie'; END $$;
-- ---------------------------------------------------------------------------
-- Decyzja ma być odwracalna. To jest różnica wobec zmniejszania liczby miejsc,
-- gdzie powrót wymaga pamiętania, ile ich było.
UPDATE events SET zapisy_zamkniete = false WHERE id = :Z_MECZ::uuid;

SELECT _z_jako(:Z_NOWY::uuid);
SELECT dolacz_do_meczu(:Z_MECZ::uuid, 'Nowy Norbert');

SELECT _z_oczekuj('po odemknięciu nowa osoba znowu wchodzi',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :Z_MECZ::uuid AND user_id = :Z_NOWY::uuid), 1);

SELECT set_config('request.jwt.claim.sub', '', false);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Zapisy zamknięte: wszystkie asercje przeszły.'; END $$;
