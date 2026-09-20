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

-- Pomocnik dla funkcji, które bronią się WŁASNYM wyjątkiem, a nie polityką
-- (np. `wypisz_wpis_goscia` przy nieznanym tokenie). Osobny od
-- `_oczekuj_odmowe` celowo: tam „odbite" ma znaczyć „odbiła to baza swoimi
-- uprawnieniami", i rozluźnienie tamtego pomocnika do `WHEN OTHERS`
-- przepuszczałoby literówkę w zapytaniu jako zaliczony test.
CREATE OR REPLACE FUNCTION _oczekuj_wyjatek(opis TEXT, polecenie TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE polecenie;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '  ✓ %', opis;
      RETURN;
  END;
  RAISE EXCEPTION 'RLS: % — operacja PRZESZŁA, a miała zostać odbita', opis;
END $$;

GRANT EXECUTE ON FUNCTION _oczekuj_wyjatek(TEXT, TEXT) TO anon, authenticated;

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

-- Token zapamiętujemy TERAZ, jeszcze jako superuser. Od migracji `127` żadna
-- rola API nie przeczyta go z wiersza — a testy niżej muszą nim dysponować,
-- bo sprawdzają dokładnie to, co ma nim zrobić gość z linku.
SELECT claim_token AS token_goscia
  FROM event_participants
 WHERE event_id = :MECZ::uuid AND is_guest \gset

INSERT INTO event_comments (event_id, user_id, user_name, body)
VALUES (:MECZ::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'Numer do bramy to 1234');

INSERT INTO group_posts (group_id, user_id, user_name, body)
VALUES (:EKIPA::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'Składka 20 zł od osoby');

-- Rozmowa prywatna (migracja 125). Para kanoniczna `low < high` — liczy ją
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

SELECT _sekcja('RLS: rozmowy prywatne (dm_messages, migracja 125)');

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

SELECT _sekcja('RLS: blokady i zgłoszenia (migracja 125)');

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

SELECT _sekcja('Prywatne kolumny składu (migracja 127)');

-- Polityka na `event_participants` nadal ma `USING (true)` — skład meczu jest
-- publiczny i taki ma zostać. Granicą są tu UPRAWNIENIA KOLUMNOWE: e-mail
-- gościa, telefony i tokeny wychodzą z listy czytelnej przez API. Postgres
-- odpowiada na to wyjątkiem `insufficient_privilege`, nie pustym wynikiem,
-- więc sprawdzamy tym samym pomocnikiem co odbite zapisy.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj_odmowe('anon NIE czyta e-maila gościa',
  format('SELECT guest_email FROM event_participants WHERE event_id = %L', :MECZ));
SELECT _oczekuj_odmowe('anon NIE czyta tokenu przejęcia wpisu',
  format('SELECT claim_token FROM event_participants WHERE event_id = %L', :MECZ));
SELECT _oczekuj_odmowe('anon NIE czyta telefonu uczestnika',
  format('SELECT phone FROM event_participants WHERE event_id = %L', :MECZ));
-- `select('*')` też ma się wywalić: to jest ta zmiana, przez którą kod musi
-- wymieniać kolumny z nazwy (patrz kolejność wdrożenia w migracji 127).
SELECT _oczekuj_odmowe('anon NIE pobierze całego wiersza przez select(*)',
  format('SELECT * FROM event_participants WHERE event_id = %L', :MECZ));
-- ...ale sam skład zostaje publiczny. Bez tej asercji łatwo „naprawić"
-- wyciek, zamykając przy okazji stronę meczu dla zaproszonych.
SELECT _oczekuj('anon NADAL czyta skład (imię, rola, rezerwa)',
                (SELECT count(*) FROM (
                   SELECT name, is_reserve, is_goalkeeper, pending_approval
                     FROM event_participants WHERE event_id = :MECZ::uuid) s), 2);
RESET ROLE;

-- Zalogowany obcy jest w tej samej sytuacji co niezalogowany: token wpisu
-- gościa wydaje wyłącznie funkcja `token_wpisu_goscia()`, sprawdzająca,
-- czy pytający organizuje mecz albo sam tego gościa dopisał.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy zalogowany NIE czyta tokenu z wiersza',
  format('SELECT claim_token FROM event_participants WHERE event_id = %L', :MECZ));
SELECT _oczekuj('obcy nie dostaje tokenu z funkcji',
                (SELECT count(*) FROM (
                   SELECT token_wpisu_goscia(p.id) AS t
                     FROM event_participants p
                    WHERE p.event_id = :MECZ::uuid AND p.is_guest) s
                  WHERE s.t IS NOT NULL), 0);
SELECT set_config('request.jwt.claim.sub', :ORGANIZATOR, false);
SELECT _oczekuj('organizator dostaje token swojego gościa',
                (SELECT count(*) FROM (
                   SELECT token_wpisu_goscia(p.id) AS t
                     FROM event_participants p
                    WHERE p.event_id = :MECZ::uuid AND p.is_guest) s
                  WHERE s.t IS NOT NULL), 1);
RESET ROLE;

SELECT _sekcja('Własny wpis w składzie (migracja 132)');

