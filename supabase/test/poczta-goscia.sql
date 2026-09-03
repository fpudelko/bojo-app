-- Testy poczty do gościa bez konta (migracja `133`) — uruchamiane przez
-- `scripts/baza-testowa.sh`, a więc też w CI.
--
-- PO CO OSOBNY PLIK. `rls.sql` pilnuje granic dostępu, `przypomnienia.sql`
-- logiki powiadomień w aplikacji. Tu chodzi o trzecią rzecz: KTO dostaje mail,
-- z jakiego powodu i czy powtórzone uruchomienie zadania nie wyśle go drugi
-- raz. Tego nie widzi ani `tsc`, ani Vitest (nie mają bazy), ani Playwright
-- (nie ma dla tego interfejsu — wołają to wyzwalacze i `pg_cron`).
--
-- ŚWIADOMIE BEZ KONFIGURACJI POCZTY. `konfiguracja_poczty` zostaje pusta, więc
-- `wyslij_mail_do_goscia()` wychodzi cicho, ZANIM dojdzie do `net.http_post`.
-- To jest dokładnie ten warunek, który ma obowiązywać na produkcji do czasu
-- weryfikacji domeny w Resend: kanał milczy i nic się przez to nie psuje.
-- Sprawdzamy więc SELEKCJĘ (kto by dostał) i IDEMPOTENCJĘ (ile razy), czyli
-- to, co decyduje o tym, czy ludzie dostaną spam.

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

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '── Poczta do gościa (migracja 132)'; END $$;

\set M_ORG   '''eeeeeeee-0000-4000-8000-000000000001'''
\set M_JUTRO '''ffffffff-0000-4000-8000-000000000001'''
\set M_WCZOR '''ffffffff-0000-4000-8000-000000000002'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:M_ORG::uuid, 'poczta-org@example.com', now(), '{"display_name":"Ola Organizatorka"}'::jsonb)
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
  (:M_WCZOR::uuid, NULL, 'Gość Który Ma Konto', true, 'poczta-org@example.com');

-- Zapis gościa odpala wyzwalacz `trg_powiadom_goscia_o_zapisie` — cztery wpisy
-- gości wyżej powinny mieć zapisany ślad powodu „zapis".
-- Sześć wpisów wyżej, ale adres ma czterech: {Gość Ze Składu, Gość Z Rezerwy,
-- Gość Bez Konta, Gość Który Ma Konto}. Gość bez adresu i uczestnik z kontem
-- nie mają czym dostać maila — i to jest sedno tej asercji.
SELECT _m_oczekuj('potwierdzenie zapisu tylko dla gości Z ADRESEM',
  (SELECT count(*) FROM maile_goscia WHERE powod = 'zapis'), 4);

SELECT wyslij_maile_do_gosci() \gset wynik_

SELECT _m_oczekuj('„jutro grasz" idzie do gościa ze SKŁADU',
  (SELECT count(*) FROM maile_goscia m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'jutro_grasz' AND p.name = 'Gość Ze Składu'), 1);

SELECT _m_oczekuj('„jutro grasz" NIE idzie do gościa z REZERWY',
  (SELECT count(*) FROM maile_goscia m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'jutro_grasz' AND p.name = 'Gość Z Rezerwy'), 0);

SELECT _m_oczekuj('„jutro grasz" NIE idzie do nikogo bez adresu ani do kont',
  (SELECT count(*) FROM maile_goscia WHERE powod = 'jutro_grasz'), 1);

SELECT _m_oczekuj('zachęta do konta idzie do adresu BEZ konta w Bojo',
  (SELECT count(*) FROM maile_goscia m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'zaloz_konto' AND p.name = 'Gość Bez Konta'), 1);

SELECT _m_oczekuj('zachęta NIE idzie do adresu, który konto już ma',
  (SELECT count(*) FROM maile_goscia m JOIN event_participants p ON p.id = m.uczestnik_id
    WHERE m.powod = 'zaloz_konto' AND p.name = 'Gość Który Ma Konto'), 0);

-- IDEMPOTENCJA. Zadanie `pg_cron` potrafi wystartować dwa razy; dwa identyczne
-- maile to nie „zmiana w meczu", tylko spam — a spam kosztuje cały kanał.
SELECT wyslij_maile_do_gosci() \gset wynik2_
SELECT _m_oczekuj('drugie uruchomienie nie dubluje ani jednego maila',
  (SELECT count(*) FROM maile_goscia WHERE powod IN ('jutro_grasz', 'zaloz_konto')), 2);

-- ODWOŁANIE MECZU — najważniejszy powód ze wszystkich: bez niego gość
-- przyjeżdża na boisko.
UPDATE events SET status = 'cancelled' WHERE id = :M_JUTRO::uuid;
SELECT _m_oczekuj('odwołanie meczu pisze do KAŻDEGO gościa z adresem, także z rezerwy',
  (SELECT count(*) FROM maile_goscia WHERE powod = 'odwolanie'), 2);

-- Zmiana terminu na meczu, który NIE jest odwołany.
UPDATE events SET event_time = '21:00' WHERE id = :M_WCZOR::uuid;
SELECT _m_oczekuj('zmiana terminu pisze do gości tego meczu',
  (SELECT count(*) FROM maile_goscia WHERE powod = 'zmiana'), 2);

-- Zmiana, która nikogo nie obchodzi, nie może generować poczty.
UPDATE events SET description = 'cokolwiek' WHERE id = :M_WCZOR::uuid;
SELECT _m_oczekuj('zmiana opisu NIE wysyła niczego',
  (SELECT count(*) FROM maile_goscia WHERE powod = 'zmiana'), 2);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ POCZTA GOŚCIA: wszystkie asercje przeszły.'; END $$;
