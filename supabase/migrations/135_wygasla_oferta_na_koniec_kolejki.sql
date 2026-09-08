-- 135 — wygasła oferta wraca na koniec kolejki; odpuszczenie nadal wypada
--
-- DLACZEGO. Bojo obiecywało rezerwowemu coś, czego baza nie dotrzymywała.
-- Okno „Odpuszczasz to miejsce?" mówiło wprost:
--
--     „Zostajesz na rezerwie, ale za nią — kolejna oferta przyjdzie dopiero,
--      gdy zwolni się następne miejsce."
--
-- a `declineReserveClaim()` ustawiało `claim_passed = true`, natomiast
-- `sync_reserve_claim()` szuka kandydata z `claim_passed = false`. Kolejnej
-- oferty NIE BYŁO NIGDY — flagę zerowała wyłącznie ręczna akcja organizatora.
--
-- Gorsza połowa tego samego błędu NIE WYMAGAŁA ŻADNEJ DECYZJI GRACZA:
-- wygaśnięcie oferty (migracja `118`) ustawiało DOKŁADNIE TO SAMO pole. Kto nie
-- zdążył odpowiedzieć w oknie (domyślnie 3 h) — bo spał, pracował albo nie miał
-- zasięgu — wypadał z kolejki na zawsze, bez jednego słowa. Organizator tracił
-- rezerwowego po jednym nieodebranym powiadomieniu i nie miał jak się o tym
-- dowiedzieć.
--
-- DECYZJA WŁAŚCICIELA (2026-09-08): to są DWIE RÓŻNE RZECZY i mają dawać różny
-- skutek.
--   * „Odpuszczam" — świadoma odmowa. Wypada z kolejki. `claim_passed` zostaje
--     dokładnie tym, czym był, i dotyczy odtąd WYŁĄCZNIE tego przypadku.
--   * Wygaśnięcie — brak odpowiedzi, nie odmowa. Ląduje na KOŃCU kolejki, ale
--     zostaje w grze.
--
-- JAK. Nowa kolumna `oferta_wygasla_at` zamiast dociążania `claim_passed`
-- drugim znaczeniem. Kolejność kolejki:
--
--     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
--
-- czyli: najpierw nigdy nieominięci w kolejności zapisu, za nimi ominięci —
-- a wśród nich ten, którego ominięto NAJDAWNIEJ (czeka najdłużej). Ponowne
-- wygaśnięcie odsuwa dalej, więc kolejka nie zapętla się na jednej osobie.
--
-- CISZA PRZY WYGAŚNIĘCIU TEŻ BYŁA BŁĘDEM. Gracz nie dostawał niczego. Nowy typ
-- powiadomienia `oferta_wygasla` mówi, co się stało i że kolejka trwa.
--
-- PRZY OKAZJI, DRUGA NIEPRAWDA (`076`): `powiadom_o_odrzuceniu_prosby()`
-- sprawdzało tylko `OLD.pending_approval` i `OLD.user_id`, a NIE sprawdzało,
-- KTO usuwa wiersz. Przycisk „Anuluj" w banerze „Oczekujesz na akceptację"
-- woła ten sam DELETE co odrzucenie przez organizatora, więc gracz, który sam
-- wycofał prośbę, dostawał do dzwonka i na telefon: „Organizator nie przyjął
-- Twojej prośby". Bojo obciążało organizatora decyzją, której nie podjął.
--
-- MIGRACJA JEST IDEMPOTENTNA (wzorzec `118`). Backfill zbędny: na produkcji jest
-- dziś jeden wiersz z `claim_passed` i zero stojących ofert.

-- ---------------------------------------------------------------------------
-- 1. Kolumna
-- ---------------------------------------------------------------------------
ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS oferta_wygasla_at TIMESTAMPTZ;