-- PO CO. Polityka „Own participation update" (`053`) brzmi `auth.uid() =
-- user_id` i nie mówi, KTÓRE kolumny — a Postgres nie zawęża RLS do kolumn.
-- Do migracji `132` znaczyło to, że uczestnik jednym UPDATE-em wychodził
-- z poczekalni, awansował się z rezerwy ponad limit i odhaczał sobie wpłatę.
-- Asercje niżej pilnują OBU stron: że tego się nie da, i że zwykła ścieżka
-- (zmiana deklaracji, przyjęcie oferty z rezerwy) dalej działa. Bez tej drugiej
-- połowy łatwo „naprawić" wyzwalacz tak, że zablokuje wszystko.
--
-- Osobny mecz, żeby nie ruszać liczników asercji wyżej.
\set MECZ2 '''bbbbbbbb-0000-4000-8000-000000000002'''

INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, require_approval)
VALUES (:MECZ2::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko RLS 2',
        CURRENT_DATE + 5, '20:00', 1, 'public', 'Mecz do testów wpisu', true);

-- Uczestnik czeka na akceptację; obcy stoi na rezerwie ze STOJĄCĄ ofertą.
INSERT INTO event_participants (event_id, user_id, name, pending_approval)
VALUES (:MECZ2::uuid, :UCZESTNIK::uuid, 'Ula Uczestniczka', true);
INSERT INTO event_participants (event_id, user_id, name, is_reserve, claim_offered_at)
VALUES (:MECZ2::uuid, :OBCY::uuid, 'Obcy Obcy', true, now());

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);

SELECT _oczekuj_odmowe('uczestnik NIE wyjdzie sam z poczekalni', format(
  'UPDATE event_participants SET pending_approval = false
     WHERE event_id = %L AND user_id = %L', :MECZ2, :UCZESTNIK));

SELECT _oczekuj_odmowe('uczestnik NIE odhaczy sobie wpłaty', format(
  'UPDATE event_participants SET has_paid = true
     WHERE event_id = %L AND user_id = %L', :MECZ2, :UCZESTNIK));

SELECT _oczekuj_odmowe('uczestnik NIE przypisze się do drużyny', format(
  'UPDATE event_participants SET team = ''A''
     WHERE event_id = %L AND user_id = %L', :MECZ2, :UCZESTNIK));

-- Deklaracja własna ma dalej działać — to jest zwykła ścieżka „zmieniam
-- metodę płatności", nie obejście czegokolwiek.
UPDATE event_participants SET rsvp = 'yes', payment_method = 'blik'
 WHERE event_id = :MECZ2::uuid AND user_id = :UCZESTNIK::uuid;
SELECT _oczekuj('uczestnik ZMIENI swoją deklarację płatności',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ2::uuid AND user_id = :UCZESTNIK::uuid
                    AND payment_method = 'blik'), 1);

SELECT set_config('request.jwt.claim.sub', :OBCY, false);

-- Rezerwowy ZE stojącą ofertą wchodzi do składu — `acceptReserveClaim()`.
UPDATE event_participants SET is_reserve = false, claim_offered_at = NULL
 WHERE event_id = :MECZ2::uuid AND user_id = :OBCY::uuid;
SELECT _oczekuj('rezerwowy PRZYJMIE stojącą ofertę zwolnionego miejsca',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ2::uuid AND user_id = :OBCY::uuid
                    AND NOT is_reserve), 1);

-- …a bez oferty już nie. Cofamy go na rezerwę jako organizator i próbujemy.
RESET ROLE;
UPDATE event_participants SET is_reserve = true, claim_offered_at = NULL, claim_passed = false
 WHERE event_id = :MECZ2::uuid AND user_id = :OBCY::uuid;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);

SELECT _oczekuj_odmowe('rezerwowy BEZ oferty NIE awansuje się sam', format(
  'UPDATE event_participants SET is_reserve = false
     WHERE event_id = %L AND user_id = %L', :MECZ2, :OBCY));

SELECT _oczekuj_odmowe('rezerwowy NIE wystawi sobie oferty miejsca', format(
  'UPDATE event_participants SET claim_offered_at = now()
     WHERE event_id = %L AND user_id = %L', :MECZ2, :OBCY));

-- INSERT: spreparowany wiersz ma zostać ZNORMALIZOWANY, nie odbity — inaczej
-- padłoby „Obserwuję" (`joinEventMaybe`), które też wstawia wiersz wprost.
SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
INSERT INTO event_participants (event_id, user_id, name, is_reserve, pending_approval, has_paid, is_captain)
VALUES (:MECZ2::uuid, :CZLONEK::uuid, 'Czarek Członek', false, false, true, true);
SELECT _oczekuj('spreparowany INSERT ląduje w poczekalni, bez wpłaty i bez kapitana',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ2::uuid AND user_id = :CZLONEK::uuid
                    AND pending_approval AND NOT has_paid AND NOT is_captain), 1);
RESET ROLE;

SELECT _sekcja('Uczestnik dopisuje gościa, gdy organizator pozwolił (migracja 132)');

-- PO CO. Przełącznik `allow_guest_adds` nie działał NIGDY: polityka INSERT
-- dopuszczała `auth.uid() = user_id`, a wiersz gościa ma `user_id IS NULL`,
-- więc warunek wychodził NULL. Organizator włączał przełącznik, aplikacja
-- mówiła „Uczestnicy mogą teraz dodawać gości", a uczestnik po kliknięciu
-- „Dodaj" dostawał komunikat o polityce.
\set MECZ3 '''bbbbbbbb-0000-4000-8000-000000000003'''

INSERT INTO events (id, organizer_id, organizer_name, sport, field_name,
                    event_date, event_time, max_players, visibility, title, allow_guest_adds)
VALUES (:MECZ3::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko RLS 3',
        CURRENT_DATE + 5, '20:00', 10, 'public', 'Mecz z gośćmi od uczestników', true);
INSERT INTO event_participants (event_id, user_id, name)
VALUES (:MECZ3::uuid, :UCZESTNIK::uuid, 'Ula Uczestniczka');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by)
VALUES (:MECZ3::uuid, NULL, 'Kolega z pracy', true, :UCZESTNIK::uuid);
SELECT _oczekuj('uczestnik DOPISZE gościa, gdy przełącznik jest włączony',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ3::uuid AND is_guest), 1);

SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('gościa NIE dopisze ktoś spoza składu', format(
  'INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by)
   VALUES (%L, NULL, ''Obcy gość'', true, %L)', :MECZ3, :OBCY));
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);

SELECT _oczekuj_odmowe('gościa NIE dopisze się na mecz z wyłączonym przełącznikiem', format(
  'INSERT INTO event_participants (event_id, user_id, name, is_guest, added_by)
   VALUES (%L, NULL, ''Kolega'', true, %L)', :MECZ, :UCZESTNIK));
RESET ROLE;

SELECT _sekcja('Kolumny, które CZYTA aplikacja, są czytelne (migracje 127 i dalsze)');

-- TA SEKCJA POWSTAŁA Z BŁĘDU. Migracja `127` zamieniła tabelowy GRANT SELECT na
-- uprawnienia KOLUMNOWE, żeby ukryć `guest_email`, telefony i `claim_token`.
-- Skutek uboczny, o którym łatwo zapomnieć: każda NOWA kolumna dziedziczy
-- tabelowe INSERT i UPDATE, ale NIE dostaje SELECT-a — bo tego już na poziomie
-- tabeli nie ma. Migracja `135` dodała `oferta_wygasla_at` i grantu nie nadała,
-- więc `getEvent()` dostawałoby 403 i STRONA MECZU PRZESTAŁABY SIĘ WCZYTYWAĆ.
-- Objaw byłby przy tym mylący: kolumna istnieje, `psql` ją czyta, a wywraca się
-- wyłącznie ruch przez PostgREST-a.
--
-- Lista niżej to dokładnie to, co wymienia `select()` w `getEvent()`
-- (`lib/events.ts`). Dokładasz kolumnę do tamtego zapytania → dokładasz ją tutaj
-- i nadajesz GRANT w migracji.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
SELECT _oczekuj('aplikacja czyta wszystkie kolumny składu, których potrzebuje',
  (SELECT count(*) FROM (
     SELECT id, event_id, user_id, name, is_guest, created_at, has_paid, is_reserve,
            team, paid_amount, is_captain, added_by, is_goalkeeper, pending_approval,
            rsvp, payment_method, has_sports_card, sports_card_provider,
            claim_offered_at, claim_passed, oferta_wygasla_at, ma_guest_email,
            claimed_at, zapisano_at
       FROM event_participants WHERE event_id = :MECZ::uuid) s), 2);
RESET ROLE;

-- Druga strona tej samej reguły: to, co `127` ukryło, MA zostać ukryte.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj_odmowe('nowa kolumna nie otwiera drogi do e-maila gościa',
  format('SELECT guest_email, oferta_wygasla_at FROM event_participants WHERE event_id = %L', :MECZ));
RESET ROLE;

SELECT _sekcja('Kolejka rezerwowa i anulowanie prośby (migracja 135)');

-- ODPUSZCZENIE vs WYGAŚNIĘCIE to dwie różne rzeczy i mają dawać różny skutek:
-- kto odmówił świadomie, wypada z kolejki; kto nie zdążył odpowiedzieć, wraca
-- na jej koniec. Do `135` obie ścieżki ustawiały `claim_passed` i wykluczały
-- z kolejki na zawsze — a okno „Odpuszczasz to miejsce?" obiecywało coś wprost
-- przeciwnego.
--
-- Mecz z jednym wolnym miejscem: dwie osoby w składzie, dwie na rezerwie.
\set MECZ4 '''bbbbbbbb-0000-4000-8000-000000000004'''
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date,
                    event_time, max_players, visibility, reserve_claim_minutes)
-- 3 miejsca, 2 osoby w składzie: JEDNO wolne, czyli dokładnie stan po czyimś
-- wypisaniu się. Bez wolnego miejsca `sync_reserve_claim()` nie ma czego
-- oferować i cała sekcja sprawdzałaby ciszę.
VALUES (:MECZ4::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko RLS 4',
        CURRENT_DATE + 5, '20:00', 3, 'public', 180);

INSERT INTO event_participants (event_id, user_id, name, is_reserve, zapisano_at) VALUES
  (:MECZ4::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', false, now() - interval '5 hours'),
  (:MECZ4::uuid, :CZLONEK::uuid,     'Czesiek Członek',   false, now() - interval '4 hours'),
  (:MECZ4::uuid, :UCZESTNIK::uuid,   'Ula Uczestniczka',  true,  now() - interval '3 hours'),
  (:MECZ4::uuid, :OBCY::uuid,        'Obcy Rezerwowy',    true,  now() - interval '2 hours');

-- Wygasła oferta: Ula dostała ofertę cztery godziny temu, okno to 180 minut.
UPDATE event_participants SET claim_offered_at = now() - interval '4 hours'
 WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid;
SELECT sync_reserve_claim(:MECZ4::uuid);

SELECT _oczekuj('wygaśnięcie NIE ustawia claim_passed — to nie była odmowa',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid
                    AND claim_passed = false), 1);
SELECT _oczekuj('wygaśnięcie ZNACZY wpis czasem, czyli spycha na koniec kolejki',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid
                    AND oferta_wygasla_at IS NOT NULL), 1);
SELECT _oczekuj('gracz dowiaduje się, że czas minął — dotąd znikał z kolejki w ciszy',
                (SELECT count(*) FROM notifications
                  WHERE user_id = :UCZESTNIK::uuid AND type = 'oferta_wygasla'), 1);
SELECT _oczekuj('miejsce poszło do NASTĘPNEJ osoby z kolejki',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ4::uuid AND user_id = :OBCY::uuid
                    AND claim_offered_at IS NOT NULL), 1);

-- Obcy też nie odpowiada. Teraz kolejka ma wybrać Ulę PONOWNIE — bo została
-- w niej, tylko na końcu. To jest cała różnica wprowadzona przez `135`.
UPDATE event_participants SET claim_offered_at = now() - interval '4 hours'
 WHERE event_id = :MECZ4::uuid AND user_id = :OBCY::uuid;
SELECT sync_reserve_claim(:MECZ4::uuid);
SELECT _oczekuj('kto nie zdążył, dostaje KOLEJNĄ ofertę — nie wypadł z kolejki',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid
                    AND claim_offered_at IS NOT NULL), 1);

-- Świadome „Odpuszczam" (frontend: `declineReserveClaim`) — wypada NA STAŁE.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :UCZESTNIK, false);
UPDATE event_participants SET claim_offered_at = NULL, claim_passed = true
 WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid;
RESET ROLE;
SELECT sync_reserve_claim(:MECZ4::uuid);
SELECT _oczekuj('kto ODPUŚCIŁ, nie dostaje kolejnej oferty',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ4::uuid AND user_id = :UCZESTNIK::uuid
                    AND claim_offered_at IS NOT NULL), 0);

-- `oferta_wygasla_at` ustawia Bojo, nie przeglądarka: bez tej bramki gracz
-- wracałby na początek kolejki jednym UPDATE-em z konsoli.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('gracz NIE wyzeruje sobie miejsca w kolejce', format(
  'UPDATE event_participants SET oferta_wygasla_at = NULL
    WHERE event_id = %L AND user_id = %L', :MECZ4, :OBCY));
RESET ROLE;

-- ANULOWANIE WŁASNEJ PROŚBY to nie odrzucenie przez organizatora (migracja 135).
\set MECZ5 '''bbbbbbbb-0000-4000-8000-000000000005'''
INSERT INTO events (id, organizer_id, organizer_name, sport, field_name, event_date,
                    event_time, max_players, visibility, require_approval)
VALUES (:MECZ5::uuid, :ORGANIZATOR::uuid, 'Ola Organizatorka', 'piłka nożna', 'Boisko RLS 5',
        CURRENT_DATE + 5, '20:00', 10, 'public', true);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
INSERT INTO event_participants (event_id, user_id, name, pending_approval)
VALUES (:MECZ5::uuid, :CZLONEK::uuid, 'Czesiek Członek', true);
DELETE FROM event_participants WHERE event_id = :MECZ5::uuid AND user_id = :CZLONEK::uuid;
RESET ROLE;

SELECT _oczekuj('kto sam wycofał prośbę, NIE dostaje „organizator nie przyjął"',
                (SELECT count(*) FROM notifications
                  WHERE user_id = :CZLONEK::uuid AND type = 'prosba_odrzucona'
                    AND event_id = :MECZ5::uuid), 0);

-- Kontrola w drugą stronę: odrzucenie PRZEZ ORGANIZATORA nadal powiadamia.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :CZLONEK, false);
INSERT INTO event_participants (event_id, user_id, name, pending_approval)
VALUES (:MECZ5::uuid, :CZLONEK::uuid, 'Czesiek Członek', true);
SELECT set_config('request.jwt.claim.sub', :ORGANIZATOR, false);
DELETE FROM event_participants WHERE event_id = :MECZ5::uuid AND user_id = :CZLONEK::uuid;
RESET ROLE;

SELECT _oczekuj('odrzucenie przez organizatora nadal powiadamia gracza',
                (SELECT count(*) FROM notifications
                  WHERE user_id = :CZLONEK::uuid AND type = 'prosba_odrzucona'
                    AND event_id = :MECZ5::uuid), 1);

SELECT _sekcja('ZNANE, ŚWIADOMIE OTWARTE (nie regresje — stan do domknięcia)');

-- Te asercje pilnują STANU FAKTYCZNEGO, nie stanu docelowego. Gdy ktoś domknie
-- którąś z tych polityk, test tutaj spadnie — i to jest sygnał do zmiany
-- oczekiwania w tym pliku, a nie do cofania poprawki. Bez nich rozmowa o tym,
-- co jeszcze jest otwarte, opiera się na pamięci.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('OTWARTE: mecz prywatny czyta każdy (events USING true)',
                (SELECT count(*) FROM events WHERE id = :MECZ::uuid), 1);
-- Skład (imiona, role, rezerwa) czyta każdy — polityka wierszowa nadal
-- `USING (true)`. Token i e-mail gościa już NIE: to załatwiła migracja `127`
-- uprawnieniami kolumnowymi, asercje wyżej.
SELECT _oczekuj('OTWARTE: skład meczu prywatnego czyta każdy (event_participants USING true)',
                (SELECT count(*) FROM event_participants WHERE event_id = :MECZ::uuid AND is_guest), 1);
RESET ROLE;

SELECT _sekcja('Gość zarządza swoim zapisem (migracja 128)');

-- NA KOŃCU PLIKU ŚWIADOMIE: ta sekcja jako jedyna KASUJE wiersz ze składu,
-- więc postawiona wyżej wywracałaby asercje liczące uczestników.
--
-- Uprawnieniem jest sam token — model jak `join_code`. Dlatego wypisanie ma
-- działać BEZ logowania, ale wyłącznie dla tokenu, który się zna.
SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('podgląd wpisu przez token pokazuje stan meczu i składu',
                (SELECT count(*) FROM podejrzyj_wpis_goscia(:'token_goscia'::uuid)
                  WHERE status_meczu = 'active' AND mozna_zmieniac
                    AND w_skladzie = 2 AND max_graczy = 10 AND koszt_grosze = 1500), 1);
SELECT _oczekuj_wyjatek('zmyślony token nie wypisuje nikogo',
  'SELECT wypisz_wpis_goscia(''dddddddd-0000-4000-8000-00000000dead''::uuid)');
SELECT _oczekuj('wypisanie przez własny token zwraca mecz',
                (SELECT count(*) FROM (
                   SELECT wypisz_wpis_goscia(:'token_goscia'::uuid)) s), 1);
SELECT _oczekuj('po wypisaniu gościa nie ma już w składzie',
                (SELECT count(*) FROM event_participants
                  WHERE event_id = :MECZ::uuid AND is_guest), 0);
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Turniej — ściana logowania i uprawnienia (migracja 145)
--
-- PO CO OSOBNE DANE. Sekcje wyżej dzielą jeden mecz i cztery tożsamości;
-- turniej ma inny kształt relacji (organizator/współorganizator/prowadzący/
-- kapitan/zawodnik, nie organizator/uczestnik), więc dostaje własny fixture.
-- `:OBCY` jest reużyty z fixture'u meczowego — rola „ktoś z zewnątrz, zero
-- związku z danymi" jest identyczna w obu kontekstach.
-- ---------------------------------------------------------------------------
\set T_ORGANIZATOR '''eeeeeeee-0000-4000-8000-000000000001'''
\set T_KAPITAN1     '''eeeeeeee-0000-4000-8000-000000000002'''
\set T_KAPITAN2     '''eeeeeeee-0000-4000-8000-000000000003'''
\set T_PROWADZACY   '''eeeeeeee-0000-4000-8000-000000000004'''
\set TURNIEJ           '''ffffffff-0000-4000-8000-000000000001'''
\set TURNIEJ_ZAMKNIETY '''ffffffff-0000-4000-8000-000000000002'''
\set T_DRUZYNA1        '''ffffffff-0000-4000-8000-000000000003'''
\set T_DRUZYNA2        '''ffffffff-0000-4000-8000-000000000004'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:T_ORGANIZATOR::uuid, 'rls-turniej-organizator@example.com', now(), '{"display_name":"Tola Turniejowa"}'::jsonb),
  (:T_KAPITAN1::uuid,    'rls-turniej-kapitan1@example.com',    now(), '{"display_name":"Karol Kapitan"}'::jsonb),
  (:T_KAPITAN2::uuid,    'rls-turniej-kapitan2@example.com',    now(), '{"display_name":"Kasia Kapitanka"}'::jsonb),
  (:T_PROWADZACY::uuid,  'rls-turniej-prowadzacy@example.com',  now(), '{"display_name":"Piotr Prowadzący"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO turnieje (id, organizator_id, nazwa, sport, status, data_startu) VALUES
  (:TURNIEJ::uuid, :T_ORGANIZATOR::uuid, 'Turniej do testów RLS', 'piłka nożna', 'zapisy', CURRENT_DATE + 10),
  (:TURNIEJ_ZAMKNIETY::uuid, :T_ORGANIZATOR::uuid, 'Turniej zamknięty do testów RLS', 'piłka nożna', 'trwa', CURRENT_DATE - 1);

INSERT INTO turniej_druzyny (id, turniej_id, nazwa, kapitan_id, status, kontakt_telefon, kontakt_email) VALUES
  (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, 'Drużyna Jeden', :T_KAPITAN1::uuid, 'zgloszona', '500100200', 'kapitan1@example.com'),
  (:T_DRUZYNA2::uuid, :TURNIEJ::uuid, 'Drużyna Dwa',   :T_KAPITAN2::uuid, 'zgloszona', '500300400', 'kapitan2@example.com');

-- Drużyna 1 ma kapitana i DWA wolne wpisy składu bez `user_id` — dopisane
-- przez kapitana z samego imienia, czekające na „to ja" kogoś z linku.
INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie, kapitan) VALUES
  (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, :T_KAPITAN1::uuid, 'Karol Kapitan', true),
  (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, NULL, 'Wolny Wpis Jeden', false),
  (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, NULL, 'Wolny Wpis Dwa', false);
INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie, kapitan) VALUES
  (:T_DRUZYNA2::uuid, :TURNIEJ::uuid, :T_KAPITAN2::uuid, 'Kasia Kapitanka', true);

SELECT id AS wolny_wpis_1 FROM turniej_zawodnicy
 WHERE druzyna_id = :T_DRUZYNA1::uuid AND imie = 'Wolny Wpis Jeden' \gset
SELECT id AS wolny_wpis_2 FROM turniej_zawodnicy
 WHERE druzyna_id = :T_DRUZYNA1::uuid AND imie = 'Wolny Wpis Dwa' \gset

SELECT _sekcja('Turniej: niezalogowany (migracja 145)');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany czyta turnieje (obie edycje)',
                (SELECT count(*) FROM turnieje WHERE id IN (:TURNIEJ::uuid, :TURNIEJ_ZAMKNIETY::uuid)), 2);
SELECT _oczekuj('niezalogowany czyta listę drużyn (same nazwy)',
                (SELECT count(*) FROM turniej_druzyny WHERE turniej_id = :TURNIEJ::uuid), 2);
SELECT _oczekuj('ŚCIANA LOGOWANIA: niezalogowany NIE widzi składu',
                (SELECT count(*) FROM turniej_zawodnicy WHERE turniej_id = :TURNIEJ::uuid), 0);
SELECT _oczekuj('niezalogowany nie widzi listy uprawnionych osób',
                (SELECT count(*) FROM turniej_osoby WHERE turniej_id = :TURNIEJ::uuid), 0);
SELECT _oczekuj_odmowe('niezalogowany nie przeczyta telefonu kapitana (kolumna odebrana grantem)',
  format('SELECT kontakt_telefon FROM turniej_druzyny WHERE id = %L', :T_DRUZYNA1));
RESET ROLE;

SELECT _sekcja('Turniej: obcy zalogowany, zero związku z turniejem (migracja 145)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('ŚCIANA LOGOWANIA otwiera się każdemu zalogowanemu: obcy widzi cały skład',
                (SELECT count(*) FROM turniej_zawodnicy WHERE turniej_id = :TURNIEJ::uuid), 4);
SELECT _oczekuj_odmowe('obcy zalogowany też nie przeczyta telefonu kapitana',
  format('SELECT kontakt_telefon FROM turniej_druzyny WHERE id = %L', :T_DRUZYNA1));
SELECT _oczekuj_odmowe('obcy nie dopisze zawodnika do cudzej drużyny', format(
  'INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie) VALUES (%L, %L, %L)',
  :T_DRUZYNA1, :TURNIEJ, 'Wcinam się'));
SELECT _oczekuj_odmowe('obcy nie zgłosi drużyny do turnieju z zamkniętymi zapisami', format(
  'INSERT INTO turniej_druzyny (turniej_id, nazwa, kapitan_id) VALUES (%L, %L, %L)',
  :TURNIEJ_ZAMKNIETY, 'Spóźnialscy', :OBCY));

-- NIE `_oczekuj_odmowe`: obcy nie jest właścicielem wiersza, więc USING
-- polityki „Druzyne edytuje kapitan" filtruje go do ZERA dopasowanych wierszy
-- — Postgres kończy to jako zwykłe „UPDATE 0", bez wyjątku (to nie jest
-- naruszenie WITH CHECK na nowym wierszu, tylko brak widoczności wiersza
-- istniejącego). Sprawdzamy więc wprost skutek, nie wyjątek.
UPDATE turniej_druzyny SET status = 'przyjeta' WHERE id = :T_DRUZYNA1::uuid;
RESET ROLE;
SELECT _oczekuj('obcy nie przyjął cudzej drużyny — status bez zmian',
                (SELECT count(*) FROM turniej_druzyny
                  WHERE id = :T_DRUZYNA1::uuid AND status = 'zgloszona'), 1);

SELECT _sekcja('Turniej: kapitan drużyny zarządza WŁASNYM składem (migracja 145)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie) VALUES (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, 'Nowy Zawodnik');
RESET ROLE;
SELECT _oczekuj('kapitan dopisał zawodnika do WŁASNEJ drużyny',
                (SELECT count(*) FROM turniej_zawodnicy
                  WHERE druzyna_id = :T_DRUZYNA1::uuid AND imie = 'Nowy Zawodnik'), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
SELECT _oczekuj_odmowe('kapitan D1 nie dopisze zawodnika do CUDZEJ drużyny (D2)', format(
  'INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, imie) VALUES (%L, %L, %L)',
  :T_DRUZYNA2, :TURNIEJ, 'Podrzutek'));
RESET ROLE;

-- Zamknięcie dziury: polityka „Druzyne edytuje kapitan" (RLS, wiersz)
-- pozwala kapitanowi zmienić DOWOLNĄ kolumnę własnej drużyny — w tym
-- `status`. Wyzwalacz `pilnuj_wlasnej_druzyny` (145) ma to zablokować:
-- zapis PRZECHODZI (żadnego wyjątku), ale `status` wraca do poprzedniej
-- wartości. Ta sama klasa błędu, którą migracja `132` naprawiała
-- w `event_participants` — „uczestnik zmienia DEKLARACJĘ, nie MIEJSCE".
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
UPDATE turniej_druzyny SET status = 'przyjeta' WHERE id = :T_DRUZYNA1::uuid;
RESET ROLE;
SELECT _oczekuj('ZAMKNIĘTE: kapitan NIE może sam przyjąć swojej drużyny (trigger pilnuj_wlasnej_druzyny)',
                (SELECT count(*) FROM turniej_druzyny
                  WHERE id = :T_DRUZYNA1::uuid AND status = 'zgloszona'), 1);

SELECT _sekcja('Turniej: organizator i prowadzący bez pełnych uprawnień (migracja 145)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT _oczekuj('organizator czyta kontakty obu drużyn przez turniej_kontakty()',
                (SELECT count(*) FROM turniej_kontakty(:TURNIEJ::uuid)), 2);
INSERT INTO turniej_osoby (turniej_id, user_id) VALUES (:TURNIEJ::uuid, :T_PROWADZACY::uuid);
RESET ROLE;
SELECT _oczekuj('organizator nadał uprawnienie prowadzącemu (domyślnie moze_prowadzic)',
                (SELECT count(*) FROM turniej_osoby
                  WHERE turniej_id = :TURNIEJ::uuid AND user_id = :T_PROWADZACY::uuid
                    AND moze_prowadzic AND NOT moze_edytowac AND NOT moze_zarzadzac_druzynami), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
SELECT _oczekuj('prowadzący BEZ moze_edytowac nie widzi kontaktów kapitanów',
                (SELECT count(*) FROM turniej_kontakty(:TURNIEJ::uuid)), 0);
SELECT _oczekuj_odmowe('prowadzący nie nada uprawnień komuś innemu', format(
  'INSERT INTO turniej_osoby (turniej_id, user_id, moze_edytowac) VALUES (%L, %L, true)',
  :TURNIEJ, :OBCY));
RESET ROLE;

SELECT _sekcja('Turniej: przypisanie się do wolnego wpisu składu (migracja 145)');

-- NA KOŃCU SEKCJI ŚWIADOMIE: mutuje skład i kończy wyjątkiem, tak samo jak
-- „Gość zarządza swoim zapisem" niżej kończy plik.
--
-- Uprawnieniem jest fakt, że wiersz jest WOLNY (`user_id IS NULL") — to jest
-- ścieżka „to ja" z `/t/[kod]`. Podwójne przypisanie tej samej osoby w tym
-- samym turnieju NIE jest już kwestią RLS: zamyka je indeks unikalny
-- `idx_zawodnik_raz_w_turnieju` (145), niezależnie od tego, którą z dwóch
-- dróg (ta polityka albo RPC `dolacz_do_druzyny_kodem`) ktoś spróbuje wejść.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
UPDATE turniej_zawodnicy SET user_id = :OBCY::uuid WHERE id = :'wolny_wpis_1'::uuid AND user_id IS NULL;
RESET ROLE;
SELECT _oczekuj('obcy przypisał się do wolnego wpisu składu',
                (SELECT count(*) FROM turniej_zawodnicy
                  WHERE id = :'wolny_wpis_1'::uuid AND user_id = :OBCY::uuid), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_wyjatek('ta sama osoba nie zajmie DRUGIEGO wolnego wpisu w tym samym turnieju', format(
  'UPDATE turniej_zawodnicy SET user_id = %L WHERE id = %L AND user_id IS NULL',
  :OBCY, :'wolny_wpis_2'));
RESET ROLE;
SELECT _oczekuj('drugi wolny wpis zostaje faktycznie wolny',
                (SELECT count(*) FROM turniej_zawodnicy
                  WHERE id = :'wolny_wpis_2'::uuid AND user_id IS NULL), 1);

SELECT _sekcja('Turniej: imienne zaproszenia do drużyny (migracja 154)');

-- Najważniejsza asercja tej sekcji to ta o ORGANIZATORZE. Decyzja właściciela
-- z 2026-09-20 brzmi: organizator turnieju NIE widzi i NIE tyka zaproszeń
-- w cudzych drużynach. Gdyby polityka użyła `czy_kapitan_druzyny()` (145) —
-- czyli funkcji o niemal identycznej nazwie, która celowo przepuszcza także
-- zarządzających turniejem — nic by się nie wywróciło i nikt by tego nie
-- zauważył. Dlatego stoi tu jawny test, a nie tylko komentarz w migracji.

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
INSERT INTO turniej_zaproszenia (druzyna_id, turniej_id, user_id, zaprosil_id)
  VALUES (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, :OBCY::uuid, :T_KAPITAN1::uuid);
RESET ROLE;
SELECT _oczekuj('kapitan zaprosił kogoś do WŁASNEJ drużyny',
                (SELECT count(*) FROM turniej_zaproszenia
                  WHERE druzyna_id = :T_DRUZYNA1::uuid AND user_id = :OBCY::uuid), 1);
SELECT _oczekuj('wyzwalacz dopełnił turniej_id z drużyny, nie z tego, co przysłał klient',
                (SELECT count(*) FROM turniej_zaproszenia
                  WHERE druzyna_id = :T_DRUZYNA1::uuid AND turniej_id = :TURNIEJ::uuid), 1);
SELECT _oczekuj('zaproszony dostał powiadomienie',
                (SELECT count(*) FROM notifications
                  WHERE user_id = :OBCY::uuid AND type = 'turniej_zaproszenie_do_druzyny'), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN2, false);
SELECT _oczekuj_odmowe('kapitan D2 nie zaprosi nikogo do CUDZEJ drużyny (D1)', format(
  'INSERT INTO turniej_zaproszenia (druzyna_id, turniej_id, user_id) VALUES (%L, %L, %L)',
  :T_DRUZYNA1, :TURNIEJ, :T_PROWADZACY));
SELECT _oczekuj('kapitan D2 nie widzi zaproszeń drużyny D1',
                (SELECT count(*) FROM turniej_zaproszenia WHERE druzyna_id = :T_DRUZYNA1::uuid), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT _oczekuj('ORGANIZATOR TURNIEJU NIE WIDZI zaproszeń w cudzej drużynie (decyzja 2026-09-20)',
                (SELECT count(*) FROM turniej_zaproszenia WHERE turniej_id = :TURNIEJ::uuid), 0);
SELECT _oczekuj_odmowe('organizator nie zaprosi nikogo do cudzej drużyny', format(
  'INSERT INTO turniej_zaproszenia (druzyna_id, turniej_id, user_id) VALUES (%L, %L, %L)',
  :T_DRUZYNA1, :TURNIEJ, :T_PROWADZACY));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('zaproszony widzi SWOJE zaproszenie',
                (SELECT count(*) FROM turniej_zaproszenia WHERE user_id = :OBCY::uuid), 1);
UPDATE turniej_zaproszenia SET dismissed_at = now() WHERE user_id = :OBCY::uuid;
RESET ROLE;
SELECT _oczekuj('zaproszony schował swoje zaproszenie',
                (SELECT count(*) FROM turniej_zaproszenia
                  WHERE user_id = :OBCY::uuid AND dismissed_at IS NOT NULL), 1);

-- Zaproszenie gaśnie samo, gdy człowiek realnie wejdzie do drużyny — inaczej
-- karta „X zaprasza Cię do drużyny" wisiałaby na stronie głównej komuś, kto
-- w tej drużynie już gra.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
INSERT INTO turniej_zaproszenia (druzyna_id, turniej_id, user_id, zaprosil_id)
  VALUES (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, :T_PROWADZACY::uuid, :T_KAPITAN1::uuid);
RESET ROLE;
INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie)
  VALUES (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, :T_PROWADZACY::uuid, 'Piotr Prowadzący');
SELECT _oczekuj('wejście do drużyny zgasiło zaproszenie',
                (SELECT count(*) FROM turniej_zaproszenia
                  WHERE user_id = :T_PROWADZACY::uuid AND dismissed_at IS NULL), 0);

-- ---------------------------------------------------------------------------
-- Fixture: terminarz (grupy, areny, mecze) — migracja 146.
-- Reużywa TURNIEJ/T_DRUZYNA1/T_DRUZYNA2/T_ORGANIZATOR/T_PROWADZACY z sekcji
-- wyżej. Nowa tożsamość T_SEDZIA sprawdza trzecią, najwęższą drogę do
-- prowadzenia meczu: `prowadzacy_id` wpisany na JEDNYM meczu, bez żadnego
-- uprawnienia w `turniej_osoby`.
-- ---------------------------------------------------------------------------
\set T_SEDZIA '''eeeeeeee-0000-4000-8000-000000000005'''
\set T_GRUPA  '''ffffffff-0000-4000-8000-000000000005'''
\set T_MECZ1  '''ffffffff-0000-4000-8000-000000000006'''

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  (:T_SEDZIA::uuid, 'rls-turniej-sedzia@example.com', now(), '{"display_name":"Sylwia Sędzia"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

SELECT _sekcja('Turniej: grupy i areny — czyta kazdy, zarzadza organizator (migracja 146)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
INSERT INTO turniej_grupy (id, turniej_id, nazwa) VALUES (:T_GRUPA::uuid, :TURNIEJ::uuid, 'A');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie dopisze grupy do cudzego turnieju', format(
  'INSERT INTO turniej_grupy (turniej_id, nazwa) VALUES (%L, %L)', :TURNIEJ, 'B'));
RESET ROLE;

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany czyta grupy turnieju',
                (SELECT count(*) FROM turniej_grupy WHERE turniej_id = :TURNIEJ::uuid), 1);
