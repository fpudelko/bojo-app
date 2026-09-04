-- 134 — mail powitalny po założeniu konta
--
-- DLACZEGO. Bojo nie odzywało się do nowego użytkownika ANI RAZU — i nie jest to
-- przenośnia. W ustawieniach Supabase „Confirm email” jest WYŁĄCZONE, więc
-- nie wychodzi nawet prośba o potwierdzenie adresu; przy Google nie ma jej
-- z definicji. Człowiek zakłada konto, widzi pustą listę swoich meczów i nie ma
-- skąd wiedzieć, że najkrótsza droga do gry prowadzi przez stworzenie własnego
-- meczu i wysłanie jednego linku, a nie przez czekanie, aż ktoś w okolicy
-- otworzy grę.
--
-- KIEDY. Wyzwalacz reaguje na POTWIERDZONY adres: na `INSERT` z wypełnionym
-- `email_confirmed_at` albo na przejście tej kolumny z NULL na wartość.
--
-- Przy DZISIEJSZYCH ustawieniach („Confirm email” wyłączone) adres jest
-- potwierdzony już przy zakładaniu konta — i dla hasła, i dla Google — więc mail
-- idzie natychmiast, obiema drogami. Warunek nie jest przez to zbędny: gdyby
-- „Confirm email” kiedykolwiek zostało włączone, powitanie samo z siebie
-- przesunie się za potwierdzenie, zamiast przychodzić RÓWNOLEGLE z prośbą
-- o nie — dwie wiadomości naraz, z których jedna prosi o działanie, a druga
-- udaje, że wszystko gotowe. Witalibyśmy też kogoś, kto konta może nigdy nie
-- potwierdzić. Jeden warunek obsługuje więc obie konfiguracje i żadna zmiana
-- w panelu Supabase nie wymaga tknięcia tego kodu.
--
-- UBOCZNY SKUTEK WYŁĄCZONEGO POTWIERDZANIA, o którym trzeba wiedzieć: skoro
-- adresu nikt nie weryfikuje, da się założyć konto na CUDZY adres — i powitanie
-- pójdzie do kogoś, kto o nie nie prosił. To jest własność tego ustawienia,
-- nie tego maila; wraz z włączeniem „Confirm email” znika samo.
--
-- LEDGER UOGÓLNIONY. `maile_goscia` (migracja `133`) trzymała ślad wysyłek do
-- gości, kluczem po wpisie w składzie. Powitanie nie ma wpisu w składzie —
-- ma konto. Zamiast drugiej, prawie identycznej tabeli: `maile_wyslane`
-- z DWOMA możliwymi kluczami i warunkiem, że dokładnie jeden jest wypełniony.
-- Rename jest bezpieczny: tabelę czyta wyłącznie `wyslij_mail_do_goscia()`,
-- poprawiana niżej w tej samej migracji, a na produkcji jest pusta (kanał
-- pocztowy nie był jeszcze włączony).
--
-- Migracja jest IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Jeden dziennik wysyłek zamiast dwóch
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'maile_goscia')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'maile_wyslane') THEN
    ALTER TABLE maile_goscia RENAME TO maile_wyslane;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS maile_wyslane (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uczestnik_id UUID REFERENCES event_participants(id) ON DELETE CASCADE,
  powod        TEXT NOT NULL,
  dzien        DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Warsaw')::date,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE maile_wyslane ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON maile_wyslane FROM anon, authenticated;

ALTER TABLE maile_wyslane ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE maile_wyslane ALTER COLUMN uczestnik_id DROP NOT NULL;

-- Dokładnie jeden klucz — inaczej wiersz nie mówi, czyj jest.
ALTER TABLE maile_wyslane DROP CONSTRAINT IF EXISTS maile_wyslane_jeden_klucz;
ALTER TABLE maile_wyslane ADD CONSTRAINT maile_wyslane_jeden_klucz
  CHECK (num_nonnulls(uczestnik_id, user_id) = 1);

-- Idempotencja osobno dla obu kluczy: `UNIQUE` na kolumnach z NULL-ami nie
-- działa (NULL nie równa się NULL), więc dwa indeksy częściowe.
ALTER TABLE maile_wyslane DROP CONSTRAINT IF EXISTS maile_goscia_uczestnik_id_powod_dzien_key;
CREATE UNIQUE INDEX IF NOT EXISTS maile_wyslane_uczestnik
  ON maile_wyslane (uczestnik_id, powod, dzien) WHERE uczestnik_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS maile_wyslane_konto
  ON maile_wyslane (user_id, powod) WHERE user_id IS NOT NULL;
-- Powitanie bez `dzien` w kluczu: ma pójść RAZ w życiu konta, nie raz dziennie.

-- ---------------------------------------------------------------------------
-- 2. Wysyłka do gościa — ta sama treść, nowa nazwa tabeli
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_mail_do_goscia(p_uczestnik UUID, p_powod TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_w      RECORD;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  SELECT p.id, p.name, p.guest_email, p.claim_token, p.is_reserve,
         e.id AS event_id, e.title, e.sport, e.event_date, e.event_time,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz
    INTO v_w
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.id = p_uczestnik AND p.is_guest
     AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL;
  IF v_w.id IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO maile_wyslane (uczestnik_id, powod) VALUES (p_uczestnik, p_powod);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod', p_powod, 'email', v_w.guest_email, 'imie', v_w.name,
      'event_id', v_w.event_id, 'tytul', coalesce(v_w.title, v_w.sport),
      'data', to_char(v_w.event_date, 'DD.MM.YYYY'),
      'godzina', to_char(v_w.event_time, 'HH24:MI'),
      'miejsce', v_w.miejsce, 'koszt_grosz', v_w.cost_grosz,
      'na_rezerwie', v_w.is_reserve, 'token', v_w.claim_token
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Powitanie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_mail_powitalny(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_email  TEXT;
  v_imie   TEXT;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  -- Imię tą samą drogą co `handle_new_user()` (`022`) — trzy pola, bo Google
  -- i rejestracja hasłem wpisują je pod różnymi nazwami. Gdy nie ma żadnego,
  -- mail wita bez imienia; „Cześć null!" byłoby gorsze niż samo „Cześć!".
  SELECT u.email,
         nullif(btrim(coalesce(
           u.raw_user_meta_data ->> 'display_name',
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name', '')), '')
    INTO v_email, v_imie
    FROM auth.users u WHERE u.id = p_user;

  IF v_email IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO maile_wyslane (user_id, powod) VALUES (p_user, 'powitanie');
  EXCEPTION WHEN unique_violation THEN
    RETURN;   -- raz w życiu konta
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object('powod', 'powitanie', 'email', v_email, 'imie', v_imie)
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_mail_powitalny(UUID) FROM anon, authenticated;

-- Wyzwalacz łapie OBA przypadki jednym warunkiem: Google potwierdza adres już
-- przy wstawieniu wiersza, rejestracja hasłem dopiero przy kliknięciu w link.
CREATE OR REPLACE FUNCTION powitaj_nowe_konto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.email_confirmed_at IS NULL) THEN
    PERFORM wyslij_mail_powitalny(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powitaj_nowe_konto ON auth.users;
CREATE TRIGGER trg_powitaj_nowe_konto
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION powitaj_nowe_konto();
