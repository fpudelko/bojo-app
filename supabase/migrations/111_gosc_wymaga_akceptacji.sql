-- 111: Zapis gościa respektuje "akceptacja zapisów" (require_approval).
--
-- `dolacz_do_meczu_jako_goscie()` (`088`, wcześniej `082`-`087`) wstawiała
-- `pending_approval = false` na sztywno. Na meczu z włączoną akceptacją
-- zapisów gość z linku wchodził prosto do składu, podczas gdy zalogowany
-- gracz w tej samej sytuacji czeka na zgodę organizatora (`dolacz_do_meczu`,
-- `078`). To łamało obietnicę kontroli składu, którą "akceptacja zapisów"
-- daje organizatorowi — furtka bez zamka obok drzwi z zamkiem.
--
-- Naprawa mirroruje `dolacz_do_meczu` z `078`: `v_pending :=
-- coalesce(v_wymaga_akceptacji, false)`, a `v_rezerwa` liczy się TYLKO gdy
-- NIE jest pending (`czy_na_rezerwe()` i tak już filtruje `pending_approval
-- = false` przy liczeniu pojemności, więc wiersz pending nie zajmuje miejsca
-- ani w składzie, ani na rezerwie).
--
-- Sygnatura i kształt `RETURNS TABLE` zostają IDENTYCZNE — zero zmian po
-- stronie wywołania z frontendu. `pending_approval` nowo wstawionego (albo
-- znalezionego) wiersza frontend dociąga tym samym drugim zapytaniem po
-- `claim_token`, którym już dziś dociąga `is_reserve`
-- (`lib/events.ts#joinEventAsGuest`) — nie ma potrzeby poszerzać zwrotki RPC.
--
-- Organizator i tak dostaje powiadomienie o nowej prośbie: trigger
-- `powiadom_o_prosbie_o_dolaczenie` (`076`) reaguje na `NEW.pending_approval
-- IS TRUE` niezależnie od tego, czy `NEW.user_id` jest NULL (gość) czy nie —
-- `approveParticipant`/`rejectParticipant` operują po `participantId`, bez
-- gałęzi na obecność konta.

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
  v_pending boolean;
  v_wymaga_akceptacji boolean;
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

  -- Czy mecz istnieje i czy nie został odwołany? Przy okazji: czy wymaga akceptacji.
  SELECT require_approval INTO v_wymaga_akceptacji FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Czy ten e-mail ma konto w Bojo? Pytanie GLOBALNE (nie „czy jest w tym meczu"), bo
  -- decyduje o tym, czy ekran po zapisie zachęca do REJESTRACJI czy do LOGOWANIA.
  -- auth.users jest niedostępne dla anona — stąd SECURITY DEFINER.
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

  -- Ten sam e-mail już ma wpis w tym meczu? ORDER BY, bo przy danych sprzed migracji
  -- `088` wybór wiersza decydował o wariancie ekranu — wiersz przejęty (z właścicielem)
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
    -- wstawiać duplikat, oznaczając already_joined = true. Stan pending_approval
    -- tego wiersza dociąga frontend drugim zapytaniem po claim_token.
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

  -- Akceptacja zapisów: tak samo jak przy zalogowanym dołączeniu (`078`), wiersz
  -- oczekujący na zgodę NIE zajmuje miejsca ani w składzie, ani na rezerwie —
  -- `czy_na_rezerwe()` liczy pojemność wyłącznie z `pending_approval = false`.
  v_pending := coalesce(v_wymaga_akceptacji, false);
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

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
    v_pending
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;
