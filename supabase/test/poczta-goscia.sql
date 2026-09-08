-- Testy poczty Bojo — gość bez konta (`133`) i powitanie (`134`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `rls.sql` pilnuje granic dostępu, `przypomnienia.sql`
-- logiki powiadomień w aplikacji. Tu chodzi o trzecią rzecz: KTO dostaje mail,
-- z jakiego powodu i czy powtórzone uruchomienie zadania nie wyśle go drugi
-- raz. Tego nie widzi ani `tsc`, ani Vitest (nie mają bazy), ani Playwright
-- (nie ma dla tego interfejsu — wołają to wyzwalacze i `pg_cron`).
--
-- KONFIGURACJA JEST ATRAPĄ, WYSYŁKA TEŻ. Bez wpisów w `konfiguracja_poczty`
-- `wyslij_mail_do_goscia()` wychodzi cicho ZANIM cokolwiek zapisze — i to jest
-- poprawne zachowanie produkcyjne (kanał niewłączony = nie dzieje się nic),
-- ale nie da się na nim niczego sprawdzić. Pierwsza wersja tego pliku właśnie
-- tak wyglądała i wszystkie asercje wychodziły zerami. Dlatego wpisujemy
-- atrapę adresu i podstawiamy `net.http_post`, żeby przebieg doszedł do końca
-- BEZ wychodzenia w świat.
--
-- Podstawienie `net.http_post` jest bezpieczne WYŁĄCZNIE tutaj: ten plik
-- uruchamia `scripts/baza-testowa.sh` na gołym Postgresie w kontenerze, gdzie
-- `pg_net` w ogóle nie istnieje (migracje `102` i `133` zakładają go w bloku
-- `EXCEPTION` właśnie z tego powodu). Na Supabase tego pliku się nie uruchamia.
--
-- Dzięki atrapie sprawdzamy trzy rzeczy naraz: SELEKCJĘ (kto dostaje maila,
-- a kto nie), IDEMPOTENCJĘ (czy drugie uruchomienie zadania nie wyśle drugi
-- raz) i TREŚĆ ŻĄDANIA (czy do funkcji brzegowej jedzie właściwy powód
-- i adres) — czyli wszystko, co decyduje o tym, czy ludzie dostaną spam
-- albo ciszę.

\set ON_ERROR_STOP on
\o /dev/null

CREATE OR REPLACE FUNCTION _m_oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'POCZTA GOŚCIA: % — oczekiwano %, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

-- Atrapa `pg_net`: zamiast wysyłać, zapisuje żądanie. Nazwy argumentów muszą
-- zgadzać się z wywołaniem w `wyslij_mail_do_goscia()` (wołane po nazwach).
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

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Poczta Bojo (migracje 133 i 134)'; END $$;

-- UUID-y celowo w SWOJEJ przestrzeni: `przypomnienia.sql` leci wcześniej
-- w tym samym przebiegu i zajmuje `eeeeeeee-…0001..0003` oraz
-- `ffffffff-…0001..0003`. Kolizja kluczy padała tu jako „duplicate key",
-- czyli błąd wyglądający na problem z migracją, a nie z fixture'em.
\set M_ORG   '''eeeeeeee-0000-4000-8000-0000000000a1'''
\set M_JUTRO '''ffffffff-0000-4000-8000-0000000000a1'''
\set M_WCZOR '''ffffffff-0000-4000-8000-0000000000a2'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:M_ORG::uuid, 'poczta-org-a1@example.com', now(), '{"display_name":"Ola Organizatorka"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Mecz JUTRO i mecz WCZORAJ — daty liczone `dzis_pl()`, tak jak liczy je
-- `wyslij_maile_do_gosci()`. Sztywna data wywracałaby ten plik raz na dobę.
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title)
VALUES
  (:M_JUTRO::uuid, :M_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko Poczta',
   dzis_pl() + 1, '20:00', 10, 'public', 'Mecz jutro'),
  (:M_WCZOR::uuid, :M_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko Poczta',
   dzis_pl() - 1, '20:00', 10, 'public', 'Mecz wczoraj');

-- Kto jest w składzie jutrzejszego meczu:
--   1. gość z adresem, w składzie            → dostaje „jutro grasz"
--   2. gość z adresem, na REZERWIE           → NIE dostaje (nie wie, czy gra)
--   3. gość BEZ adresu                       → nie ma jak dostać
--   4. uczestnik z KONTEM                    → ma dzwonek i push, nie pocztę
INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email, is_reserve) VALUES
  (:M_JUTRO::uuid, NULL, 'Gość Ze Składu', true, 'gosc-sklad@example.com', false),
  (:M_JUTRO::uuid, NULL, 'Gość Z Rezerwy', true, 'gosc-rezerwa@example.com', true),
  (:M_JUTRO::uuid, NULL, 'Gość Bez Adresu', true, NULL, false),
  (:M_JUTRO::uuid, :M_ORG::uuid, 'Ola Organizatorka', false, NULL, false);

-- Wczorajszy mecz: jeden adres BEZ konta w Bojo (dostanie zachętę) i jeden,
-- który konto już ma (nie ma go po co zachęcać).
INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email) VALUES
  (:M_WCZOR::uuid, NULL, 'Gość Bez Konta', true, 'nowy-gosc@example.com'),
  (:M_WCZOR::uuid, NULL, 'Gość Który Ma Konto', true, 'poczta-org-a1@example.com');

-- Zapis gościa odpala wyzwalacz `trg_powiadom_goscia_o_zapisie` — cztery wpisy
-- gości wyżej powinny mieć zapisany ślad powodu „zapis".
-- Sześć wpisów wyżej, ale adres ma czterech: {Gość Ze Składu, Gość Z Rezerwy,
-- Gość Bez Konta, Gość Który Ma Konto}. Gość bez adresu i uczestnik z kontem
-- nie mają czym dostać maila — i to jest sedno tej asercji.
SELECT _m_oczekuj('potwierdzenie zapisu tylko dla gości Z ADRESEM',
  (SELECT count(*) FROM maile_wyslane WHERE powod = 'zapis'), 4);

SELECT wyslij_maile_do_gosci() \gset wynik_

SELECT _m_oczekuj('„jutro grasz" idzie do gościa ze SKŁADU',
  (SELECT count(*) FROM maile_wyslane m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'jutro_grasz' AND p.name = 'Gość Ze Składu'), 1);

SELECT _m_oczekuj('„jutro grasz" NIE idzie do gościa z REZERWY',
  (SELECT count(*) FROM maile_wyslane m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'jutro_grasz' AND p.name = 'Gość Z Rezerwy'), 0);

SELECT _m_oczekuj('„jutro grasz" NIE idzie do nikogo bez adresu ani do kont',
  (SELECT count(*) FROM maile_wyslane WHERE powod = 'jutro_grasz'), 1);

SELECT _m_oczekuj('zachęta do konta idzie do adresu BEZ konta w Bojo',
  (SELECT count(*) FROM maile_wyslane m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'zaloz_konto' AND p.name = 'Gość Bez Konta'), 1);

SELECT _m_oczekuj('zachęta NIE idzie do adresu, który konto już ma',
  (SELECT count(*) FROM maile_wyslane m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'zaloz_konto' AND p.name = 'Gość Który Ma Konto'), 0);

-- IDEMPOTENCJA. Zadanie `pg_cron` potrafi wystartować dwa razy; dwa identyczne
-- maile to nie „zmiana w meczu", tylko spam — a spam kosztuje cały kanał.
SELECT wyslij_maile_do_gosci() \gset wynik2_
SELECT _m_oczekuj('drugie uruchomienie nie dubluje ani jednego maila',
  (SELECT count(*) FROM maile_wyslane WHERE powod IN ('jutro_grasz', 'zaloz_konto')), 2);

-- ODWOŁANIE MECZU — najważniejszy powód ze wszystkich: bez niego gość
-- przyjeżdża na boisko.
UPDATE events SET status = 'cancelled' WHERE id = :M_JUTRO::uuid;
SELECT _m_oczekuj('odwołanie meczu pisze do KAŻDEGO gościa z adresem, także z rezerwy',
  (SELECT count(*) FROM maile_wyslane WHERE powod = 'odwolanie'), 2);

-- Zmiana terminu na meczu, który NIE jest odwołany.
UPDATE events SET event_time = '21:00' WHERE id = :M_WCZOR::uuid;
SELECT _m_oczekuj('zmiana terminu pisze do gości tego meczu',
  (SELECT count(*) FROM maile_wyslane WHERE powod = 'zmiana'), 2);

-- Zmiana, która nikogo nie obchodzi, nie może generować poczty.
UPDATE events SET description = 'cokolwiek' WHERE id = :M_WCZOR::uuid;
SELECT _m_oczekuj('zmiana opisu NIE wysyła niczego',
  (SELECT count(*) FROM maile_wyslane WHERE powod = 'zmiana'), 2);

-- TREŚĆ ŻĄDANIA. Selekcja może być poprawna, a do funkcji brzegowej i tak
-- pojedzie nie ten adres albo nie ten powód — wtedy mail trafia do kogoś
-- innego, a asercje liczące wiersze niczego nie zauważą.
SELECT _m_oczekuj('do funkcji brzegowej jedzie tyle żądań, ile wpisów w dzienniku',
  (SELECT count(*) FROM net._wyslane), (SELECT count(*) FROM maile_wyslane));

SELECT _m_oczekuj('żądanie o odwołaniu niesie adres TEGO gościa i ten powód',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'odwolanie'
      AND body->>'email' = 'gosc-sklad@example.com'), 1);

-- Tylko maile MECZOWE — powitanie nie dotyczy żadnego wpisu w składzie, więc
-- tokenu nie ma i mieć nie powinno. (Ta asercja padła, gdy doszło powitanie:
-- fixture zakłada konto organizatora z potwierdzonym adresem, więc wyzwalacz
-- z `134` odpala się już na górze pliku.)
SELECT _m_oczekuj('każdy mail MECZOWY niesie token wpisu — bez niego nie ma linku',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' <> 'powitanie' AND body->>'token' IS NULL), 0);

-- ---------------------------------------------------------------------------
-- Mail powitalny (migracja 134)
-- ---------------------------------------------------------------------------
-- Kluczowe jest KIEDY: przy rejestracji hasłem powitanie ma czekać na
-- potwierdzenie adresu, żeby nie przyszło równolegle z „potwierdź adres" od
-- GoTrue. Przy Google adres jest potwierdzony od razu i mail idzie natychmiast.
\set M_GOOGLE '''eeeeeeee-0000-4000-8000-0000000000b1'''
\set M_HASLO  '''eeeeeeee-0000-4000-8000-0000000000b2'''

-- Konto „z Google": adres potwierdzony już przy wstawieniu.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (:M_GOOGLE::uuid, 'powitanie-google@example.com', now(), '{"full_name":"Grzegorz Google"}'::jsonb);
SELECT _m_oczekuj('konto z potwierdzonym adresem dostaje powitanie od razu',
  (SELECT count(*) FROM maile_wyslane WHERE user_id = :M_GOOGLE::uuid AND powod = 'powitanie'), 1);

-- Konto „z hasłem": adres NIEpotwierdzony, więc na razie cisza.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (:M_HASLO::uuid, 'powitanie-haslo@example.com', NULL, '{"display_name":"Halina Hasło"}'::jsonb);
SELECT _m_oczekuj('konto BEZ potwierdzonego adresu NIE dostaje powitania',
  (SELECT count(*) FROM maile_wyslane WHERE user_id = :M_HASLO::uuid), 0);

-- Kliknięcie w link potwierdzający.
UPDATE auth.users SET email_confirmed_at = now() WHERE id = :M_HASLO::uuid;
SELECT _m_oczekuj('powitanie wychodzi dopiero po potwierdzeniu adresu',
  (SELECT count(*) FROM maile_wyslane WHERE user_id = :M_HASLO::uuid AND powod = 'powitanie'), 1);

-- Powitanie ma pójść RAZ W ŻYCIU konta, nie raz dziennie — dlatego jego indeks
-- idempotencji nie ma w kluczu daty. Kolejne zmiany na koncie nie mogą go
-- wysłać drugi raz.
UPDATE auth.users SET email_confirmed_at = now() + interval '1 hour' WHERE id = :M_HASLO::uuid;
SELECT _m_oczekuj('powtórne potwierdzenie nie wysyła powitania drugi raz',
  (SELECT count(*) FROM maile_wyslane WHERE user_id = :M_HASLO::uuid AND powod = 'powitanie'), 1);

SELECT _m_oczekuj('żądanie powitalne niesie adres i NIE niesie meczu',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'powitanie'
      AND body->>'email' = 'powitanie-google@example.com'
      AND body->>'event_id' IS NULL), 1);

-- Konto bez nazwy własnej: mail ma wyjść, tylko bez imienia.
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES ('eeeeeeee-0000-4000-8000-0000000000b3'::uuid, 'powitanie-bezimienia@example.com', now(), '{}'::jsonb);
SELECT _m_oczekuj('konto BEZ nazwy własnej też dostaje powitanie',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'powitanie'
      AND body->>'email' = 'powitanie-bezimienia@example.com'
      AND body->>'imie' IS NULL), 1);


-- ── Migracja 137: poczta mówi prawdę i dociera tam, gdzie obiecała ──────────

\set M_AKCEPT '''ffffffff-0000-4000-8000-0000000000a3'''
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, require_approval)
VALUES (:M_AKCEPT::uuid, :M_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko Poczta',
        dzis_pl() + 3, '20:00', 10, 'public', 'Mecz z akceptacją', true);

INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email, pending_approval)
VALUES (:M_AKCEPT::uuid, NULL, 'Gość W Poczekalni', true, 'poczekalnia@example.com', true);

-- 1. Gość w poczekalni NIE MOŻE dostać „masz miejsce w składzie".
SELECT _m_oczekuj('mail o zapisie niesie stan „czeka na akceptację"',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'zapis'
      AND body->>'email' = 'poczekalnia@example.com'
      AND body->>'czeka_na_akceptacje' = 'true'), 1);

-- 2. Rozpatrzenie prośby dociera do gościa — dotąd nie dowiadywał się NICZEGO.
UPDATE event_participants SET pending_approval = false
 WHERE event_id = :M_AKCEPT::uuid AND guest_email = 'poczekalnia@example.com';
SELECT _m_oczekuj('akceptacja prośby idzie do gościa mailem',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'zaakceptowano'
      AND body->>'email' = 'poczekalnia@example.com'), 1);

INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email, pending_approval)
VALUES (:M_AKCEPT::uuid, NULL, 'Gość Do Odrzucenia', true, 'odrzucony@example.com', true);
DELETE FROM event_participants
 WHERE event_id = :M_AKCEPT::uuid AND guest_email = 'odrzucony@example.com';
SELECT _m_oczekuj('odrzucenie prośby też idzie do gościa mailem',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'odrzucono'
      AND body->>'email' = 'odrzucony@example.com'), 1);

-- 3. Gość na rezerwie DOSTAJE ofertę zwolnionego miejsca. Do `137` kolejka
--    pomijała go po cichu (`user_id IS NOT NULL`), a mail „jesteś na rezerwie"
--    obiecywał mu ją wprost.
\set M_OFERTA '''ffffffff-0000-4000-8000-0000000000a4'''
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, reserve_claim_minutes)
VALUES (:M_OFERTA::uuid, :M_ORG::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko Poczta',
        dzis_pl() + 4, '20:00', 2, 'public', 'Mecz z ofertą', 180);

INSERT INTO event_participants (event_id, user_id, name, is_guest, guest_email, is_reserve) VALUES
  (:M_OFERTA::uuid, :M_ORG::uuid, 'Ola Organizatorka', false, NULL, false),
  (:M_OFERTA::uuid, NULL, 'Ktoś Kto Wyjdzie', true, 'wyjdzie@example.com', false),
  (:M_OFERTA::uuid, NULL, 'Gość Na Rezerwie', true, 'rezerwa-gosc@example.com', true),
  (:M_OFERTA::uuid, NULL, 'Gość Bez Adresu Na Rezerwie', true, NULL, true);

DELETE FROM event_participants
 WHERE event_id = :M_OFERTA::uuid AND guest_email = 'wyjdzie@example.com';
SELECT sync_reserve_claim(:M_OFERTA::uuid);

SELECT _m_oczekuj('oferta zwolnionego miejsca idzie do gościa Z ADRESEM',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'oferta'
      AND body->>'email' = 'rezerwa-gosc@example.com'), 1);
SELECT _m_oczekuj('oferta niesie termin — bez niego gość nie wie, ile ma czasu',
  (SELECT count(*) FROM net._wyslane
    WHERE body->>'powod' = 'oferta'
      AND body->>'oferta_do' IS NOT NULL), 1);
SELECT _m_oczekuj('to gość Z ADRESEM ma stojącą ofertę, nie ten bez',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :M_OFERTA::uuid AND claim_offered_at IS NOT NULL
      AND guest_email = 'rezerwa-gosc@example.com'), 1);

-- 4. Gość bez adresu nie blokuje kolejki i jest widoczny jako pominięty.
SELECT _m_oczekuj('gość BEZ adresu nie dostaje oferty — nie ma jak go zawiadomić',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :M_OFERTA::uuid AND guest_email IS NULL
      AND claim_offered_at IS NOT NULL), 0);
SELECT _m_oczekuj('kolumna pochodna mówi interfejsowi, do kogo da się napisać',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :M_OFERTA::uuid AND is_guest AND ma_guest_email), 1);

-- 5. Gość przyjmuje ofertę SWOIM tokenem — bez tego mail byłby obietnicą
--    bez pokrycia, bo strona „Twój zapis" nie miała takiej akcji.
SELECT claim_token FROM event_participants
 WHERE event_id = :M_OFERTA::uuid AND guest_email = 'rezerwa-gosc@example.com' \gset token_oferty_
SELECT _m_oczekuj('podgląd wpisu pokazuje, że oferta stoi i do kiedy',
  (SELECT count(*) FROM podejrzyj_wpis_goscia(:'token_oferty_claim_token'::uuid)
    WHERE oferta_do IS NOT NULL), 1);
SELECT przyjmij_oferte_goscia(:'token_oferty_claim_token'::uuid);
SELECT _m_oczekuj('po przyjęciu gość jest w SKŁADZIE, nie na rezerwie',
  (SELECT count(*) FROM event_participants
    WHERE event_id = :M_OFERTA::uuid AND guest_email = 'rezerwa-gosc@example.com'
      AND NOT is_reserve AND claim_offered_at IS NULL), 1);
SELECT _m_oczekuj('drugie przyjęcie tej samej oferty już nie przechodzi',
  (SELECT count(*) FROM (
     SELECT 1 FROM podejrzyj_wpis_goscia(:'token_oferty_claim_token'::uuid)
      WHERE oferta_do IS NOT NULL) s), 0);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ POCZTA: wszystkie asercje przeszły.'; END $$;
