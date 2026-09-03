-- 131 — uczestnik nie awansuje się sam
--
-- DLACZEGO. Polityka „Own participation update" (migracja `053`) brzmi
-- `auth.uid() = user_id` — „możesz zmieniać swój wiersz" — i nie mówi, KTÓRE
-- kolumny. Postgres nie umie zawęzić RLS do kolumn, więc „swój wiersz" znaczy
-- dziś wszystkie jego pola. Sprawdzone na bazie produkcyjnej, w transakcji
-- zakończonej ROLLBACK-iem: jeden UPDATE ustawia
-- `pending_approval = false, is_reserve = false, has_paid = true`
-- i baza aktualizuje wiersz. Bojo nie ma backendu — przeglądarka rozmawia
-- z PostgREST-em bezpośrednio, a klucz `anon` siedzi jawnie w paczce JS
-- (AGENTS.md), więc do takiego zapytania wystarczy konsola przeglądarki.
--
-- Co to łamie: akceptację zapisów (gracz wyciąga się z poczekalni sam),
-- twardy limit miejsc (rezerwowy przeskakuje kolejkę ponad `max_players`)
-- i rozliczenie (uczestnik odhacza sobie wpłatę).
--
-- Ta sama luka jest na INSERT: polityka „Join or organiser or delegate adds
-- guest" też dopuszcza `auth.uid() = user_id`, więc spreparowany wiersz omija
-- zahartowane `dolacz_do_meczu()` (migracja `078`), które jako jedyne liczy
-- `pending_approval` i `czy_na_rezerwe()` po stronie bazy.
--
-- DRUGA POŁOWA TEJ SAMEJ DZIURY NIE WYMAGA NICZYJEJ ZŁEJ WOLI. Ścieżka
-- „Obserwuję" → „Gram" (`confirmFromMaybe` w `lib/events.ts`) pytała bazę
-- o wolne miejsce i dopiero osobnym zapytaniem zapisywała `is_reserve=false`.
-- To jest dokładnie ten wyścig, który `dolacz_do_meczu()` już raz usunął dla
-- zwykłego „Dołącz" („między liczeniem a wstawianiem mogło wejść dwóch graczy
-- naraz i obaj dostawali to samo ostatnie miejsce"). Dwie osoby obserwujące
-- mecz z jednym wolnym miejscem, klikające w tej samej sekundzie, lądowały
-- obie w składzie. Ta migracja dokłada `potwierdz_udzial()`, czyli lustro
-- `dolacz_do_meczu()` dla tej ścieżki.
--
-- JAK ROZPOZNAJEMY ZAUFANEGO ROZMÓWCĘ. Wyzwalacz jest CELOWO bez
-- `SECURITY DEFINER`, więc `current_user` mówi, kto naprawdę pisze:
--   * zapis prosto z przeglądarki (PostgREST) → `authenticated` albo `anon`,
--   * zapis ze środka funkcji `SECURITY DEFINER` (wszystkie należą do
--     `postgres`) → `postgres`,
--   * funkcje brzegowe → `service_role`.
-- Sprawdzone empirycznie na produkcji: ten sam wyzwalacz widzi `authenticated`
-- przy bezpośrednim UPDATE i `postgres` w środku `sync_reserve_claim()`.
-- Dzięki temu NIE trzeba dotykać ani jednej istniejącej funkcji — nie ma jak
-- rozjechać ich treści przy przepisywaniu.
--
-- Migracja jest IDEMPOTENTNA (wzorzec z `118_rezerwa_czas_w_minutach.sql`):
-- można ją puścić drugi raz i nie zostawia stanu połowicznego.

