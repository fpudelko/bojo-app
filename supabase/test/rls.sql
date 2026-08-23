-- Testy reguł dostępu (RLS) — uruchamiane przez `scripts/baza-testowa.sh`,
-- a więc też przez zadanie „Migracje od zera" w CI.
--
-- PO CO OSOBNY PLIK. RLS jest w Bojo JEDYNĄ granicą dostępu: nie ma własnego
-- backendu, przeglądarka rozmawia z bazą bezpośrednio, a klucz `anon` siedzi
-- jawnie w paczce JavaScriptu. Bramka w komponencie („zakładkę Rozmowa widzi
-- uczestnik") nie chroni przed nikim, kto pominie interfejs — a pominięcie
-- interfejsu to jedno zapytanie curlem.
--
-- Tego nie złapie żaden inny test w repo: `tsc` i Vitest nie mają bazy,
-- Playwright chodzi przez interfejs (czyli po właściwej stronie bramki),
-- a migracje „od zera" sprawdzały dotąd wyłącznie, czy schemat się zakłada.
-- Dziura w polityce jest cicha: dane po prostu wychodzą.
--
-- JAK TO CZYTAĆ. Każda asercja mówi „ta rola widzi tyle wierszy". Rola jest
-- prawdziwa (`SET ROLE anon` / `authenticated`), tożsamość podstawiana tak
-- samo jak robi to PostgREST (`request.jwt.claim.sub`). Superusera świadomie
-- nie używamy do liczenia — on RLS omija.
--
-- DOPISUJĄC POLITYKĘ, DOPISZ TU ASERCJĘ. Plik ma rosnąć razem z regułami;
-- nowa polityka bez testu wraca do stanu, w którym wyciek widać dopiero
-- u ludzi.

\set ON_ERROR_STOP on

-- Wyniki zapytań idą do kosza — jedyne, co ma się pokazać, to nagłówki sekcji
-- (`\echo`) i komunikaty ✓ z asercji (NOTICE, czyli standardowe wyjście
-- błędów). Bez tego każda asercja drukuje pustą tabelkę i raport jest nieczytelny.
\o /dev/null

-- ---------------------------------------------------------------------------
-- Pomocnik: porównuje i przerywa cały przebieg przy pierwszej rozbieżności.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION _oczekuj(opis TEXT, otrzymane BIGINT, oczekiwane BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF otrzymane IS DISTINCT FROM oczekiwane THEN
    RAISE EXCEPTION 'RLS: % — oczekiwano % wierszy, jest %', opis, oczekiwane, otrzymane;
  END IF;
  RAISE NOTICE '  ✓ %', opis;
END $$;

GRANT EXECUTE ON FUNCTION _oczekuj(TEXT, BIGINT, BIGINT) TO anon, authenticated;

-- Pomocnik dla zapisów: sprawdza, że operacja ZOSTAŁA odbita przez politykę.
CREATE OR REPLACE FUNCTION _oczekuj_odmowe(opis TEXT, polecenie TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE polecenie;
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RAISE NOTICE '  ✓ %', opis;
      RETURN;
  END;
  RAISE EXCEPTION 'RLS: % — operacja PRZESZŁA, a miała zostać odbita', opis;
END $$;

GRANT EXECUTE ON FUNCTION _oczekuj_odmowe(TEXT, TEXT) TO anon, authenticated;

-- Nagłówek sekcji też idzie przez NOTICE, nie przez `\echo`: `\echo` pisze na
-- standardowe wyjście, a asercje na wyjście błędów, więc mieszanie obu
-- rozjeżdża kolejność raportu.
CREATE OR REPLACE FUNCTION _sekcja(opis TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '── %', opis;
END $$;

GRANT EXECUTE ON FUNCTION _sekcja(TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Dane: jeden mecz prywatny przypięty do ekipy, cztery tożsamości.
-- Stałe UUID-y, żeby asercje niżej dało się czytać bez zaglądania w dane.
-- ---------------------------------------------------------------------------
\set ORGANIZATOR '''aaaaaaaa-0000-4000-8000-000000000001'''
\set UCZESTNIK   '''aaaaaaaa-0000-4000-8000-000000000002'''
\set CZLONEK     '''aaaaaaaa-0000-4000-8000-000000000003'''
\set OBCY        '''aaaaaaaa-0000-4000-8000-000000000004'''
\set MECZ        '''bbbbbbbb-0000-4000-8000-000000000001'''
\set EKIPA       '''cccccccc-0000-4000-8000-000000000001'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:ORGANIZATOR::uuid, 'rls-org@example.com',     now(), '{"display_name":"Ola Organizatorka"}'::jsonb),
  (:UCZESTNIK::uuid,   'rls-uczestnik@example.com', now(), '{"display_name":"Ula Uczestniczka"}'::jsonb),
  (:CZLONEK::uuid,     'rls-czlonek@example.com',  now(), '{"display_name":"Czarek Członek"}'::jsonb),
  (:OBCY::uuid,        'rls-obcy@example.com',     now(), '{"display_name":"Obcy Obcy"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO groups (id, name, created_by)
VALUES (:EKIPA::uuid, 'Ekipa do testów RLS', :ORGANIZATOR::uuid);

-- Członek ekipy, który NIE jest zapisany na mecz — to on rozstrzyga, czy
-- polityka rozmowy zna gałąź „mecz przypięty do ekipy".
-- Założyciela dopisuje do ekipy wyzwalacz przy tworzeniu grupy, stąd
-- `ON CONFLICT` — bez niego ten plik pada na duplikacie klucza.
INSERT INTO group_members (group_id, user_id) VALUES
  (:EKIPA::uuid, :ORGANIZATOR::uuid),
  (:EKIPA::uuid, :CZLONEK::uuid)
ON CONFLICT (group_id, user_id) DO NOTHING;

INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, group_id,
                    cost_grosz, accepted_payment_methods)
VALUES (:MECZ::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko RLS',
        CURRENT_DATE + 5, '20:00', 10, 'private', 'Mecz do testów RLS', :EKIPA::uuid,
        1500, ARRAY['blik']::text[]);

INSERT INTO event_blik (event_id, blik_phone) VALUES (:MECZ::uuid, '500100200');

INSERT INTO event_participants (event_id, user_id, name) VALUES (:MECZ::uuid, :UCZESTNIK::uuid, 'Ula Uczestniczka');

-- Gość bez konta — jego `claim_token` jest sekretem na okaziciela.
INSERT INTO event_participants (event_id, user_id, name, is_guest)
VALUES (:MECZ::uuid, NULL, 'Gość Bez Konta', true);

INSERT INTO event_comments (event_id, user_id, user_name, body)
VALUES (:MECZ::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'Numer do bramy to 1234');

INSERT INTO group_posts (group_id, user_id, user_name, body)
VALUES (:EKIPA::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'Składka 20 zł od osoby');

-- Rozmowa prywatna (migracja 124). Para kanoniczna `low < high` — liczy ją
-- `LEAST/GREATEST`, żeby fixture nie zakładał kolejności identyfikatorów.
INSERT INTO dm_conversations (low_user_id, high_user_id)
VALUES (LEAST(:ORGANIZATOR::uuid, :UCZESTNIK::uuid), GREATEST(:ORGANIZATOR::uuid, :UCZESTNIK::uuid));

INSERT INTO dm_messages (low_user_id, high_user_id, sender_id, sender_name, content)
VALUES (LEAST(:ORGANIZATOR::uuid, :UCZESTNIK::uuid), GREATEST(:ORGANIZATOR::uuid, :UCZESTNIK::uuid),
        :ORGANIZATOR::uuid, 'Ola Organizatorka', 'Numer mojego konta: 11 2222 3333');

SELECT _sekcja('RLS: rozmowa meczu (event_comments)');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany nie widzi ROZMOWY tego meczu',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid), 0);
SELECT _oczekuj('niezalogowany nie widzi ŻADNEJ rozmowy w całej bazie',
                (SELECT count(*) FROM event_comments), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('obcy zalogowany nie widzi rozmowy',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid), 0);
SELECT _oczekuj_odmowe('obcy nie dopisze się do cudzej rozmowy', format(
  'INSERT INTO event_comments (event_id, user_id, user_name, body) VALUES (%L, %L, %L, %L)',
  :MECZ, :OBCY, 'Obcy', 'wcinam się'));

SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
SELECT _oczekuj('uczestnik widzi rozmowę',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid), 1);

SELECT set_config('request.jwt.claim.sub', :ORGANIZATOR, false);
SELECT _oczekuj('organizator widzi rozmowę',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid), 1);

SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
SELECT _oczekuj('członek ekipy meczu widzi rozmowę, choć nie gra',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid), 1);
RESET ROLE;

SELECT _sekcja('RLS: numer BLIK (event_blik)');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany nie widzi ŻADNEGO numeru BLIK w bazie',
                (SELECT count(*) FROM event_blik), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('obcy nie widzi numeru BLIK',
                (SELECT count(*) FROM event_blik WHERE event_id = :MECZ::uuid), 0);
SELECT _oczekuj_odmowe('obcy nie podmieni numeru BLIK', format(
  'INSERT INTO event_blik (event_id, blik_phone) VALUES (%L, %L)
     ON CONFLICT (event_id) DO UPDATE SET blik_phone = %L', :MECZ, '999', '999'));

SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
SELECT _oczekuj('członek ekipy NIE widzi numeru BLIK — nie ma za co płacić',
                (SELECT count(*) FROM event_blik WHERE event_id = :MECZ::uuid), 0);

SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
SELECT _oczekuj('uczestnik widzi numer BLIK',
                (SELECT count(*) FROM event_blik WHERE event_id = :MECZ::uuid), 1);

SELECT set_config('request.jwt.claim.sub', :ORGANIZATOR, false);
SELECT _oczekuj('organizator widzi numer BLIK',
                (SELECT count(*) FROM event_blik WHERE event_id = :MECZ::uuid), 1);
RESET ROLE;

SELECT _sekcja('RLS: kasowanie własnej wiadomości (pułapka z migracji 100)');

-- Autor wypisuje się z meczu i dopiero potem kasuje swoją wiadomość. Polityka
-- SELECT rządzi widocznością wiersza PO zmianie, a kasowanie jest miękkie —
-- gdyby „swoje widzę zawsze" siedziało wewnątrz warunku widoczności rozmowy,
-- ten UPDATE poleciałby wyjątkiem „new row violates row-level security policy".
INSERT INTO event_comments (event_id, user_id, user_name, body)
VALUES (:MECZ::uuid, :UCZESTNIK::uuid, 'Ula Uczestniczka', 'zaraz się wypiszę');
DELETE FROM event_participants WHERE event_id = :MECZ::uuid AND user_id = :UCZESTNIK::uuid;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
SELECT _oczekuj('po wypisaniu się autor nadal widzi WŁASNĄ wiadomość',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid AND user_id = :UCZESTNIK::uuid), 1);
SELECT _oczekuj('po wypisaniu się autor nie widzi już CUDZYCH wiadomości',
                (SELECT count(*) FROM event_comments WHERE event_id = :MECZ::uuid AND user_id <> :UCZESTNIK::uuid), 0);
UPDATE event_comments SET deleted_at = now()
 WHERE event_id = :MECZ::uuid AND user_id = :UCZESTNIK::uuid;
SELECT _oczekuj('kasowanie własnej wiadomości po wypisaniu się przechodzi',
                (SELECT count(*) FROM event_comments
                  WHERE event_id = :MECZ::uuid AND user_id = :UCZESTNIK::uuid AND deleted_at IS NOT NULL), 1);
RESET ROLE;

-- Wraca do składu, żeby dalsze asercje opisywały uczestnika.
INSERT INTO event_participants (event_id, user_id, name)
VALUES (:MECZ::uuid, :UCZESTNIK::uuid, 'Ula Uczestniczka');

SELECT _sekcja('RLS: tablica ekipy (group_posts, migracja 093)');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany nie widzi tablicy ekipy',
                (SELECT count(*) FROM group_posts WHERE group_id = :EKIPA::uuid), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('obcy nie widzi tablicy ekipy',
                (SELECT count(*) FROM group_posts WHERE group_id = :EKIPA::uuid), 0);
SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
SELECT _oczekuj('członek ekipy widzi tablicę',
                (SELECT count(*) FROM group_posts WHERE group_id = :EKIPA::uuid), 1);
RESET ROLE;

SELECT _sekcja('RLS: rozmowy prywatne (dm_messages, migracja 124)');

-- Ta sekcja jest ważniejsza od pozostałych: rozmowa meczu jest półpubliczna
-- z natury, a prywatna korespondencja nie ma ŻADNEJ dopuszczalnej ścieżki
-- wycieku. Anonim nie ma tu nawet grantu; obcy zalogowany widzi zero wierszy.

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany nie widzi żadnej rozmowy prywatnej',
                (SELECT count(*) FROM dm_messages), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('obcy nie widzi CUDZEJ rozmowy prywatnej',
                (SELECT count(*) FROM dm_messages), 0);
SELECT _oczekuj('obcy nie widzi nawet tego, że rozmowa istnieje',
                (SELECT count(*) FROM dm_conversations), 0);

SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
SELECT _oczekuj('strona rozmowy widzi swoją korespondencję',
                (SELECT count(*) FROM dm_messages), 1);

-- Dopisanie się do cudzej rozmowy — obcy nie jest ani `low`, ani `high`,
-- więc odbija go i CHECK, i polityka INSERT.
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie dopisze się do cudzej rozmowy prywatnej',
  'INSERT INTO dm_messages (low_user_id, high_user_id, sender_id, sender_name, content)
     SELECT LEAST(o.id, u.id), GREATEST(o.id, u.id), ' || quote_literal(:OBCY) || '::uuid, ''Obcy'', ''wcinam się''
       FROM (SELECT ' || quote_literal(:ORGANIZATOR) || '::uuid AS id) o,
            (SELECT ' || quote_literal(:UCZESTNIK) || '::uuid AS id) u');
RESET ROLE;

SELECT _sekcja('RLS: blokady i zgłoszenia (migracja 124)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (:UCZESTNIK::uuid, :ORGANIZATOR::uuid);
SELECT _oczekuj('zakładam własną blokadę i ją widzę',
                (SELECT count(*) FROM user_blocks), 1);

-- Po zablokowaniu ŻADNA ze stron nie napisze — kanał działający w jedną stronę
-- jest gorszy niż brak blokady, bo daje złudzenie kontaktu.
SELECT _oczekuj_odmowe('zablokowany nie napisze do blokującego',
  'INSERT INTO dm_messages (low_user_id, high_user_id, sender_id, sender_name, content)
     VALUES (LEAST(' || quote_literal(:ORGANIZATOR) || '::uuid, ' || quote_literal(:UCZESTNIK) || '::uuid),
             GREATEST(' || quote_literal(:ORGANIZATOR) || '::uuid, ' || quote_literal(:UCZESTNIK) || '::uuid),
             ' || quote_literal(:UCZESTNIK) || '::uuid, ''Ula'', ''jednak napiszę'')');

SELECT set_config('request.jwt.claim.sub', :ORGANIZATOR, false);
SELECT _oczekuj('zablokowany NIE WIDZI, że został zablokowany',
                (SELECT count(*) FROM user_blocks), 0);
SELECT _oczekuj('historia sprzed blokady zostaje widoczna obu stronom',
                (SELECT count(*) FROM dm_messages), 1);

-- Zgłoszenia są tylko do zapisu: możliwość sprawdzenia „czy ktoś mnie zgłosił"
-- zamieniłaby narzędzie ochrony w narzędzie nacisku.
INSERT INTO user_reports (reporter_id, reported_id, powod)
VALUES (:ORGANIZATOR::uuid, :OBCY::uuid, 'spam w rozmowie');
SELECT _oczekuj('nikt nie czyta zgłoszeń — także własnych',
                (SELECT count(*) FROM user_reports), 0);
RESET ROLE;

SELECT _sekcja('ZNANE, ŚWIADOMIE OTWARTE (nie regresje — stan do domknięcia)');

-- Te asercje pilnują STANU FAKTYCZNEGO, nie stanu docelowego. Gdy ktoś domknie
-- którąś z tych polityk, test tutaj spadnie — i to jest sygnał do zmiany
-- oczekiwania w tym pliku, a nie do cofania poprawki. Bez nich rozmowa o tym,
-- co jeszcze jest otwarte, opiera się na pamięci.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('OTWARTE: mecz prywatny czyta każdy (events USING true)',
                (SELECT count(*) FROM events WHERE id = :MECZ::uuid), 1);
SELECT _oczekuj('OTWARTE: skład i token gościa czyta każdy (event_participants USING true)',
                (SELECT count(*) FROM event_participants WHERE event_id = :MECZ::uuid AND is_guest), 1);
RESET ROLE;

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ RLS: wszystkie asercje przeszły.'; END $$;
