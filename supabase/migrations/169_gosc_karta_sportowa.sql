-- 169: gość bez konta deklaruje kartę sportową tak samo jak gracz z kontem.
--
-- DLACZEGO. Mecz akceptujący Multisport pokazywał „Mam kartę sportową" w oknie
-- zapisu dla zalogowanego, a w oknie „Dołącz do meczu bez logowania" nie miał
-- tego pola wcale — gość płacił (i widział) pełną cenę, mimo że organizator
-- świadomie przyjmuje kartę. Zgłoszone wprost z produkcji.
--
-- Funkcja przyjmowała już `p_karta_sportowa` (od `082`), ale NIE przyjmowała
-- dostawcy karty — `dolacz_do_meczu()` (`078`/`141`) ma `p_dostawca_karty`
-- i zapisuje `sports_card_provider`. Przy meczu akceptującym dwie karty
-- organizator nie wiedziałby, którą gość ma. Dokładamy ten sam parametr,
-- zapisywany tą samą regułą (dostawca tylko przy zaznaczonej karcie).
--
-- SYGNATURA SIĘ ZMIENIA (6 → 7 argumentów), więc DROP starej + CREATE nowej.
-- Samo `CREATE OR REPLACE` z dodatkowym argumentem zostawiłoby DWIE przeciążone
-- funkcje, a PostgREST przy wywołaniu z sześcioma nazwanymi argumentami nie
-- umiałby wybrać między nimi. Nowy argument ma DEFAULT, więc wywołania
-- z mniejszą liczbą argumentów (stary frontend, `supabase/test/*.sql`) działają
-- bez zmian. Kształt wyniku bez zmian.
--
-- Ciało przepisane z `141` znak w znak; jedyna zmiana to `p_dostawca_karty`
-- i kolumna `sports_card_provider` w INSERT.
--
-- Idempotentna: drugie uruchomienie usuwa (nieistniejącą już) starą sygnaturę
-- i zastępuje nową.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false,
  p_dostawca_karty TEXT DEFAULT NULL
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN, has_account BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_pending boolean;
  v_wymaga_akceptacji boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
  v_ma_wpis boolean;
  v_ma_konto boolean;
BEGIN
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  SELECT require_approval INTO v_wymaga_akceptacji FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

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
      RETURN QUERY SELECT NULL::uuid, p_event_id, true, v_ma_konto;
      RETURN;
    END IF;
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true, v_ma_konto;
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RETURN QUERY SELECT NULL::uuid, p_event_id, true, true;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM events
              WHERE id = p_event_id AND coalesce(zapisy_zamkniete, false)) THEN
    RAISE EXCEPTION 'Zapisy na ten mecz są zamknięte';
  END IF;

  PERFORM sync_reserve_claim(p_event_id);

  v_pending := coalesce(v_wymaga_akceptacji, false);
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

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
    sports_card_provider,
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
    CASE WHEN p_karta_sportowa THEN p_dostawca_karty ELSE NULL END,
    v_pending
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT)
  TO anon, authenticated;