-- ---------------------------------------------------------------------------
-- 1. Kto zarządza cudzym wpisem
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.czy_zarzadza_wpisem(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() = (SELECT organizer_id FROM events WHERE id = p_event_id)
      OR can_manage_squad(p_event_id)
      OR can_manage_payments(p_event_id)
      OR czy_admin();
$$;

-- ---------------------------------------------------------------------------
-- 2. Wyzwalacz
-- ---------------------------------------------------------------------------
-- Świadomie BEZ `SECURITY DEFINER` — patrz nagłówek. Wyjątki lecą z kodem
-- `insufficient_privilege` (42501), bo PostgREST tłumaczy go na HTTP 403,
-- a `supabase/test/rls.sql` łapie go istniejącym pomocnikiem
-- `_oczekuj_odmowe()`. Cisza byłaby tu najgorszą odpowiedzią: pułapka
-- „RLS po cichu unieważnia UPDATE" (AGENTS.md) polega właśnie na tym, że
-- odbity zapis wygląda jak udany.
CREATE OR REPLACE FUNCTION public.pilnuj_wlasnego_wpisu()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wymaga boolean;
  v_org    uuid;
BEGIN
  -- Zaufani rozmówcy: funkcje SECURITY DEFINER (`postgres`), funkcje brzegowe
  -- (`service_role`), migracje i SQL Editor (superuser). Reguły niżej dotyczą
  -- wyłącznie tego, co przychodzi wprost z przeglądarki.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- Organizator, delegat i administrator — bez zmian, pełne uprawnienia.
  IF czy_zarzadza_wpisem(NEW.event_id) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- O tych polach decyduje BAZA, nie przeglądarka. Zamiast blokować surowy
    -- INSERT (co zepsułoby `joinEventMaybe()`), nadpisujemy je tą samą regułą,
    -- którą stosuje `dolacz_do_meczu()` — więc obie drogi dają ten sam wynik.
    SELECT require_approval, organizer_id
      INTO v_wymaga, v_org
      FROM events WHERE id = NEW.event_id;

    NEW.pending_approval := COALESCE(v_wymaga, false) AND auth.uid() IS DISTINCT FROM v_org;
    NEW.is_reserve := CASE
      -- „Obserwuję" nie zajmuje miejsca w składzie (patrz docs/domena.md).
      WHEN NEW.rsvp = 'maybe'   THEN true
      -- Poczekalnia nie jest rezerwą — tak samo liczy `dolacz_do_meczu()`.
      WHEN NEW.pending_approval THEN false
      ELSE czy_na_rezerwe(NEW.event_id, COALESCE(NEW.is_goalkeeper, false))
    END;
    NEW.has_paid        := false;
    NEW.paid_amount     := 0;
    NEW.is_captain      := false;
    NEW.team            := NULL;
    NEW.claim_offered_at := NULL;
    NEW.claim_passed    := false;
    RETURN NEW;
  END IF;

  -- UPDATE cudzego wiersza — takiej ścieżki nie ma.
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

  -- Rezerwa. Jedyne dozwolone samodzielne wyjście ze stanu „rezerwa" to
  -- PRZYJĘCIE STOJĄCEJ OFERTY zwolnionego miejsca — czyli dokładnie reguła
  -- „oferta, nie auto-awans" z docs/domena.md. Tędy przechodzi
  -- `acceptReserveClaim()`; wejście do składu z pominięciem oferty (dawne
  -- `confirmFromMaybe`) idzie teraz przez `potwierdz_udzial()` niżej.
  IF NEW.is_reserve IS DISTINCT FROM OLD.is_reserve THEN
    IF NOT (OLD.is_reserve
            AND NOT NEW.is_reserve
            AND OLD.claim_offered_at IS NOT NULL
            AND OLD.claim_passed IS NOT TRUE) THEN
      RAISE EXCEPTION 'Miejsce w składzie przydziela organizator albo oferta z rezerwy'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Ofertę wystawia Bojo (`sync_reserve_claim`), nie gracz. Przepuścić wolno
  -- wyłącznie ofertę, która już stoi — to jest `declineReserveClaim()`.
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
-- 3. „Obserwuję" → „Gram" w jednej transakcji
-- ---------------------------------------------------------------------------
-- Lustro `dolacz_do_meczu()` (`078`) dla osoby, która JUŻ ma wiersz z
-- `rsvp = 'maybe'`. Liczenie pojemności i zapis muszą być jedną transakcją —
-- inaczej wraca wyścig opisany w nagłówku.
CREATE OR REPLACE FUNCTION public.potwierdz_udzial(
  p_uczestnik        uuid,
  p_bramkarz         boolean,
  p_metoda_platnosci text,
  p_karta_sportowa   boolean,
  p_dostawca_karty   text
)
RETURNS TABLE (is_reserve boolean, pending boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_event    uuid;
  v_rsvp     text;
  v_odwolany boolean;
  v_rezerwa  boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby potwierdzić udział';
  END IF;

  SELECT p.event_id, p.rsvp INTO v_event, v_rsvp
    FROM event_participants p
   WHERE p.id = p_uczestnik AND p.user_id = v_user;

  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego wpisu';
  END IF;
  IF v_rsvp IS DISTINCT FROM 'maybe' THEN
    RAISE EXCEPTION 'Ten wpis nie jest oznaczony jako „Obserwuję"';
  END IF;

  SELECT status = 'cancelled' INTO v_odwolany FROM events WHERE id = v_event;
  IF v_odwolany THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Wygasłe oferty muszą przepaść ZANIM policzymy pojemność — ta sama
  -- kolejność co w `dolacz_do_meczu()`.
  PERFORM sync_reserve_claim(v_event);
  v_rezerwa := czy_na_rezerwe(v_event, COALESCE(p_bramkarz, false));

  UPDATE event_participants
     SET rsvp                 = 'yes',
         is_reserve           = v_rezerwa,
         is_goalkeeper        = COALESCE(p_bramkarz, false),
         payment_method       = p_metoda_platnosci,
         has_sports_card      = COALESCE(p_karta_sportowa, false),
         sports_card_provider = CASE WHEN p_karta_sportowa THEN p_dostawca_karty ELSE NULL END
   WHERE id = p_uczestnik;

  -- `pending` zawsze false: kto obserwował mecz, ma już wiersz w składzie,
  -- więc akceptacja zapisu została rozstrzygnięta przy dołączaniu.
  RETURN QUERY SELECT v_rezerwa, false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.potwierdz_udzial(uuid, boolean, text, boolean, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.potwierdz_udzial(uuid, boolean, text, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. „Uczestnicy mogą dodawać gości" wreszcie działa
-- ---------------------------------------------------------------------------
-- ZNALEZIONE PRZY OKAZJI, sprawdzone na produkcji (transakcja + ROLLBACK):
-- przełącznik `allow_guest_adds` nie działał NIGDY. Polityka INSERT dopuszcza
-- `auth.uid() = user_id`, a wiersz gościa ma `user_id IS NULL`, więc warunek
-- wychodzi NULL; pozostałe gałęzie to organizator, delegat i admin. Uczestnik
-- widział pole „Dopisz osobę bez konta" (`EventDetailClient.tsx`, warunek
-- `!isOrganizer && !canManageSquad && event.allowGuestAdds`), wpisywał imię
-- i dostawał czerwony komunikat o polityce. Organizator włączał przełącznik,
-- aplikacja potwierdzała „Uczestnicy mogą teraz dodawać gości" — i to była
-- nieprawda.
--
-- Dokładamy WĄSKĄ gałąź: wiersz musi być gościem bez konta, dopisanym przez
-- osobę, która sama jest w składzie tego meczu, a mecz musi mieć włączony
-- przełącznik. `pending_approval` i `is_reserve` takiego wiersza i tak
-- przelicza wyzwalacz wyżej, więc tą drogą nie da się wejść do składu ponad
-- limit ani ominąć akceptacji (migracja `115`).
--
-- Warunek siedzi w funkcji `SECURITY DEFINER`, a nie wprost w polityce, bo
-- zagląda do `event_participants` — tej samej tabeli. Tak samo rozwiązane są
-- `can_manage_squad()` i `czy_czlonek_grupy()`.
CREATE OR REPLACE FUNCTION public.czy_moze_dopisac_goscia(p_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM events e
                  WHERE e.id = p_event_id AND e.allow_guest_adds)
     AND EXISTS (SELECT 1 FROM event_participants p
                  WHERE p.event_id = p_event_id
                    AND p.user_id = auth.uid()
                    AND NOT p.pending_approval);
$$;

DROP POLICY IF EXISTS "Join or organiser or delegate adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest" ON event_participants
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_participants.event_id)
    OR can_manage_squad(event_id)
    OR czy_admin()
    OR (is_guest AND user_id IS NULL AND added_by = auth.uid()
        AND czy_moze_dopisac_goscia(event_id))
  );
