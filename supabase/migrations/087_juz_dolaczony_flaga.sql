-- 087: Dodaj flagę already_joined do dolacz_do_meczu_jako_goscie()
--
-- Problem: `085` poprawnie blokuje duplikat zapisu (rzuca wyjątek, gdy e-mail już ma
-- konto uczestniczące w tym meczu; zwraca istniejący `claim_token` idempotentnie, gdy
-- to nieprzejęty gość), ale frontend nie potrafił odróżnić świeżego zapisu od zwrotu
-- istniejącego tokenu — obie ścieżki zwracały identyczny kształt `{claim_token, event_id}`.
-- Bez tego ekran po zapisie zawsze pokazywał „Zapisano!", nawet gdy to był drugi klik
-- tym samym mailem.
--
-- Rozwiązanie: trzecia kolumna zwracana przez RPC, `already_joined` — true, gdy funkcja
-- zwróciła istniejący token zamiast wstawiać nowy wiersz; false przy świeżym zapisie.
--
-- Zmiana sygnatury zwrotnej (RETURNS TABLE) wymaga DROP + CREATE — CREATE OR REPLACE nie
-- pozwala zmienić typ zwracany istniejącej funkcji. GRANT znika razem z DROP, więc trzeba
-- go nadać ponownie na końcu.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
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

  -- Ten sam e-mail już ma wpis w tym meczu?
  SELECT ep.claim_token INTO v_istniejacy_token
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   LIMIT 1;

  IF FOUND THEN
    IF v_istniejacy_token IS NULL THEN
      RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat, oznaczając already_joined = true.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
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
  RETURNING event_participants.claim_token, p_event_id, false;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;
