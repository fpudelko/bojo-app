-- 088: Wykrywanie istniejącego konta przy zapisie gościa + twardy zamek na duplikaty
--
-- Problem 1 — „mam konto, a apka i tak namawia na zakładanie konta". Po zapisie bez
-- logowania ekran zawsze proponował „Utwórz profil gracza", bo nic w bazie nie mówiło
-- frontendowi, czy podany e-mail ma już konto. Użytkownik dowiadywał się o tym dopiero
-- po wpisaniu hasła i nieudanej rejestracji (`signUpWithEmail` → identities.length === 0).
-- Rozwiązanie: czwarta kolumna zwracana przez RPC, `has_account`.
--
-- Problem 2 — wybór wariantu ekranu był losowy. `087` szukało istniejącego wpisu przez
-- `SELECT … LIMIT 1` BEZ `ORDER BY`. Dla e-maili, które zdążyły nazbierać duplikaty przed
-- migracją `085`, Postgres zwracał raz wiersz przejęty (→ wyjątek, ekran logowania), raz
-- nieprzejętego gościa (→ `already_joined`, ekran zachęty do konta). Rozwiązanie: sprzątamy
-- duplikaty, zakładamy UNIQUE INDEX (duplikat nie ma jak powstać nawet przy wyścigu), a
-- zapytanie dostaje deterministyczne `ORDER BY`.
--
-- Problem 3 — „już zapisany" wracało jako wyjątek, więc frontend rozpoznawał tę sytuację
-- po TREŚCI komunikatu (`msg.includes('już zapisany na ten mecz')`). Ten sam tekst rzucają
-- `066` i `078` dla ścieżki zalogowanej, a każda zmiana copy w SQL po cichu psuła UI.
-- Rozwiązanie: to nie jest błąd, tylko wynik — RPC zwraca wiersz z `claim_token = NULL`
-- i `already_joined = true`. Wyjątki zostają wyłącznie dla realnych błędów.
--
-- UWAGA: krok 1 KASUJE DANE (nadmiarowe wpisy gościa). Bez tego UNIQUE INDEX z kroku 2
-- się nie założy. W chwili pisania migracji dotyczy to 4 wierszy na 2 meczach.


-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Deduplikacja istniejących wpisów gościa
-- ──────────────────────────────────────────────────────────────────────────────
-- Zostaje jeden wiersz na parę (mecz, e-mail): najpierw ten przejęty przez konto
-- (`claim_token IS NULL` — ma właściciela, jego usunięcie odcięłoby kogoś od meczu),
-- w drugiej kolejności najstarszy, bo to on trzyma pozycję w kolejce rezerwowych.
--
-- Podgląd tego, co zniknie (odpal przed migracją, jeśli chcesz zobaczyć listę):
--   SELECT ep.id, ep.event_id, ep.name, ep.guest_email, ep.created_at
--     FROM event_participants ep
--     JOIN (SELECT event_id, lower(guest_email) AS email FROM event_participants
--            WHERE guest_email IS NOT NULL
--            GROUP BY 1, 2 HAVING count(*) > 1) d
--       ON d.event_id = ep.event_id AND d.email = lower(ep.guest_email);

WITH ranking AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY event_id, lower(guest_email)
      ORDER BY (claim_token IS NULL) DESC, created_at
    ) AS pozycja
  FROM event_participants
  WHERE guest_email IS NOT NULL
)
DELETE FROM event_participants
 WHERE id IN (SELECT id FROM ranking WHERE pozycja > 1);


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Zamek: jeden e-mail = jeden wpis w meczu
-- ──────────────────────────────────────────────────────────────────────────────
-- Warunek `guest_email IS NOT NULL` zostawia poza indeksem gości dopisanych ręcznie przez
-- organizatora (`addGuest` nie zbiera e-maila) — ci mogą się powtarzać do woli.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_unique_guest_email
  ON event_participants (event_id, lower(guest_email))
  WHERE guest_email IS NOT NULL;


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. RPC z kolumną has_account i wynikiem zamiast wyjątku
-- ──────────────────────────────────────────────────────────────────────────────
-- Zmiana kształtu RETURNS TABLE wymaga DROP + CREATE (CREATE OR REPLACE nie pozwala
-- zmienić typu zwracanego). GRANT znika razem z DROP — jest nadany ponownie na końcu.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN, has_account BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
  v_ma_wpis boolean;
  v_ma_konto boolean;
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Czy ten e-mail ma konto w Bojo? Pytanie GLOBALNE (nie „czy jest w tym meczu"), bo
  -- decyduje o tym, czy ekran po zapisie zachęca do REJESTRACJI czy do LOGOWANIA.
  -- auth.users jest niedostępne dla anona — stąd SECURITY DEFINER.
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

  -- Ten sam e-mail już ma wpis w tym meczu? ORDER BY, bo przy danych sprzed kroku 1
  -- wybór wiersza decydował o wariancie ekranu — wiersz przejęty (z właścicielem)
  -- ma pierwszeństwo nad nieprzejętym gościem.
  SELECT ep.claim_token, true
    INTO v_istniejacy_token, v_ma_wpis
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   ORDER BY (ep.claim_token IS NULL) DESC, ep.created_at
   LIMIT 1;

  IF v_ma_wpis THEN
    IF v_istniejacy_token IS NULL THEN
      -- Wpis ma już właściciela (konto przejęło zapis). Nie ma czego przejmować —
      -- frontend rozpozna to po pustym tokenie i pokaże ekran „zaloguj się".
      RETURN QUERY SELECT NULL::uuid, p_event_id, true, v_ma_konto;
      RETURN;
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat, oznaczając already_joined = true.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true, v_ma_konto;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie — też nie ma czego przejmować.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RETURN QUERY SELECT NULL::uuid, p_event_id, true, true;
    RETURN;
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;