COMMENT ON COLUMN event_participants.oferta_wygasla_at IS
  'Kiedy ostatnio WYGASŁA oferta zwolnionego miejsca (brak odpowiedzi w czasie z reserve_claim_minutes). Odsuwa na koniec kolejki rezerwowej, ale w niej zostawia. NIE mylić z claim_passed, które znaczy świadome „Odpuszczam" i wypada z kolejki na stałe.';

-- Kolejka czyta te kolumny przy każdym wejściu na stronę meczu.
CREATE INDEX IF NOT EXISTS idx_uczestnicy_kolejka_rezerwy
  ON event_participants (event_id, is_reserve, claim_passed, oferta_wygasla_at, zapisano_at)
  WHERE is_reserve = true;

-- ---------------------------------------------------------------------------
-- 2. sync_reserve_claim — ciało z `130`, zmienione w trzech miejscach:
--    wygaśnięcie, kolejność kolejki, powiadomienie o wygaśnięciu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_czas text;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_minutes, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= teraz_pl() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_minutes, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_minutes IS NULL OR v_started THEN RETURN; END IF;

  v_czas := CASE
    WHEN v_minutes < 60 THEN v_minutes || ' min.'
    WHEN v_minutes % 60 = 0 THEN (v_minutes / 60) || ' godz.'
    ELSE (v_minutes / 60) || ' godz. ' || (v_minutes % 60) || ' min.'
  END;

  -- WYGAŚNIĘCIE. Było: `claim_passed = true`, czyli to samo co świadome
  -- „Odpuszczam" — i wypadnięcie z kolejki na zawsze za nieodebrany telefon.
  -- Jest: znacznik czasu, który odsuwa na koniec kolejki. I powiadomienie,
  -- bo dotąd znikało się stąd w całkowitej ciszy.
  WITH wygasle AS (
    UPDATE event_participants
       SET oferta_wygasla_at = now(), claim_offered_at = NULL
     WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
       AND claim_offered_at + (v_minutes || ' minutes')::interval <= now()
    RETURNING user_id
  )
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT user_id, 'oferta_wygasla', v_title,
         'Czas na przyjęcie miejsca minął, więc poszło do kolejnej osoby. '
         || 'Zostajesz na liście rezerwowej, na jej końcu — przy następnym '
         || 'zwolnionym miejscu dostaniesz kolejną ofertę.',
         p_event_id
    FROM wygasle WHERE user_id IS NOT NULL;

  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     -- Nigdy nieominięci najpierw, w kolejności zapisu. Za nimi ominięci —
     -- najdawniej ominięty pierwszy, bo czeka najdłużej.
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', v_title,
              'Zwolniło się miejsce. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
    END IF;
  END IF;

  IF czy_na_rezerwe(p_event_id, true) IS FALSE THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', v_title,
              'Zwolniło się miejsce dla bramkarza. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. `oferta_wygasla_at` ustawia Bojo, nie przeglądarka