-- Wyzwalacz `utworz_domyslna_arene` (146) odpalił się przy INSERCIE turnieju
-- w sekcji 145, a więc zanim ta migracja w ogóle istniała jako plik — to
-- migracje „od zera" w jednym przebiegu sprawiają, że fixture wyżej już
-- korzysta z reguł tej migracji.
SELECT _oczekuj('każdy nowy turniej dostał domyślną arenę „Boisko 1"',
                (SELECT count(*) FROM turniej_areny
                  WHERE turniej_id = :TURNIEJ::uuid AND nazwa = 'Boisko 1'), 1);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie dopisze areny do cudzego turnieju', format(
  'INSERT INTO turniej_areny (turniej_id, nazwa) VALUES (%L, %L)', :TURNIEJ, 'Boisko 2'));
DELETE FROM turniej_areny WHERE turniej_id = :TURNIEJ::uuid;
RESET ROLE;
SELECT _oczekuj('obcy nie skasował domyślnej areny — USING filtruje do zera wierszy',
                (SELECT count(*) FROM turniej_areny WHERE turniej_id = :TURNIEJ::uuid), 1);

SELECT _sekcja('Turniej: kto prowadzi mecz (migracja 146)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
INSERT INTO turniej_mecze (id, turniej_id, numer, grupa_id, druzyna_a_id, druzyna_b_id)
VALUES (:T_MECZ1::uuid, :TURNIEJ::uuid, 1, :T_GRUPA::uuid, :T_DRUZYNA1::uuid, :T_DRUZYNA2::uuid);
RESET ROLE;
SELECT _oczekuj('organizator wstawił mecz fazy grupowej',
                (SELECT count(*) FROM turniej_mecze WHERE id = :T_MECZ1::uuid), 1);

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany czyta terminarz',
                (SELECT count(*) FROM turniej_mecze WHERE turniej_id = :TURNIEJ::uuid), 1);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie wstawi meczu do cudzego turnieju', format(
  'INSERT INTO turniej_mecze (turniej_id, numer) VALUES (%L, 99)', :TURNIEJ));
