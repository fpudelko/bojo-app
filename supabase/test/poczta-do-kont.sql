-- Testy poczty do uczestników Z KONTEM (migracja `140`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK obok `poczta-goscia.sql`. Tamten pilnuje kanału dla ludzi
-- BEZ konta, gdzie kluczem idempotencji jest wpis w składzie. Tutaj kluczem
-- jest konto plus MECZ plus doba — i to jest cała trudność: stary indeks
-- `maile_wyslane_konto` obejmował (user_id, powod) bez meczu, bo służył
-- powitaniu („raz w życiu konta"). Gdyby został, drugi odwołany mecz nie
-- wysłałby już nic. Ten plik jest jedynym miejscem, które to sprawdza.
--
-- Atrapa `net.http_post` i wpisy w `konfiguracja_poczty` mogą już istnieć —
-- `poczta-goscia.sql` leci wcześniej w tym samym przebiegu. Zakładamy je
-- mimo to, żeby plik dało się uruchomić samodzielnie.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _k_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'POCZTA DO KONT: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

CREATE SCHEMA IF NOT EXISTS net;
CREATE TABLE IF NOT EXISTS net._wyslane (id BIGSERIAL PRIMARY KEY, url TEXT, body JSONB);
CREATE OR REPLACE FUNCTION net.http_post(url TEXT, body JSONB DEFAULT '{}'::jsonb,
                                         params JSONB DEFAULT '{}'::jsonb,
                                         headers JSONB DEFAULT '{}'::jsonb,
                                         timeout_milliseconds INT DEFAULT 5000)
RETURNS BIGINT LANGUAGE plpgsql AS $net$
BEGIN
  INSERT INTO net._wyslane (url, body) VALUES (url, body);
  RETURN 1;
END $net$;

INSERT INTO konfiguracja_poczty (klucz, wartosc)
VALUES ('url', 'http://atrapa.test/powiadom-goscia'), ('sekret', 'atrapa')
ON CONFLICT (klucz) DO NOTHING;

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Poczta do kont (migracja 140)'; END $$;

-- WŁASNA PRZESTRZEŃ UUID-ÓW, i to nie jest formalność. W tym samym przebiegu
-- poszły już `przypomnienia.sql` (`…0001..0003`) oraz `poczta-goscia.sql`,
-- które zajmuje `…00a1` ORAZ `…00b1..00b3` (konta do testów powitania).
-- Pierwsza wersja tego pliku wzięła `b1..b3` i — przez `ON CONFLICT DO NOTHING`
-- — nie zgłosiła kolizji, tylko po cichu podmieniła adresatów: asercja padła
-- z „oczekiwano 1, jest 0", a mail poszedł do „Haliny Hasło" z cudzego testu.
-- Dlatego niżej NIE MA `ON CONFLICT`: kolizja ma paść jako `duplicate key`,
-- czyli natychmiast i pod właściwym adresem.
\set K_ORG    '''eeeeeeee-0000-4000-8000-0000000000c1'''
\set K_GRACZ  '''eeeeeeee-0000-4000-8000-0000000000c2'''
\set K_CICHY  '''eeeeeeee-0000-4000-8000-0000000000c3'''
\set K_MECZ1  '''ffffffff-0000-4000-8000-0000000000c1'''
\set K_MECZ2  '''ffffffff-0000-4000-8000-0000000000c2'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:K_ORG::uuid,   'konto-org-c1@example.com',   now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:K_GRACZ::uuid, 'konto-gracz-c2@example.com', now(), '{"display_name":"Grzegorz Gracz"}'::jsonb),
  (:K_CICHY::uuid, 'konto-cichy-c3@example.com', now(), '{"display_name":"Cichy Czesław"}'::jsonb);

-- Czesław nie chce maili o odwołaniu. Reszta kanałów zostaje mu włączona —
-- to jest ta różnica, której nie da się wyrazić wspólną listą z pushem.
UPDATE profiles SET mail_wylaczone = ARRAY['mecz_odwolany'] WHERE id = :K_CICHY::uuid;

INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title)
VALUES
  (:K_MECZ1::uuid, :K_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 3, '20:00', 10, 'public', 'Pierwszy mecz'),
  (:K_MECZ2::uuid, :K_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 4, '20:00', 10, 'public', 'Drugi mecz');

INSERT INTO event_participants (event_id, user_id, name) VALUES
  (:K_MECZ1::uuid, :K_ORG::uuid,   'Ola Organizatorka'),
  (:K_MECZ1::uuid, :K_GRACZ::uuid, 'Grzegorz Gracz'),
  (:K_MECZ1::uuid, :K_CICHY::uuid, 'Cichy Czesław'),
  (:K_MECZ2::uuid, :K_ORG::uuid,   'Ola Organizatorka'),
  (:K_MECZ2::uuid, :K_GRACZ::uuid, 'Grzegorz Gracz');

DELETE FROM net._wyslane;

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Odwołanie meczu'; END $$;
-- ---------------------------------------------------------------------------
UPDATE events SET status = 'cancelled' WHERE id = :K_MECZ1::uuid;

SELECT _k_oczekuj('gracz z kontem dostaje mail o odwołaniu',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'konto-gracz-c2@example.com'), 1);

SELECT _k_oczekuj('organizator nie dostaje maila o własnej decyzji',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'email' = 'konto-org-c1@example.com'), 0);

SELECT _k_oczekuj('kto wyłączył ten rodzaj, nie dostaje maila',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'email' = 'konto-cichy-c3@example.com'), 0);

-- Czesław MA wiersz pod dzwonkiem — wyłączenie dotyczy kanału, nie treści.
-- To jest ta sama zasada co przy pushu (`109`): „nie pisz do mnie" nie znaczy
-- „ukryj to przede mną".
SELECT _k_oczekuj('wyłączenie maila nie zabiera powiadomienia w aplikacji',
  (SELECT count(*) FROM notifications
    WHERE user_id = :K_CICHY::uuid AND event_id = :K_MECZ1::uuid
      AND type = 'mecz_odwolany'), 1);

SELECT _k_oczekuj('mail niesie znacznik konta — stopka ma prowadzić do ustawień, nie do wpisu gościa',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany' AND (body ->> 'ma_konto')::boolean), 1);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Idempotencja i jej granice'; END $$;
-- ---------------------------------------------------------------------------

-- Drugie odwołanie TEGO SAMEGO meczu tego samego dnia: bez zmiany nic nie
-- wychodzi, ale nawet wymuszone powtórzenie ma dać jeden mail.
UPDATE events SET status = 'active'    WHERE id = :K_MECZ1::uuid;
UPDATE events SET status = 'cancelled' WHERE id = :K_MECZ1::uuid;

SELECT _k_oczekuj('drugie odwołanie tego samego meczu nie dubluje maila',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'konto-gracz-c2@example.com'), 1);

-- TO JEST TEST, DLA KTÓREGO POWSTAŁ INDEKS Z `event_id`. Stary klucz
-- (user_id, powod) sprawiłby, że drugi odwołany mecz nie wysłałby nic —
-- czyli człowiek pojechałby na boisko, bo o pierwszym odwołaniu wiedział.
UPDATE events SET status = 'cancelled' WHERE id = :K_MECZ2::uuid;

SELECT _k_oczekuj('DRUGI mecz odwołany tego samego dnia wysyła własny mail',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'konto-gracz-c2@example.com'), 2);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Wąska lista powodów'; END $$;
-- ---------------------------------------------------------------------------
-- Powód spoza czwórki nie ma prawa wyjść pocztą. Gdyby wyszedł, kanał
-- zamieniłby się w drugi dzwonek — a wtedy przestałby być czytany także przy
-- odwołanym meczu.
DELETE FROM net._wyslane;

INSERT INTO notifications (user_id, type, title, body, event_id)
VALUES (:K_GRACZ::uuid, 'komplet_skladu', 'Komplet', 'Skład pełny', :K_MECZ2::uuid);

SELECT _k_oczekuj('komplet składu nie idzie pocztą',
  (SELECT count(*) FROM net._wyslane), 0);

INSERT INTO notifications (user_id, type, title, body, event_id)
VALUES (:K_GRACZ::uuid, 'przypomnienie_o_meczu', 'Jutro grasz', 'Jutro 20:00', :K_MECZ2::uuid);

SELECT _k_oczekuj('przypomnienie dzień przed świadomie nie idzie pocztą',
  (SELECT count(*) FROM net._wyslane), 0);

-- Powiadomienie bez meczu (powitanie, prośba spoza meczu) też nie ma
-- czego wysłać — `wyslij_mail_do_konta` wymaga meczu.
INSERT INTO notifications (user_id, type, title, body)
VALUES (:K_GRACZ::uuid, 'mecz_odwolany', 'Bez meczu', 'Bez meczu');

SELECT _k_oczekuj('powiadomienie bez meczu nie wywraca wyzwalacza ani nic nie wysyła',
  (SELECT count(*) FROM net._wyslane), 0);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Pozostałe trzy powody'; END $$;
-- ---------------------------------------------------------------------------
INSERT INTO notifications (user_id, type, title, body, event_id) VALUES
  (:K_GRACZ::uuid, 'zmiana_terminu',        'Nowy termin', 'x', :K_MECZ2::uuid),
  (:K_GRACZ::uuid, 'zmiana_warunkow_meczu', 'Zmiana',      'x', :K_MECZ2::uuid),
  (:K_GRACZ::uuid, 'mecz_przywrocony',      'Jednak gramy','x', :K_MECZ2::uuid);

SELECT _k_oczekuj('pozostałe trzy powody wychodzą pocztą',
  (SELECT count(*) FROM net._wyslane), 3);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Poczta do kont: wszystkie asercje przeszły.'; END $$;