-- ---------------------------------------------------------------------------
-- Dopisek do wyzwalacza z migracji `132`. Bez tego gracz mógłby wyzerować sobie
-- znacznik jednym UPDATE-em z konsoli i wrócić na początek kolejki — klucz
-- `anon` siedzi jawnie w paczce JS (AGENTS.md), więc to nie jest teoria.
-- Reszta ciała bez zmian względem `132`.
CREATE OR REPLACE FUNCTION public.pilnuj_wlasnego_wpisu()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wymaga boolean;
  v_org    uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  IF czy_zarzadza_wpisem(NEW.event_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT require_approval, organizer_id
      INTO v_wymaga, v_org
      FROM events WHERE id = NEW.event_id;

    NEW.pending_approval := COALESCE(v_wymaga, false) AND auth.uid() IS DISTINCT FROM v_org;
    NEW.is_reserve := CASE
      WHEN NEW.rsvp = 'maybe'   THEN true
      WHEN NEW.pending_approval THEN false
      ELSE czy_na_rezerwe(NEW.event_id, COALESCE(NEW.is_goalkeeper, false))
    END;
    NEW.has_paid        := false;
    NEW.paid_amount     := 0;
    NEW.is_captain      := false;
    NEW.team            := NULL;
    NEW.claim_offered_at := NULL;
    NEW.claim_passed    := false;
    NEW.oferta_wygasla_at := NULL;
    RETURN NEW;
  END IF;

  IF auth.uid() IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Nie możesz zmieniać cudzego wpisu'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.has_paid IS DISTINCT FROM OLD.has_paid
     OR NEW.paid_amount IS DISTINCT FROM OLD.paid_amount THEN
    RAISE EXCEPTION 'Wpłatę odhacza organizator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.pending_approval IS DISTINCT FROM OLD.pending_approval THEN
    RAISE EXCEPTION 'Zapis akceptuje organizator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.team IS DISTINCT FROM OLD.team
     OR NEW.is_captain IS DISTINCT FROM OLD.is_captain THEN
    RAISE EXCEPTION 'Drużyny i kapitanów ustawia organizator'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.event_id IS DISTINCT FROM OLD.event_id
     OR NEW.is_guest IS DISTINCT FROM OLD.is_guest
     OR NEW.added_by IS DISTINCT FROM OLD.added_by THEN
    RAISE EXCEPTION 'Tego pola nie zmienia się z aplikacji'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- NOWE: miejsce w kolejce po wygasłej ofercie. Ustawia je wyłącznie
  -- `sync_reserve_claim()` (`SECURITY DEFINER`, czyli `postgres`), więc każda
  -- zmiana przychodząca wprost z przeglądarki jest próbą przeskoczenia kolejki.
  IF NEW.oferta_wygasla_at IS DISTINCT FROM OLD.oferta_wygasla_at THEN
    RAISE EXCEPTION 'Miejsce w kolejce rezerwowej ustala Bojo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.is_reserve IS DISTINCT FROM OLD.is_reserve THEN
    IF NOT (OLD.is_reserve
            AND NOT NEW.is_reserve
            AND OLD.claim_offered_at IS NOT NULL
            AND OLD.claim_passed IS NOT TRUE) THEN
      RAISE EXCEPTION 'Miejsce w składzie przydziela organizator albo oferta z rezerwy'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.claim_offered_at IS DISTINCT FROM OLD.claim_offered_at
     AND NEW.claim_offered_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ofertę miejsca wystawia Bojo'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NEW.claim_passed IS DISTINCT FROM OLD.claim_passed
     AND NOT (OLD.claim_offered_at IS NOT NULL AND NEW.claim_passed) THEN
    RAISE EXCEPTION 'Nie ma oferty do przepuszczenia'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_wlasnego_wpisu ON event_participants;
CREATE TRIGGER trg_pilnuj_wlasnego_wpisu
  BEFORE INSERT OR UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION pilnuj_wlasnego_wpisu();

-- ---------------------------------------------------------------------------
-- 4. Anulowanie WŁASNEJ prośby to nie odrzucenie przez organizatora
-- ---------------------------------------------------------------------------
-- Ciało z `076`, dołożony jeden warunek. `auth.uid()` jest tu wiarygodne:
-- wyzwalacz jest `SECURITY DEFINER`, ale `auth.uid()` czyta ustawienie sesji
-- PostgREST-a, czyli tożsamość TEGO, kto wysłał żądanie.
CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;

  -- Gracz wycofał prośbę sam (przycisk „Anuluj" w banerze „Oczekujesz na
  -- akceptację" woła ten sam DELETE co odrzucenie przez organizatora).
  -- Powiadomienie „Organizator nie przyjął Twojej prośby" byłoby wtedy
  -- nieprawdą — i to nieprawdą obciążającą organizatora.
  IF auth.uid() IS NOT DISTINCT FROM OLD.user_id THEN RETURN OLD; END IF;

  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_odrzuceniu_prosby ON event_participants;
CREATE TRIGGER trg_powiadom_o_odrzuceniu_prosby
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_odrzuceniu_prosby();
