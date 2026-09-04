-- PRÓBNA WYSYŁKA WSZYSTKICH SZEŚCIU MAILI NA JEDEN ADRES
--
-- Do uruchomienia RĘCZNIE w Supabase → SQL Editor, DOPIERO gdy:
--   1. domena `bojo.pl` jest w Resend zweryfikowana (Verified, nie Pending),
--   2. funkcja `powiadom-goscia` jest wdrożona (z `--no-verify-jwt`),
--   3. sekrety funkcji są ustawione (RESEND_API_KEY, BOJO_POCZTA_SEKRET, BOJO_NADAWCA),
--   4. `konfiguracja_poczty` ma `url` i `sekret`.
--
-- Wcześniej ten skrypt nie zaszkodzi, ale i nic nie wyśle — `net.http_post`
-- poleci w próżnię albo nie będzie dokąd.
--
-- CO ROBI: woła funkcję brzegową BEZPOŚREDNIO, sześć razy, po jednym żądaniu
-- na każdy szablon. Świadomie NIE przechodzi przez wyzwalacze ani przez
-- `wyslij_mail_do_goscia()`: nie tworzy żadnego meczu, nie dopisuje nikogo do
-- składu i nie zostawia wiersza w `maile_wyslane`. Dzięki temu można go puścić
-- na produkcji i puścić drugi raz, bez sprzątania po sobie.
--
-- Dane w środku są ATRAPĄ — mają pokazać, jak mail wygląda, a nie odzwierciedlać
-- prawdziwy mecz. Token prowadzi donikąd, więc link w stopce da „nie znaleziono
-- wpisu"; to jedyna rzecz, której na tym teście nie da się sprawdzić.

\set ADRES 'bojopolska@gmail.com'

DO $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_adres  TEXT := 'bojopolska@gmail.com';
  v_powod  TEXT;
  v_ile    INT := 0;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';

  IF v_url IS NULL OR v_sekret IS NULL THEN
    RAISE EXCEPTION 'Brak wpisu w `konfiguracja_poczty` — wykonaj krok 4 z README funkcji.';
  END IF;

  -- Pięć maili meczowych. `token` jest zmyślony: link w stopce ma pokazać, że
  -- jest, nie ma prowadzić do prawdziwego wpisu.
  FOREACH v_powod IN ARRAY ARRAY['zapis', 'odwolanie', 'zmiana', 'jutro_grasz', 'zaloz_konto']
  LOOP
    PERFORM net.http_post(
      url     := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
      body    := jsonb_build_object(
        'powod',       v_powod,
        'email',       v_adres,
        'imie',        'Jan',
        'event_id',    '00000000-0000-4000-8000-000000000000',
        'tytul',       'Czwartkowa ligówka 7v7',
        'data',        to_char((now() AT TIME ZONE 'Europe/Warsaw')::date + 1, 'DD.MM.YYYY'),
        'godzina',     '20:00',
        'miejsce',     'Orlik Sołacz, ul. Niestachowska 8',
        'koszt_grosz', 1500,
        'na_rezerwie', false,
        'token',       '00000000-0000-4000-8000-0000000000ff'
      )
    );
    v_ile := v_ile + 1;
  END LOOP;

  -- Powitanie — jedyny mail bez meczu.
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object('powod', 'powitanie', 'email', v_adres, 'imie', 'Jan')
  );
  v_ile := v_ile + 1;

  RAISE NOTICE 'Wysłano % żądań na %. Sprawdź skrzynkę ORAZ folder SPAM.', v_ile, v_adres;
END $$;

-- `net.http_post` jest ASYNCHRONICZNE: powyższe wraca od razu, a żądania lecą
-- w tle. Odpowiedzi (kod HTTP z funkcji brzegowej) pojawiają się tu po chwili.
-- 200 z `{"wyslane": true}` = Resend przyjął. 401 = rozjazd sekretu między
-- `konfiguracja_poczty` a `BOJO_POCZTA_SEKRET`. 200 z `{"pominiete": "brak
-- klucza"}` = nieustawiony `RESEND_API_KEY`.
SELECT id, status_code, convert_from(content, 'UTF8') AS odpowiedz, created
  FROM net._http_response
 ORDER BY id DESC
 LIMIT 6;