UPDATE turniej_mecze SET status = 'trwa' WHERE id = :T_MECZ1::uuid;
DELETE FROM turniej_mecze WHERE id = :T_MECZ1::uuid;
RESET ROLE;
SELECT _oczekuj('obcy nie prowadzi ani nie kasuje cudzego meczu — bez zmian',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ1::uuid AND status = 'zaplanowany'), 1);

-- Prowadzący ogólny (moze_prowadzic z sekcji 145, bez moze_edytowac) prowadzi
-- KAŻDY mecz turnieju — to jest różnica wobec T_SEDZIA niżej.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
UPDATE turniej_mecze SET status = 'trwa', rozpoczety_at = now() WHERE id = :T_MECZ1::uuid;
RESET ROLE;
SELECT _oczekuj('prowadzący ogólny (moze_prowadzic) rozpoczął mecz',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ1::uuid AND status = 'trwa'), 1);

-- Organizator oddaje TEN JEDEN mecz sędziemu bez żadnego uprawnienia w
-- turniej_osoby — najwęższa droga z nagłówka §4 migracji 146.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
UPDATE turniej_mecze SET prowadzacy_id = :T_SEDZIA::uuid WHERE id = :T_MECZ1::uuid;
RESET ROLE;

-- NIE `_oczekuj_odmowe`: to znów USING filtrujące do zera wierszy, nie
-- naruszenie WITH CHECK — ten sam wzorzec, co „obcy nie przyjął cudzej
-- drużyny" w sekcji 145 wyżej.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
UPDATE turniej_mecze SET status = 'zakonczony' WHERE id = :T_MECZ1::uuid;
RESET ROLE;
SELECT _oczekuj('obcy nadal nie prowadzi meczu, mimo że ma już prowadzacy_id — bez zmian',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ1::uuid AND status = 'trwa'), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_SEDZIA, false);
UPDATE turniej_mecze SET status = 'zakonczony', wynik_a = 3, wynik_b = 1,
       zwyciezca_id = :T_DRUZYNA1::uuid, zakonczony_at = now()
 WHERE id = :T_MECZ1::uuid;
