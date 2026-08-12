-- 082: Self-service guest signup without account
--
-- Pozwala niezalogowanemu graczowi zapisać się na mecz bez konta, podając imię
-- i e-mail. Tworzy wpis gościa z `claim_token`, który pozwoli mu później
-- przejąć ten wpis po założeniu konta.
--
-- Model: gość mówi "zapisz mnie jako [imię] pod [email]", system tworzy
-- `event_participants` z `user_id = NULL`, `is_guest = true`, `guest_email`,
-- i losowym `claim_token` generowanym triggerem `nadaj_token_gosciowi()` (066).
--
-- Reguły pojemności są identyczne jak przy normalnym zapisie (`czy_na_rezerwe`).
-- RLS nie pozwala bezpośredniego INSERT-u dla anon — potrzebna funkcja
-- `SECURITY DEFINER`.

-- ============================================================================
-- Dodaj kolumny do `event_participants` dla danych gościa
-- ============================================================================

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

COMMENT ON COLUMN event_participants.guest_email IS
  'E-mail gościa zapisanego bez konta (self-service signup)';

COMMENT ON COLUMN event_participants.guest_phone IS
  'Numer telefonu gościa (opcjonalnie)';

-- ============================================================================
-- Funkcja: dołączenie do meczu jako gość bez konta
-- ============================================================================
--
-- Przyjmuje: event_id, imię, e-mail, opcjonalnie rolę i płatność.
-- Robi to samo co `dolacz_do_meczu()`, ale dla auth.uid() = NULL.
--
-- Zwraca: `claim_token` (do przejęcia wpisu linkiem) i `event_id` (do powrotu).

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_nowy_token uuid;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
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

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa
  INSERT INTO event_participants (
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
  );

  -- Pobierz `claim_token` z wiersza, który właśnie wstawiliśmy
  -- (został wygenerowany triggerem `nadaj_token_gosciowi`)
  SELECT claim_token INTO v_nowy_token
    FROM event_participants
   WHERE event_id = p_event_id
     AND user_id IS NULL
     AND is_guest = true
     AND name = v_imie_clean
     AND guest_email = v_email_clean
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN QUERY SELECT v_nowy_token, p_event_id;
END;
$$;

-- Zezwol anonimom na wywołanie
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;

-- ============================================================================
-- Weryfikacja: trigger `nadaj_token_gosciowi` istnieje (z migracji 066)
-- ============================================================================
-- Trigger generuje `claim_token` dla każdego nowego wiersza gościa.
-- Jeśli go nie ma, funkcja wyżej nie będzie działać — ale to powinno być
-- niemożliwe, bo migracja 066 jest dawna (lipiec 2024+).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_name = 'trg_nadaj_token_gosciowi'
  ) THEN
    RAISE WARNING 'Trigger nadaj_token_gosciowi nie istnieje — migracjajest niekompletna?';
  END IF;
END $$;
