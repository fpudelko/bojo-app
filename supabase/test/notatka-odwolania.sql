-- Testy notatki organizatora przy odwołaniu meczu (migracja `142`) —
-- uruchamiane przez `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `powiadomienia-o-zmianie.sql` pilnuje KIEDY wyzwalacz ma
-- się odezwać, `poczta-do-kont.sql`/`poczta-goscia.sql` KOMU idzie mail.
-- Tutaj chodzi o CZWARTĄ rzecz: czy treść, którą organizator wpisał w oknie
-- odwołania, faktycznie dojeżdża do wszystkich trzech kanałów naraz (dzwonek,
-- mail do konta, mail do gościa) i czy nie zaśmieca żadnego z nich, gdy jej
-- nie ma albo gdy powód nie ma z odwołaniem nic wspólnego.
--
-- Atrapa `net.http_post` i wpisy w `konfiguracja_poczty` mogą już istnieć —
-- `poczta-goscia.sql` leci wcześniej w tym samym przebiegu. Zakładamy je mimo
-- to, żeby ten plik dało się uruchomić samodzielnie.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _n_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'NOTATKA ODWOŁANIA: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
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

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Notatka organizatora przy odwołaniu (migracja 142)'; END $$;

-- WŁASNA PRZESTRZEŃ UUID-ÓW — żaden inny plik w tym przebiegu nie używa
-- prefiksu `01234567`.
\set N_ORG    '''01234567-0000-4000-8000-000000000001'''
\set N_GRACZ  '''01234567-0000-4000-8000-000000000002'''
\set N_MECZ1  '''01234567-0000-4000-8000-0000000000a1'''
\set N_MECZ2  '''01234567-0000-4000-8000-0000000000a2'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:N_ORG::uuid,   'notatka-org@example.com',   now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:N_GRACZ::uuid, 'notatka-gracz@example.com', now(), '{"display_name":"Grzegorz Gracz"}'::jsonb);

INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title)
VALUES
  (:N_MECZ1::uuid, :N_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 3, '20:00', 10, 'public', 'Mecz z notatką'),
  (:N_MECZ2::uuid, :N_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Orlik Testowy',
   dzis_pl() + 4, '20:00', 10, 'public', 'Mecz bez notatki');

INSERT INTO event_participants (event_id, user_id, name) VALUES
  (:N_MECZ1::uuid, :N_ORG::uuid,   'Ola Organizatorka'),
  (:N_MECZ1::uuid, :N_GRACZ::uuid, 'Grzegorz Gracz'),
  (:N_MECZ2::uuid, :N_ORG::uuid,   'Ola Organizatorka'),
  (:N_MECZ2::uuid, :N_GRACZ::uuid, 'Grzegorz Gracz');

INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email) VALUES
  (:N_MECZ1::uuid, NULL, 'Gość Z Adresem', true, 'notatka-gosc@example.com'),
  (:N_MECZ2::uuid, NULL, 'Gość Bez Notatki', true, 'notatka-gosc2@example.com');

DELETE FROM net._wyslane;

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Odwołanie Z notatką'; END $$;
-- ---------------------------------------------------------------------------
UPDATE events
   SET status = 'cancelled',
       notatka_odwolania = 'Boisko zalane, szukamy zastępczego terminu.'
 WHERE id = :N_MECZ1::uuid;

SELECT _n_oczekuj('dzwonek niesie notatkę w treści',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_odwolany' AND event_id = :N_MECZ1::uuid
      AND user_id = :N_GRACZ::uuid
      AND body LIKE '%Boisko zalane, szukamy zastępczego terminu.%'), 1);

SELECT _n_oczekuj('mail do konta niesie notatkę w polu "notatka"',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'notatka-gracz@example.com'
      AND body ->> 'notatka' = 'Boisko zalane, szukamy zastępczego terminu.'), 1);

SELECT _n_oczekuj('mail do gościa bez konta niesie tę samą notatkę',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'odwolanie'
      AND body ->> 'email' = 'notatka-gosc@example.com'
      AND body ->> 'notatka' = 'Boisko zalane, szukamy zastępczego terminu.'), 1);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Odwołanie BEZ notatki nie zaśmieca żadnego kanału'; END $$;
-- ---------------------------------------------------------------------------
DELETE FROM net._wyslane;

UPDATE events SET status = 'cancelled' WHERE id = :N_MECZ2::uuid;

SELECT _n_oczekuj('dzwonek bez notatki nie dokłada pustego akapitu',
  (SELECT count(*) FROM notifications
    WHERE type = 'mecz_odwolany' AND event_id = :N_MECZ2::uuid
      AND user_id = :N_GRACZ::uuid
      AND body LIKE '%Wiadomość od organizatora%'), 0);

SELECT _n_oczekuj('mail do konta bez notatki ma pole "notatka" puste (null)',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'notatka-gracz@example.com'
      AND body ->> 'notatka' IS NOT NULL), 0);

SELECT _n_oczekuj('mail do gościa bez notatki ma pole "notatka" puste (null)',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'odwolanie'
      AND body ->> 'email' = 'notatka-gosc2@example.com'
      AND body ->> 'notatka' IS NOT NULL), 0);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Przywrócenie czyści notatkę'; END $$;
-- ---------------------------------------------------------------------------
UPDATE events SET status = 'active' WHERE id = :N_MECZ1::uuid;

SELECT _n_oczekuj('przywrócenie meczu zeruje notatka_odwolania',
  (SELECT count(*) FROM events
    WHERE id = :N_MECZ1::uuid AND notatka_odwolania IS NULL), 1);

-- Drugie odwołanie tego samego meczu, tym razem BEZ nowej notatki, nie ma
-- dziedziczyć treści sprzed chwili — to jest sedno migracji `142`: kolumna
-- jest nadpisywana przy KAŻDYM odwołaniu, nie tylko czyszczona przy powrocie.
DELETE FROM net._wyslane;
UPDATE events SET status = 'cancelled' WHERE id = :N_MECZ1::uuid;

SELECT _n_oczekuj('drugie odwołanie bez nowej notatki nie odziedziczyło starej',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'powod' = 'mecz_odwolany'
      AND body ->> 'email' = 'notatka-gracz@example.com'
      AND body ->> 'notatka' IS NOT NULL), 0);

-- ---------------------------------------------------------------------------
DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Notatka nie zaśmieca pozostałych trzech powodów'; END $$;
-- ---------------------------------------------------------------------------
-- Kolumna wciąż niesie wartość (mecz jest teraz odwołany bez nowej notatki —
-- czyli NULL, patrz wyżej), ale nawet gdyby coś w niej stało, `zmiana_terminu`,
-- `zmiana_warunkow_meczu` i `mecz_przywrocony` nie mają z odwołaniem nic
-- wspólnego i pole `notatka` w ich ładunku ma zostać puste.
UPDATE events SET status = 'active', notatka_odwolania = 'resztka z poprzedniego testu'
 WHERE id = :N_MECZ2::uuid;

DELETE FROM net._wyslane;
INSERT INTO notifications (user_id, type, title, body, event_id) VALUES
  (:N_GRACZ::uuid, 'zmiana_terminu',        'Nowy termin', 'x', :N_MECZ2::uuid),
  (:N_GRACZ::uuid, 'zmiana_warunkow_meczu', 'Zmiana',      'x', :N_MECZ2::uuid),
  (:N_GRACZ::uuid, 'mecz_przywrocony',      'Jednak gramy','x', :N_MECZ2::uuid);

SELECT _n_oczekuj('pozostałe trzy powody nie niosą pola "notatka"',
  (SELECT count(*) FROM net._wyslane
    WHERE body ->> 'notatka' IS NOT NULL), 0);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ Notatka odwołania: wszystkie asercje przeszły.'; END $$;