RESET ROLE;
SELECT _oczekuj('sędzia przypisany DO TEGO JEDNEGO meczu zakończył go',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ1::uuid AND status = 'zakonczony'
                    AND zwyciezca_id = :T_DRUZYNA1::uuid), 1);

SELECT _sekcja('Turniej: zapisz_terminarz i propagacja zwycięzcy w drabince (migracja 146)');

-- Osobny, samodzielny turniej pucharowy: trzy drużyny, czyli jeden wolny los
-- w pierwszej rundzie. Sprawdza dokładnie ten mechanizm, który dwukrotna
-- ręczna weryfikacja tej migracji złapała jako błąd: wolny los ma dać
-- drużynie miejsce w finale BEZ czyjegokolwiek dodatkowego kliknięcia.
\set TD_TURNIEJ  '''ffffffff-0000-4000-8000-00000000000e'''
\set TD_A        '''ffffffff-0000-4000-8000-00000000000f'''
\set TD_B        '''ffffffff-0000-4000-8000-000000000010'''
\set TD_C        '''ffffffff-0000-4000-8000-000000000011'''
\set TD_POLFINAL '''ffffffff-0000-4000-8000-000000000012'''
\set TD_BYE      '''ffffffff-0000-4000-8000-000000000013'''
\set TD_FINAL    '''ffffffff-0000-4000-8000-000000000014'''

