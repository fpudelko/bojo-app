-- 197 — „Wymagaj numeru telefonu": na mecz zapisze się tylko ktoś, kto podał numer
--
-- DLACZEGO. Organizator chce móc ZADZWONIĆ do składu: upewnić się, że ktoś
-- wpadnie, albo dać znać, że zmienia się boisko lub godzina. Powiadomienia
-- i maile dochodzą z opóźnieniem albo wcale (push wyłączony, mail w spamie),
-- a telefon dzień przed meczem jest w amatorskiej piłce zwykłym narzędziem.
-- Do tej pory numer gracza był wyłącznie w jego profilu, opcjonalny, i nikt
-- poza nim samym nie miał po co go oglądać.
--
-- ---------------------------------------------------------------------------
-- CO ROBI
-- ---------------------------------------------------------------------------
-- 1. `events.require_phone` — przełącznik w ustawieniach meczu, domyślnie
--    wyłączony.
-- 2. Strażnik `pilnuj_wymaganego_telefonu()` na `event_participants`:
--    przy meczu z włączonym przełącznikiem zapis BEZ numeru kończy się
--    wyjątkiem. Wyzwalacz, a nie warunek w `dolacz_do_meczu()`, bo do składu
--    prowadzi kilka dróg (zapis konta, „obserwuję → gram" przez
--    `potwierdz_udzial()`, zapis gościa bez konta) i każda nowa droga
--    dostaje strażnika za darmo. Klucz `anon` siedzi jawnie w paczce JS,
--    więc warunek w interfejsie nie jest granicą.
-- 3. `dolacz_do_meczu_jako_goscie()` przyjmuje `p_telefon` i zapisuje go
--    w istniejącej od `082` kolumnie `guest_phone`.
-- 4. `telefony_skladu()` — numery składu dla organizatora i delegatów od
--    składu, TYLKO na meczu z włączonym przełącznikiem.
-- 5. `moj_telefon()` / `zapisz_moj_telefon()` — odczyt i zapis własnego
--    numeru, bo (6) odbiera do niego bezpośredni dostęp.
-- 6. DOMYKA WYCIEK: `profiles` ma politykę SELECT `USING (true)` (`005`)
--    i uprawnienia na całej tabeli, więc `profiles.phone` KAŻDEGO użytkownika
--    dało się pobrać jednym zapytaniem do REST-a, bez logowania. Dopóki numer
--    był rzadki i nic do niego nie zachęcało, był to cichy błąd; funkcja,
--    która prosi ludzi o numer, zamieniłaby go w zbieranie numerów do
--    wycieku. Ten sam zabieg co `127` na `event_participants`: REVOKE na
--    tabeli + GRANT na liście kolumn bez `phone` i `phone_consent`.
--
-- ---------------------------------------------------------------------------
-- CZEGO NIE BLOKUJE (każde „nie" jest decyzją)
-- ---------------------------------------------------------------------------
--   • ORGANIZATORA i delegatów dopisujących gościa (`addGuest`). Organizator
--     zna dopisywaną osobę albo ma jej numer w telefonie; zmuszanie go do
--     przepisywania numeru, żeby dopisać kolegę z WhatsAppa, byłoby tą samą
--     przeszkodą, którą `141` świadomie ominęło przy zamkniętych zapisach.
--     Rozpoznajemy to po tym, że wiersz NIE jest wpisem osoby wywołującej
--     (`user_id <> auth.uid()`).
--   • ORGANIZATORA zapisującego samego siebie.
--   • „OBSERWUJĘ" (`rsvp = 'maybe'`). To nie jest udział; numer jest
--     potrzebny dopiero przy „Gram", a wtedy strażnik działa na UPDATE.
--   • TYCH, KTÓRZY JUŻ SĄ W SKŁADZIE w chwili włączenia przełącznika.
--     Strażnik pilnuje wejścia, nie wyrzuca nikogo wstecz; organizator widzi
--     przy nich po prostu brak numeru.
--   • SKASOWANIA numeru z profilu po zapisie. Gracz ma prawo wycofać numer;
--     organizator zobaczy wtedy brak numeru, a nie znikający wpis.
--
-- KOLEJNOŚĆ WDROŻENIA. Wszystko tu DOKŁADA (kolumna, funkcje, wyzwalacz,
-- GRANT), więc migracja jedzie automatem przy merge'u. Przez minutę między
-- migracją a deployem stary frontend nie przeczyta numeru na `/profil`
-- (403 na kolumnie) — świadomie akceptowane, bo alternatywą jest numer
-- każdego gracza czytelny z internetu o minutę dłużej.
--
-- MIGRACJA JEST IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Kolumna
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS require_phone BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.require_phone IS
  'Zapis na mecz wymaga numeru telefonu (profil konta albo guest_phone gościa). Pilnuje wyzwalacz pilnuj_wymaganego_telefonu(); organizator widzi numery przez telefony_skladu() (migracja 197).';

-- ---------------------------------------------------------------------------
-- 2. Czy to wygląda na numer telefonu
-- ---------------------------------------------------------------------------
-- Ta sama reguła co `validatePhone()` w `lib/validation.ts`, poluzowana do
-- „9–15 cyfr z opcjonalnym plusem": frontend normalizuje polski numer do
-- `+48XXXXXXXXX`, a baza ma odrzucić śmieci, nie poprawiać format.
CREATE OR REPLACE FUNCTION telefon_poprawny(p_telefon TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_telefon IS NOT NULL
     AND regexp_replace(p_telefon, '[[:space:]()-]', '', 'g') ~ '^\+?[0-9]{9,15}$';
$$;

-- ---------------------------------------------------------------------------
-- 3. Strażnik na wejściu do składu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pilnuj_wymaganego_telefonu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ja uuid := auth.uid();
  v_wymaga boolean;
  v_organizator uuid;
BEGIN
  -- „Obserwuję" nie jest udziałem.
  IF coalesce(NEW.rsvp, 'yes') <> 'yes' THEN
    RETURN NEW;
  END IF;
  -- Na UPDATE liczy się wyłącznie przejście „obserwuję → gram". Każda inna
  -- zmiana wiersza (płatność, rola, przejęcie wpisu gościa) nie jest wejściem.
  IF TG_OP = 'UPDATE' AND coalesce(OLD.rsvp, 'yes') = 'yes' THEN
    RETURN NEW;
  END IF;

  SELECT require_phone, organizer_id
    INTO v_wymaga, v_organizator
    FROM events WHERE id = NEW.event_id;
  IF NOT coalesce(v_wymaga, false) THEN
    RETURN NEW;
  END IF;

  IF v_ja IS NOT NULL THEN
    -- Ktoś dopisuje KOGOŚ INNEGO (organizator, delegat, gracz z gościem) albo
    -- organizator zapisuje sam siebie — patrz „czego nie blokuje" w nagłówku.
    IF NEW.user_id IS DISTINCT FROM v_ja OR v_ja = v_organizator THEN
      RETURN NEW;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM profiles
                    WHERE id = v_ja AND telefon_poprawny(phone)) THEN
      RAISE EXCEPTION 'Ten mecz wymaga numeru telefonu. Dodaj go, żeby się zapisać.';
    END IF;
  ELSIF NEW.is_guest AND NEW.user_id IS NULL AND NEW.added_by IS NULL THEN
    -- Gość zapisujący się sam (`dolacz_do_meczu_jako_goscie`, wołane jako anon).
    IF NOT telefon_poprawny(NEW.guest_phone) THEN
      RAISE EXCEPTION 'Ten mecz wymaga numeru telefonu. Dodaj go, żeby się zapisać.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_wymaganego_telefonu ON event_participants;
CREATE TRIGGER trg_pilnuj_wymaganego_telefonu
  BEFORE INSERT OR UPDATE OF rsvp ON event_participants
  FOR EACH ROW EXECUTE FUNCTION pilnuj_wymaganego_telefonu();

-- ---------------------------------------------------------------------------
-- 4. Zapis gościa z numerem
-- ---------------------------------------------------------------------------
-- SYGNATURA SIĘ ZMIENIA (7 → 8 argumentów), więc DROP starej + CREATE nowej,
-- z tego samego powodu co w `170`: dwie przeciążone funkcje wywróciłyby
-- PostgREST. Nowy argument ma DEFAULT, więc stary frontend i `supabase/test/*`
-- działają bez zmian. Ciało przepisane z `170` znak w znak; jedyna zmiana to
-- `p_telefon` → `guest_phone` (pusty napis zapisuje się jako NULL).
DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false,
  p_dostawca_karty TEXT DEFAULT NULL,
  p_telefon TEXT DEFAULT NULL
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
  v_telefon_clean text := nullif(btrim(coalesce(p_telefon, '')), '');
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
  IF v_telefon_clean IS NOT NULL AND NOT telefon_poprawny(v_telefon_clean) THEN
    RAISE EXCEPTION 'Nieprawidłowy numer telefonu';
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
    guest_phone,
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
    v_telefon_clean,
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

GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT, TEXT)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Numery składu dla organizatora
-- ---------------------------------------------------------------------------
-- WYŁĄCZNIE przy `require_phone`: gracz podał numer w profilu, ale zgodził się
-- na telefon od organizatora tylko tam, gdzie mecz o niego prosił i powiedział
-- to w oknie zapisu. Zwykły mecz nie ujawnia nikomu niczego.
-- Organizator i delegat od składu (`can_manage_squad`, `089`) — dokładnie ci,
-- którzy mogą dopisać i wypisać gracza, więc też dzwonią w jego sprawie.
CREATE OR REPLACE FUNCTION telefony_skladu(p_event_id UUID)
RETURNS TABLE (uczestnik UUID, telefon TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.id,
         coalesce(nullif(btrim(p.phone), ''), nullif(btrim(ep.guest_phone), ''))
    FROM event_participants ep
    JOIN events e ON e.id = ep.event_id
    LEFT JOIN profiles p ON p.id = ep.user_id
   WHERE ep.event_id = p_event_id
     AND e.require_phone
     AND can_manage_squad(p_event_id)
     AND coalesce(nullif(btrim(p.phone), ''), nullif(btrim(ep.guest_phone), '')) IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION telefony_skladu(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION telefony_skladu(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. Własny numer: odczyt i zapis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION moj_telefon()
RETURNS TABLE (phone TEXT, phone_consent BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone, p.phone_consent FROM profiles p WHERE p.id = auth.uid();
$$;

-- Zapis przez funkcję, nie `upsert`: `INSERT … ON CONFLICT DO UPDATE` wymaga
-- SELECT-a na kolumnach czytanych z EXCLUDED, a po (7) `phone` nie jest już
-- czytelne przez API. Pusty numer kasuje numer i zgodę razem — ta sama reguła,
-- którą `/profil` stosował po swojej stronie.
CREATE OR REPLACE FUNCTION zapisz_moj_telefon(p_telefon TEXT, p_zgoda BOOLEAN DEFAULT false)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ja uuid := auth.uid();
  v_telefon text := nullif(btrim(coalesce(p_telefon, '')), '');
BEGIN
  IF v_ja IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany';
  END IF;
  IF v_telefon IS NOT NULL AND NOT telefon_poprawny(v_telefon) THEN
    RAISE EXCEPTION 'Nieprawidłowy numer telefonu';
  END IF;

  INSERT INTO profiles (id, phone, phone_consent)
  VALUES (v_ja, v_telefon, v_telefon IS NOT NULL AND coalesce(p_zgoda, false))
  ON CONFLICT (id) DO UPDATE
    SET phone = EXCLUDED.phone,
        phone_consent = EXCLUDED.phone_consent;
END;
$$;

REVOKE ALL ON FUNCTION moj_telefon() FROM PUBLIC;
REVOKE ALL ON FUNCTION zapisz_moj_telefon(TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION moj_telefon() TO authenticated;
GRANT EXECUTE ON FUNCTION zapisz_moj_telefon(TEXT, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Numer z profilu przestaje być czytelny dla wszystkich
-- ---------------------------------------------------------------------------
-- Lista kolumn liczona z katalogu, nie wpisana na sztywno: `profiles` to
-- tabela, którą na świeżym projekcie Supabase potrafi założyć quickstart
-- (patrz `005`), więc produkcja może mieć kolumny, których repo nie zna —
-- sztywna lista odebrałaby je po cichu. DOKŁADASZ KOLUMNĘ DO `profiles` →
-- dopisz GRANT SELECT na niej, inaczej będzie zawsze pusta (tak jak w `127`).
DO $$
DECLARE
  v_kolumny text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_kolumny
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'profiles'
     AND column_name NOT IN ('phone', 'phone_consent');

  REVOKE SELECT ON profiles FROM anon, authenticated;
  EXECUTE format('GRANT SELECT (%s) ON profiles TO anon, authenticated', v_kolumny);
END;
$$;
