-- 084: Powiadom istniejące/nowe konto o niepotwierdzonym wpisie gościa
--
-- Problem. Ktoś zapisuje się na mecz jako gość (imię + e-mail, bez logowania),
-- a pod tym e-mailem od dawna istnieje konto — albo dopiero za chwilę je
-- założy, osobno, bez związku z tym meczem. W obu przypadkach wpis gościa
-- czeka na przejęcie linkiem (`claim_token`, migracja `066`), ale nikt mu o tym
-- nie mówi — trzeba trafić na link ręcznie.
--
-- Rozwiązanie. Dwa triggery po obu stronach tego samego skojarzenia po
-- e-mailu:
--   A) nowy wpis gościa -> jeśli e-mail pasuje do JUŻ ISTNIEJĄCEGO konta,
--      powiadomienie trafia do tego konta od razu.
--   B) nowe konto -> jeśli e-mail pasuje do JUŻ ISTNIEJĄCYCH nieprzejętych
--      wpisów gościa, powiadomienie(a) trafiają do świeżo założonego konta.
--
-- Świadomie BEZ automatycznego przejęcia. Przejęcie nadal wymaga kliknięcia
-- w link i `auth.uid()` (funkcja `przejmij_wpis_goscia`, migracja `066`) —
-- inaczej ktokolwiek wpisujący cudzy e-mail w formularzu gościa mógłby
-- podpiąć dowolny mecz pod nieswoje konto bez żadnej weryfikacji. To tylko
-- powiadomienie z gotowym linkiem; przejęcie jest osobną, świadomą decyzją
-- właściciela konta.

-- ============================================================================
-- Kolumna z tokenem, żeby powiadomienie mogło zbudować link przejęcia
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS claim_token uuid;

COMMENT ON COLUMN notifications.claim_token IS
  'Dla typu niepotwierdzony_wpis_goscia — token do /gracz/przejmij/[token]';

-- Trigger B (poniżej) przeszukuje po e-mailu wszystkie nieprzejęte wpisy
-- gościa — bez indeksu byłby to skan całej tabeli przy każdej rejestracji.
CREATE INDEX IF NOT EXISTS idx_participants_guest_email_unclaimed
  ON event_participants (lower(guest_email))
  WHERE is_guest = true AND user_id IS NULL AND claim_token IS NOT NULL;

-- ============================================================================
-- A) Nowy wpis gościa -> istniejące konto z tym samym e-mailem
-- ============================================================================

CREATE OR REPLACE FUNCTION powiadom_istniejace_konto_o_wpisie_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tytul   text;
BEGIN
  IF NOT (NEW.is_guest AND NEW.guest_email IS NOT NULL AND NEW.claim_token IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(NEW.guest_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(title, sport) INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
  VALUES (
    v_user_id,
    'niepotwierdzony_wpis_goscia',
    'Masz niepotwierdzony zapis na mecz',
    coalesce(v_tytul, 'mecz') || ' — to Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
    NEW.event_id,
    NEW.claim_token
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_istniejace_konto ON event_participants;
CREATE TRIGGER trg_powiadom_istniejace_konto
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_istniejace_konto_o_wpisie_goscia();

-- ============================================================================
-- B) Nowe konto -> istniejące nieprzejęte wpisy gościa z tym samym e-mailem
-- ============================================================================

CREATE OR REPLACE FUNCTION powiadom_o_niepotwierdzonych_wpisach_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ep.event_id, ep.claim_token, coalesce(e.title, e.sport) AS tytul
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
     WHERE ep.is_guest = true
       AND ep.user_id IS NULL
       AND ep.claim_token IS NOT NULL
       AND ep.guest_email IS NOT NULL
       AND lower(ep.guest_email) = lower(NEW.email)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
    VALUES (
      NEW.id,
      'niepotwierdzony_wpis_goscia',
      'Masz niepotwierdzony zapis na mecz',
      coalesce(r.tytul, 'mecz') || ' — to Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
      r.event_id,
      r.claim_token
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_niepotwierdzonych_wpisach ON auth.users;
CREATE TRIGGER trg_powiadom_o_niepotwierdzonych_wpisach
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_niepotwierdzonych_wpisach_goscia();