INSERT INTO turnieje (id, organizator_id, nazwa, sport, format, status, data_startu)
VALUES (:TD_TURNIEJ::uuid, :T_ORGANIZATOR::uuid, 'Turniej drabinkowy do testów RLS', 'piłka nożna', 'puchar', 'zapisy', CURRENT_DATE + 10);
INSERT INTO turniej_druzyny (id, turniej_id, nazwa, status) VALUES
  (:TD_A::uuid, :TD_TURNIEJ::uuid, 'Drabinka A', 'przyjeta'),
  (:TD_B::uuid, :TD_TURNIEJ::uuid, 'Drabinka B', 'przyjeta'),
  (:TD_C::uuid, :TD_TURNIEJ::uuid, 'Drabinka C', 'przyjeta');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_wyjatek('obcy nie zapisze terminarza cudzego turnieju', format(
  'SELECT zapisz_terminarz(%L::uuid, %L::jsonb)', :TD_TURNIEJ, '[]'));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT zapisz_terminarz(:TD_TURNIEJ::uuid, jsonb_build_array(
  jsonb_build_object('id', :TD_POLFINAL, 'numer', 1, 'faza', 'polfinal',
    'druzynaAId', :TD_A, 'druzynaBId', :TD_B, 'status', 'zaplanowany',
    'zaplanowanyAt', (now() + interval '1 hour')::text),
  jsonb_build_object('id', :TD_BYE, 'numer', 2, 'faza', 'polfinal',
    'druzynaAId', :TD_C, 'status', 'walkower',
    'zwyciezcaId', :TD_C, 'walkowerDla', :TD_C,
    'zaplanowanyAt', (now() + interval '1 hour')::text),
  jsonb_build_object('id', :TD_FINAL, 'numer', 3, 'faza', 'final',
    'zrodloAMeczId', :TD_POLFINAL, 'zrodloATyp', 'zwyciezca',
    'zrodloBMeczId', :TD_BYE, 'zrodloBTyp', 'zwyciezca', 'status', 'zaplanowany',
    'zaplanowanyAt', (now() + interval '3 hours')::text)
));
RESET ROLE;
SELECT _oczekuj('WOLNY LOS: finał od razu poznał drużynę z meczu-widmo',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :TD_FINAL::uuid AND druzyna_b_id = :TD_C::uuid), 1);
SELECT _oczekuj('finał jeszcze nie zna zwycięzcy półfinału (ten dopiero się odbędzie)',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :TD_FINAL::uuid AND druzyna_a_id IS NULL), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
UPDATE turniej_mecze SET status = 'zakonczony', wynik_a = 2, wynik_b = 0, zwyciezca_id = :TD_A::uuid
 WHERE id = :TD_POLFINAL::uuid;
RESET ROLE;
SELECT _oczekuj('PROPAGACJA: zwycięzca półfinału wskoczył do finału przez wyzwalacz',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :TD_FINAL::uuid AND druzyna_a_id = :TD_A::uuid), 1);

-- `zapisz_terminarz` nie wolno nadpisać, gdy jakikolwiek mecz już wyszedł
-- poza `zaplanowany` — inaczej „wygeneruj ponownie" skasowałoby wynik.
-- Sprawdzamy to jako organizator (ma pełne uprawnienia) — inaczej test
-- niczego by nie dowodził o TEJ konkretnej blokadzie, tylko znów o RLS.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT _oczekuj_wyjatek('nie da się nadpisać terminarza z rozegranym meczem', format(
  'SELECT zapisz_terminarz(%L::uuid, %L::jsonb)', :TD_TURNIEJ, '[]'));
RESET ROLE;
SELECT _oczekuj('terminarz z rozegranym meczem NIE został nadpisany — 3 mecze zostają',
                (SELECT count(*) FROM turniej_mecze WHERE turniej_id = :TD_TURNIEJ::uuid), 3);

SELECT _sekcja('Turniej: przesun_terminarz (migracja 146)');

SELECT zaplanowany_at AS td_final_przed FROM turniej_mecze WHERE id = :TD_FINAL::uuid \gset

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_wyjatek('obcy nie przesunie terminarza cudzego turnieju', format(
  'SELECT przesun_terminarz(%L::uuid, %L::uuid, 15)', :TD_TURNIEJ, :TD_FINAL));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT przesun_terminarz(:TD_TURNIEJ::uuid, :TD_FINAL::uuid, 20);
RESET ROLE;
SELECT _oczekuj('finał (jedyny wciąż zaplanowany mecz) przesunięty dokładnie o 20 minut',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :TD_FINAL::uuid
                    AND zaplanowany_at = :'td_final_przed'::timestamptz + interval '20 minutes'), 1);
SELECT _oczekuj('rozegrany półfinał NIE ruszony przesunięciem — dotyczy tylko `zaplanowany`',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :TD_POLFINAL::uuid AND status = 'zakonczony'
                    AND zaplanowany_at = :'td_final_przed'::timestamptz - interval '2 hours'), 1);

-- Osobno: mecz bez ustalonej godziny nie ma OD CZEGO liczyć przesunięcia —
-- odróżnione (146) od „nie znaleziono meczu", bo oba przypadki dają wcześniej
-- to samo `v_od IS NULL`, a to dwa różne komunikaty dla organizatora.
\set TD_BEZ_GODZINY '''ffffffff-0000-4000-8000-000000000015'''
INSERT INTO turniej_mecze (id, turniej_id, numer, faza)
VALUES (:TD_BEZ_GODZINY::uuid, :TD_TURNIEJ::uuid, 4, 'final');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
SELECT _oczekuj_wyjatek('mecz bez ustalonej godziny — nie da się liczyć przesunięcia od niego', format(
  'SELECT przesun_terminarz(%L::uuid, %L::uuid, 15)', :TD_TURNIEJ, :TD_BEZ_GODZINY));
