-- 066_przejecie_wpisu_goscia.sql
--
-- Pozwala osobie dopisanej ręcznie jako gość przejąć swój wpis po założeniu
-- konta — zamiast zaczynać od zera i mieć w składzie dwie pozycje o tym samym
-- imieniu.
--
-- Problem. Organizator dopisuje „Marek" i tyle: wpis nie ma `user_id`, więc
-- nie należy do nikogo. Marek zakłada konto, dołącza — i w składzie jest teraz
-- „Marek" (gość) oraz „Marek Nowak" (konto). Organizator musi ręcznie usunąć
-- jednego, a historia gier Marka zaczyna się od pustej karty.
--
-- Dlaczego token, a nie samo dopasowanie po imieniu. Imię nie jest tożsamością:
-- na osiedlowym meczu bywa trzech Marków, a przejęcie cudzego wpisu oznacza
-- przejęcie cudzego miejsca w składzie i cudzej historii. Token jest losowy,
-- jednorazowy i wędruje kanałem, który wybrał organizator (SMS, czat) — kto go
-- ma, dostał go od osoby, która wie, kogo dopisała.
--
-- Przejęcie robi funkcja z SECURITY DEFINER, bo wpis gościa z definicji nie
-- należy jeszcze do nikogo — żadna polityka RLS oparta na `auth.uid()` nie
-- mogłaby go przepuścić.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at  timestamptz;

-- Token służy do wyszukania jednego wiersza — bez indeksu byłoby to skanowanie
-- całej tabeli przy każdym kliknięciu w link.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_claim_token
  ON event_participants (claim_token)
  WHERE claim_token IS NOT NULL;

-- Token powstaje sam przy dopisywaniu gościa. Gdyby zakładał go frontend,
-- losowość zależałaby od przeglądarki, a starsze wpisy zostałyby bez tokenu.
CREATE OR REPLACE FUNCTION nadaj_token_gosciowi()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_guest AND NEW.user_id IS NULL AND NEW.claim_token IS NULL THEN
    NEW.claim_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nadaj_token_gosciowi ON event_participants;
CREATE TRIGGER trg_nadaj_token_gosciowi
  BEFORE INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION nadaj_token_gosciowi();

-- Tokeny dla gości dopisanych przed tą migracją.
UPDATE event_participants
   SET claim_token = gen_random_uuid()
 WHERE is_guest AND user_id IS NULL AND claim_token IS NULL;

-- ---------------------------------------------------------------------------
-- Podgląd zaproszenia — co zobaczy klikający, zanim się zaloguje
-- ---------------------------------------------------------------------------
-- Zwraca tylko to, co potrzebne do decyzji „czy to o mnie": imię z wpisu oraz
-- mecz. Nie zwraca składu ani niczego o innych uczestnikach.
CREATE OR REPLACE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie        text,
  event_id    uuid,
  tytul       text,
  data_meczu  date,
  godzina     time,
  miejsce     text,
  juz_przejety boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         e.id,
         coalesce(e.title, e.sport),
         e.event_date,
         e.event_time,
         e.field_name,
         (p.claimed_at IS NOT NULL OR p.user_id IS NOT NULL)
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Przejęcie wpisu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION przejmij_wpis_goscia(p_token uuid, p_nazwa text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_event    uuid;
  v_zajety   boolean;
  v_duplikat boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby przejąć wpis.';
  END IF;

  SELECT id, event_id, (claimed_at IS NOT NULL OR user_id IS NOT NULL)
    INTO v_id, v_event, v_zajety
    FROM event_participants
   WHERE claim_token = p_token;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nieznany albo nieaktualny link.';
  END IF;

  -- Token jest jednorazowy. Bez tego drugi kliknięty link przepisywałby wpis
  -- na kolejną osobę, cicho odbierając go pierwszej.
  IF v_zajety THEN
    RAISE EXCEPTION 'Ten wpis został już przejęty.';
  END IF;

  -- Kto jest już w tym meczu na własnym koncie, nie może dobrać sobie drugiego
  -- miejsca przez wpis gościa.
  SELECT EXISTS (
    SELECT 1 FROM event_participants
     WHERE event_id = v_event AND user_id = auth.uid()
  ) INTO v_duplikat;

  IF v_duplikat THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz na swoim koncie.';
  END IF;

  UPDATE event_participants
     SET user_id    = auth.uid(),
         is_guest   = false,
         name       = coalesce(nullif(trim(p_nazwa), ''), name),
         claimed_at = now(),
         claim_token = NULL
   WHERE id = v_id;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
REVOKE ALL ON FUNCTION przejmij_wpis_goscia(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION przejmij_wpis_goscia(uuid, text) TO authenticated;