RESET ROLE;

-- ---------------------------------------------------------------------------
-- Fixture: rozgrywka na żywo (zdarzenia, zakończenie meczu) — migracja 147.
-- T_MECZ1 z sekcji 146 jest już `zakonczony` — nowy mecz T_MECZ2 w TURNIEJU,
-- faza `final`, żeby przetestować regułę „remis w drabince wymaga karnych".
-- ---------------------------------------------------------------------------
\set T_MECZ2 '''ffffffff-0000-4000-8000-000000000016'''

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
INSERT INTO turniej_mecze (id, turniej_id, numer, faza, druzyna_a_id, druzyna_b_id, status)
VALUES (:T_MECZ2::uuid, :TURNIEJ::uuid, 2, 'final', :T_DRUZYNA1::uuid, :T_DRUZYNA2::uuid, 'trwa');
RESET ROLE;

SELECT _sekcja('Turniej: zdarzenia meczowe (migracja 147)');

SET ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', false);
SELECT _oczekuj('niezalogowany czyta zdarzenia (na razie zero)',
                (SELECT count(*) FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid), 0);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie dopisze zdarzenia do cudzego meczu', format(
  'INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (%L, %L, %L)',
  :T_MECZ2, :T_DRUZYNA1, 'gol'));
RESET ROLE;

-- Prowadzący ogólny (moze_prowadzic z sekcji 145) dopisuje gola i samobójczego.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (:T_MECZ2::uuid, :T_DRUZYNA1::uuid, 'gol');
INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (:T_MECZ2::uuid, :T_DRUZYNA1::uuid, 'samobojczy');
RESET ROLE;
SELECT _oczekuj('SAMOBÓJCZY DOLICZA SIĘ PRZECIWNIKOWI: 1:1 po golu i samobójczym drużyny 1',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ2::uuid AND wynik_a = 1 AND wynik_b = 1), 1);

-- T_SEDZIA jest prowadzącym TYLKO meczu T_MECZ1 (146) — na T_MECZ2 nie ma żadnych uprawnień.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_SEDZIA, false);
SELECT _oczekuj_odmowe('sędzia przypisany do INNEGO meczu nie dopisze zdarzenia tutaj', format(
  'INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (%L, %L, %L)',
  :T_MECZ2, :T_DRUZYNA2, 'gol'));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
DELETE FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid AND typ = 'samobojczy';
RESET ROLE;
SELECT _oczekuj('obcy nie cofnął zdarzenia — bez zmian',
                (SELECT count(*) FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid AND typ = 'samobojczy'), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
DELETE FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid AND typ = 'samobojczy';
RESET ROLE;
SELECT _oczekuj('COFNIJ OSTATNIE: po skasowaniu samobójczego wynik wraca do 1:0',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ2::uuid AND wynik_a = 1 AND wynik_b = 0), 1);

SELECT _sekcja('Turniej: zakoncz_mecz (migracja 147)');

-- Wyrównujemy na 1:1, żeby przetestować regułę „remis w fazie pucharowej
-- wymaga karnych" (T_MECZ2 ma fazę 'final').
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (:T_MECZ2::uuid, :T_DRUZYNA2::uuid, 'gol');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_wyjatek('obcy nie zakończy cudzego meczu', format(
  'SELECT zakoncz_mecz(%L::uuid)', :T_MECZ2));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
SELECT _oczekuj_wyjatek('remis w finale bez karnych nie kończy meczu', format(
  'SELECT zakoncz_mecz(%L::uuid)', :T_MECZ2));
SELECT zakoncz_mecz(:T_MECZ2::uuid, 4, 2);
RESET ROLE;
SELECT _oczekuj('remis w finale rozstrzygnięty karnymi — zwycięzca drużyna 1',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ2::uuid AND status = 'zakonczony'
                    AND zwyciezca_id = :T_DRUZYNA1::uuid AND karne_a = 4 AND karne_b = 2), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
SELECT _oczekuj_odmowe('nie da się dopisać zdarzenia do już zakończonego meczu', format(
  'INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES (%L, %L, %L)',
  :T_MECZ2, :T_DRUZYNA1, 'gol'));
DELETE FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid;
SELECT _oczekuj_wyjatek('nie da się zakończyć już zakończonego meczu drugi raz', format(
  'SELECT zakoncz_mecz(%L::uuid)', :T_MECZ2));
RESET ROLE;
SELECT _oczekuj('nie da się cofnąć zdarzenia z już zakończonego meczu — bez zmian',
                (SELECT count(*) FROM turniej_zdarzenia WHERE mecz_id = :T_MECZ2::uuid), 2);

-- Remis dozwolony w lidze/grupie — żaden istniejący mecz w tym pliku nie ma
-- jeszcze fazy 'grupa'/'liga', stąd osobny mikro-fixture.
\set T_MECZ_LIGA '''ffffffff-0000-4000-8000-000000000017'''
INSERT INTO turniej_mecze (id, turniej_id, numer, faza, druzyna_a_id, druzyna_b_id, status)
VALUES (:T_MECZ_LIGA::uuid, :TURNIEJ::uuid, 3, 'liga', :T_DRUZYNA1::uuid, :T_DRUZYNA2::uuid, 'trwa');
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
INSERT INTO turniej_zdarzenia (mecz_id, druzyna_id, typ) VALUES
  (:T_MECZ_LIGA::uuid, :T_DRUZYNA1::uuid, 'gol'),
  (:T_MECZ_LIGA::uuid, :T_DRUZYNA2::uuid, 'gol');
SELECT zakoncz_mecz(:T_MECZ_LIGA::uuid);
RESET ROLE;
SELECT _oczekuj('remis w lidze dozwolony BEZ karnych — zwycięzca NULL',
                (SELECT count(*) FROM turniej_mecze
                  WHERE id = :T_MECZ_LIGA::uuid AND status = 'zakonczony' AND zwyciezca_id IS NULL), 1);

SELECT _sekcja('Turniej: ogłoszenia (migracja 150)');

-- Obie drużyny dostają status 'przyjeta' PRZEZ ORGANIZATORA — sekcja 145
-- sprawdziła już, że kapitan i obcy nie mogą zrobić tego sami (trigger
-- `pilnuj_wlasnej_druzyny`). Ten sam trigger odpala się też na UPDATE-ie
-- wykonanym jako ambientny superuser (bo sprawdza `czy_zarzadza_turniejem`,
-- nie rolę Postgresa), więc bez impersonacji organizatora status wróciłby
-- do 'zgloszona' po cichu — a to potrzebny jest stan „przyjęta", żeby
-- powiadomienie o ogłoszeniu miało kogo trafić.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
UPDATE turniej_druzyny SET status = 'przyjeta' WHERE id IN (:T_DRUZYNA1::uuid, :T_DRUZYNA2::uuid);
RESET ROLE;
SELECT _oczekuj('obie drużyny przyjęte przez organizatora, przygotowanie do sekcji ogłoszeń',
                (SELECT count(*) FROM turniej_druzyny
                  WHERE id IN (:T_DRUZYNA1::uuid, :T_DRUZYNA2::uuid) AND status = 'przyjeta'), 2);

\set T_OGLOSZENIE '''ffffffff-0000-4000-8000-000000000018'''

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
INSERT INTO turniej_ogloszenia (id, turniej_id, autor_id, tresc)
VALUES (:T_OGLOSZENIE::uuid, :TURNIEJ::uuid, :T_ORGANIZATOR::uuid, 'Start opóźniony 15 minut.');
RESET ROLE;

SELECT _oczekuj('powiadomienie o ogłoszeniu trafiło do OBU kapitanów z kontem',
                (SELECT count(*) FROM notifications
                  WHERE turniej_id = :TURNIEJ::uuid AND type = 'turniej_ogloszenie'
                    AND user_id IN (:T_KAPITAN1::uuid, :T_KAPITAN2::uuid)), 2);

SET ROLE anon;
SELECT _oczekuj('ogłoszenie czyta niezalogowany — publiczne, jak terminarz',
                (SELECT count(*) FROM turniej_ogloszenia WHERE turniej_id = :TURNIEJ::uuid), 1);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_odmowe('obcy nie napisze ogłoszenia w cudzym turnieju', format(
  'INSERT INTO turniej_ogloszenia (turniej_id, autor_id, tresc) VALUES (%L, %L, %L)',
  :TURNIEJ, :OBCY, 'Wcinam się'));
RESET ROLE;

-- Prowadzący ma `moze_prowadzic`, ale NIE `moze_edytowac` — ogłoszenie to
-- narzędzie zarządzającego turniejem, nie każdego z jakimkolwiek uprawnieniem.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_PROWADZACY, false);
SELECT _oczekuj_odmowe('prowadzący bez moze_edytowac nie napisze ogłoszenia', format(
  'INSERT INTO turniej_ogloszenia (turniej_id, autor_id, tresc) VALUES (%L, %L, %L)',
  :TURNIEJ, :T_PROWADZACY, 'Ja też chcę'));
DELETE FROM turniej_ogloszenia WHERE id = :T_OGLOSZENIE::uuid;
RESET ROLE;
SELECT _oczekuj('prowadzący nie skasował ogłoszenia organizatora — USING filtruje do zera',
                (SELECT count(*) FROM turniej_ogloszenia WHERE id = :T_OGLOSZENIE::uuid), 1);

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
DELETE FROM turniej_ogloszenia WHERE id = :T_OGLOSZENIE::uuid;
RESET ROLE;
SELECT _oczekuj('organizator kasuje własne ogłoszenie',
                (SELECT count(*) FROM turniej_ogloszenia WHERE id = :T_OGLOSZENIE::uuid), 0);

SELECT _sekcja('Turniej: BLIK organizatora (migracja 150)');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_ORGANIZATOR, false);
INSERT INTO turniej_blik (turniej_id, blik_telefon) VALUES (:TURNIEJ::uuid, '500600700');
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
SELECT _oczekuj('kapitan drużyny w turnieju widzi numer BLIK organizatora',
                (SELECT count(*) FROM turniej_blik
                  WHERE turniej_id = :TURNIEJ::uuid AND blik_telefon = '500600700'), 1);
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj('obcy nie widzi numeru BLIK — nie jest ani kapitanem, ani organizatorem',
                (SELECT count(*) FROM turniej_blik WHERE turniej_id = :TURNIEJ::uuid), 0);
-- NIE `_oczekuj_odmowe`: obcy nie jest zarządzającym, więc USING polityki
-- „Blik turnieju pisze zarzadzajacy" filtruje go do ZERA dopasowanych
-- wierszy — Postgres kończy to jako zwykłe „UPDATE 0", bez wyjątku (ta sama
-- pułapka co przy „obcy nie przyjął cudzej drużyny" w sekcji 145).
UPDATE turniej_blik SET blik_telefon = '111222333' WHERE turniej_id = :TURNIEJ::uuid;
RESET ROLE;
SELECT _oczekuj('obcy nie nadpisze numeru BLIK — bez zmian',
                (SELECT count(*) FROM turniej_blik
                  WHERE turniej_id = :TURNIEJ::uuid AND blik_telefon = '500600700'), 1);

-- Kapitan CZYTA numer, ale nie może go zmienić — USING filtruje wiersz do
-- zera, ta sama figura co przy „prowadzący nie skasował ogłoszenia" wyżej.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
UPDATE turniej_blik SET blik_telefon = '999888777' WHERE turniej_id = :TURNIEJ::uuid;
RESET ROLE;
SELECT _oczekuj('kapitan nie zmienił numeru BLIK organizatora',
                (SELECT count(*) FROM turniej_blik
                  WHERE turniej_id = :TURNIEJ::uuid AND blik_telefon = '500600700'), 1);

SELECT _sekcja('Turniej: zamień drużynę w ekipę (migracja 150)');

-- Dopisujemy drugiego zawodnika z kontem do D1, żeby sprawdzić, że RPC
-- przenosi CAŁY skład z kontem, nie tylko kapitana.
\set T_CZLONEK '''eeeeeeee-0000-4000-8000-000000000006'''
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (:T_CZLONEK::uuid, 'rls-turniej-czlonek@example.com', now(), '{"display_name":"Cyryl Członek"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO turniej_zawodnicy (druzyna_id, turniej_id, user_id, imie)
VALUES (:T_DRUZYNA1::uuid, :TURNIEJ::uuid, :T_CZLONEK::uuid, 'Cyryl Członek');

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :OBCY, false);
SELECT _oczekuj_wyjatek('obcy — nie kapitan — nie zamieni cudzej drużyny w ekipę',
  format('SELECT zamien_druzyne_w_ekipe(%L::uuid)', :T_DRUZYNA1));
RESET ROLE;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :T_KAPITAN1, false);
SELECT zamien_druzyne_w_ekipe(:T_DRUZYNA1::uuid) AS nowa_grupa \gset
RESET ROLE;

SELECT _oczekuj('powstała nowa grupa o nazwie drużyny, sport przeniesiony z turnieju',
                (SELECT count(*) FROM groups
                  WHERE id = :'nowa_grupa'::uuid AND name = 'Drużyna Jeden' AND sport = 'piłka nożna'), 1);
SELECT _oczekuj('kapitan i zawodnik z kontem są członkami nowej ekipy (kapitan przez trigger, reszta przez RPC)',
                (SELECT count(*) FROM group_members
                  WHERE group_id = :'nowa_grupa'::uuid
                    AND user_id IN (:T_KAPITAN1::uuid, :T_CZLONEK::uuid)), 2);

-- ── ALERT: wyłącznik z maila (migracja 149) ──────────────────────────────────
-- Nowa ścieżka dostępu dla `anon`: funkcja `wylacz_alert_tokenem()`. Jest
-- SECURITY DEFINER, czyli omija RLS z definicji — więc jedyne, co stoi między
-- cudzym alertem a wyłączeniem go, to nieodgadywalność tokenu ORAZ to, że
-- funkcja nie umie zrobić nic poza `is_active = false`. Oba te warunki są tu
-- sprawdzone, bo błąd w którymkolwiek jest cichy.

\set ALERT_WLASC '''ffffffff-0000-4000-8000-000000000021'''
INSERT INTO auth.users (id, email) VALUES (:ALERT_WLASC::uuid, 'alert@example.com')
  ON CONFLICT DO NOTHING;

\set ALERT_ID '''ffffffff-0000-4000-8000-000000000022'''
\set ALERT_TOKEN '''ffffffff-0000-4000-8000-000000000023'''
INSERT INTO game_alerts (id, user_id, lat, lng, radius_km, wylacz_token)
VALUES (:ALERT_ID::uuid, :ALERT_WLASC::uuid, 52.4, 16.9, 10, :ALERT_TOKEN::uuid);

-- Sam wiersz alertu zostaje prywatny: token daje prawo do JEDNEJ operacji,
-- nie do czytania, gdzie ktoś gra i kiedy go nie ma w domu.
SET ROLE anon;
SELECT _oczekuj('anon NIE czyta cudzego alertu',
                (SELECT count(*) FROM game_alerts WHERE id = :ALERT_ID::uuid), 0);

-- Zły token nie rusza niczego — inaczej zgadywanie miałoby sens.
SELECT _oczekuj('zły token nie wyłącza nic',
                (SELECT CASE WHEN wylacz_alert_tokenem(
                   'ffffffff-0000-4000-8000-0000000000ff'::uuid) THEN 1 ELSE 0 END), 0);
RESET ROLE;
SELECT _oczekuj('alert po złym tokenie dalej aktywny',
                (SELECT count(*) FROM game_alerts
                  WHERE id = :ALERT_ID::uuid AND is_active), 1);

-- Właściwy token wyłącza, bez logowania.
SET ROLE anon;
SELECT _oczekuj('właściwy token wyłącza alert',
                (SELECT CASE WHEN wylacz_alert_tokenem(:ALERT_TOKEN::uuid) THEN 1 ELSE 0 END), 1);
RESET ROLE;
SELECT _oczekuj('alert jest wyłączony',
                (SELECT count(*) FROM game_alerts
                  WHERE id = :ALERT_ID::uuid AND NOT is_active), 1);

-- Drugie kliknięcie w ten sam link (mail zostaje w skrzynce na zawsze) ma być
-- nieszkodliwe i ma powiedzieć „nie było czego wyłączać", a nie wywalić się.
SET ROLE anon;
SELECT _oczekuj('powtórne użycie tokenu nic nie psuje',
                (SELECT CASE WHEN wylacz_alert_tokenem(:ALERT_TOKEN::uuid) THEN 1 ELSE 0 END), 0);
RESET ROLE;

-- Token NIE jest kluczem do reszty wiersza: anon nie może nim nic nadpisać.
SET ROLE anon;
DO $$
BEGIN
  BEGIN
    UPDATE game_alerts SET lat = 0 WHERE wylacz_token = 'ffffffff-0000-4000-8000-000000000023'::uuid;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
SELECT _oczekuj('anon nie przestawia współrzędnych cudzego alertu',
                (SELECT count(*) FROM game_alerts
                  WHERE id = :ALERT_ID::uuid AND lat = 52.4), 1);

DO $$ BEGIN RAISE NOTICE ''; RAISE NOTICE '✓ RLS: wszystkie asercje przeszły.'; END $$;
