-- 137 — poczta do gościa mówi prawdę i dociera tam, gdzie obiecała
--
-- Trzy dziury w kanale z migracji `133`, wszystkie o tym samym: Bojo pisało do
-- gościa bez konta rzeczy, których nie dotrzymywało, albo nie pisało wcale.
--
-- 1. „MASZ MIEJSCE W SKŁADZIE" DO KOGOŚ, KTO GO NIE MA.
--    `dolacz_do_meczu_jako_goscie()` (`115`) ustawia przy meczu z akceptacją
--    `pending_approval = true, is_reserve = false`. `wyslij_mail_do_goscia()`
--    ODCZYTYWAŁO `pending_approval` do rekordu i NIE PRZEKAZYWAŁO go dalej —
--    funkcja brzegowa widziała tylko `na_rezerwie = false` i pisała „Masz
--    miejsce w składzie". Gość w poczekalni dostawał potwierdzenie miejsca,
--    którego mógł nigdy nie dostać.
--
-- 2. O ROZPATRZENIU PROŚBY GOŚĆ NIE DOWIADYWAŁ SIĘ W OGÓLE.
--    `powiadom_o_akceptacji` (`076`) wymaga `NEW.user_id IS NOT NULL`,
--    `powiadom_o_odrzuceniu_prosby` tak samo — a poczta z `133` nie miała
--    takiego powodu. Jedyną drogą było wracanie na `/gracz/przejmij/{token}`
--    i sprawdzanie. Organizator klikał „Akceptuj" i nic się nie działo.
--
-- 3. GOŚĆ NA REZERWIE NIE DOSTAWAŁ OFERTY NIGDY — a mail obiecywał, że dostanie.
--    `sync_reserve_claim()` filtruje `user_id IS NOT NULL`, bo oferta szła
--    wyłącznie przez `notifications`, a ta wymaga konta. Wpis gościa stał
--    w kolejce i był OMIJANY BEZ ŚLADU: kolejka przeskakiwała go i szła do
--    następnej osoby z kontem, a gdy w kolejce byli sami goście — nie robiła
--    nic. Jednocześnie mail `zapis` mówił mu wprost: „Damy znać, gdy zwolni się
--    miejsce".
--
--    Skutki brał na siebie organizator: jego lista rezerwowa nie działała
--    dokładnie w tej części, którą sam przyprowadził, a on nie miał jak się
--    o tym dowiedzieć.
--
--    Kanał pocztowy z `133` usuwa powód istnienia tego filtra — oferta może
--    pójść mailem. Gość BEZ ADRESU jest dalej pomijany (nie ma jak go
--    zawiadomić), ale przestaje blokować kolejkę i jest widoczny dla
--    organizatora w składzie.
--
-- Migracja jest IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Ładunek niesie stan zapisu
-- ---------------------------------------------------------------------------
-- Ciało z `134` (ostatnia definicja) — dołożone jedno pole w `jsonb_build_object`.
CREATE OR REPLACE FUNCTION wyslij_mail_do_goscia(p_uczestnik UUID, p_powod TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_w      RECORD;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  SELECT p.id, p.name, p.guest_email, p.claim_token, p.is_reserve, p.pending_approval,
         e.id AS event_id, e.title, e.sport, e.event_date, e.event_time,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz,
         -- Do której godziny stoi oferta zwolnionego miejsca. Formatowane tutaj,
         -- bo tylko baza zna `reserve_claim_minutes` i strefę meczu.
         CASE WHEN p.claim_offered_at IS NULL THEN NULL
              ELSE to_char(
                (p.claim_offered_at
                 + (coalesce(e.reserve_claim_minutes, 180) || ' minutes')::interval)
                AT TIME ZONE 'Europe/Warsaw', 'DD.MM, godz. HH24:MI')
         END AS oferta_do
    INTO v_w
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.id = p_uczestnik AND p.is_guest
     AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL;
  IF v_w.id IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO maile_wyslane (uczestnik_id, powod) VALUES (p_uczestnik, p_powod);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod', p_powod, 'email', v_w.guest_email, 'imie', v_w.name,
      'event_id', v_w.event_id, 'tytul', coalesce(v_w.title, v_w.sport),
      'data', to_char(v_w.event_date, 'DD.MM.YYYY'),
      'godzina', to_char(v_w.event_time, 'HH24:MI'),
      'miejsce', v_w.miejsce, 'koszt_grosz', v_w.cost_grosz,
      'na_rezerwie', v_w.is_reserve,
      -- NOWE. Bez tego pola gość w poczekalni czytał „Masz miejsce w składzie".
      'czeka_na_akceptacje', v_w.pending_approval,
      'oferta_do', v_w.oferta_do,
      'token', v_w.claim_token
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_mail_do_goscia(UUID, TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Akceptacja i odrzucenie prośby gościa
-- ---------------------------------------------------------------------------
-- OSOBNE wyzwalacze obok `076`, które zostaje nietknięte — ta sama zasada co
-- w `133`: nie przepisujemy działających funkcji powiadomień.
CREATE OR REPLACE FUNCTION powiadom_goscia_o_akceptacji()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.pending_approval IS TRUE AND NEW.pending_approval IS FALSE
     AND NEW.is_guest AND NEW.guest_email IS NOT NULL AND NEW.claimed_at IS NULL THEN
    PERFORM wyslij_mail_do_goscia(NEW.id, 'zaakceptowano');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_goscia_o_akceptacji ON event_participants;
CREATE TRIGGER trg_powiadom_goscia_o_akceptacji
  AFTER UPDATE OF pending_approval ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_goscia_o_akceptacji();

-- Odrzucenie to DELETE, więc mail musi wyjść PRZED usunięciem wiersza —
-- `wyslij_mail_do_goscia()` czyta dane z `event_participants`. Stąd `BEFORE`.
--
-- Wpis do `maile_wyslane` ma `ON DELETE CASCADE`, więc zniknie razem z wierszem;
-- idempotencja nic tu nie traci, bo wiersza i tak już nie będzie.
CREATE OR REPLACE FUNCTION powiadom_goscia_o_odrzuceniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.pending_approval IS TRUE
     AND OLD.is_guest AND OLD.guest_email IS NOT NULL AND OLD.claimed_at IS NULL THEN
    PERFORM wyslij_mail_do_goscia(OLD.id, 'odrzucono');
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_goscia_o_odrzuceniu ON event_participants;
CREATE TRIGGER trg_powiadom_goscia_o_odrzuceniu
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_goscia_o_odrzuceniu();

-- ---------------------------------------------------------------------------
-- 3. Gość z adresem wchodzi do kolejki rezerwowej na równi z kontem
-- ---------------------------------------------------------------------------
-- Ciało z `135`, zmienione w dwóch gałęziach wyboru kandydata:
--   * `user_id IS NOT NULL`  →  `(user_id IS NOT NULL OR guest_email IS NOT NULL)`
--   * oferta trafia do `notifications` (konto) ALBO na maila (gość).
--
-- Wpis gościa BEZ adresu zostaje pominięty — nie ma jak go zawiadomić, a oferta,
-- o której nikt się nie dowie, zablokowałaby kolejkę na cały czas okna.
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
       AND (user_id IS NOT NULL OR guest_email IS NOT NULL)
       AND is_goalkeeper = false
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      IF v_next_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, event_id)
        VALUES (v_next_user, 'reserve_claim_offered', v_title,
                'Zwolniło się miejsce. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
      ELSE
        PERFORM wyslij_mail_do_goscia(v_next_id, 'oferta');
      END IF;
    END IF;
  END IF;

  IF czy_na_rezerwe(p_event_id, true) IS FALSE THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND (user_id IS NOT NULL OR guest_email IS NOT NULL)
       AND is_goalkeeper = true
     ORDER BY (oferta_wygasla_at IS NOT NULL), oferta_wygasla_at, zapisano_at
     LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      IF v_next_user IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, body, event_id)
        VALUES (v_next_user, 'reserve_claim_offered', v_title,
                'Zwolniło się miejsce dla bramkarza. Masz ' || v_czas || ' na przyjęcie.', p_event_id);
      ELSE
        PERFORM wyslij_mail_do_goscia(v_next_id, 'oferta');
      END IF;
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Idempotencja oferty: raz na wpis na DOBĘ to za mało
-- ---------------------------------------------------------------------------
-- `maile_wyslane` ma klucz `(uczestnik_id, powod, dzien)`, więc druga oferta
-- tego samego dnia dla tej samej osoby nie wyszłaby mailem — a to realny
-- przebieg: ktoś wchodzi i wychodzi ze składu kilka razy w dniu meczu.
-- Powód `oferta` dostaje więc własny klucz ze znacznikiem czasu oferty.
--
-- Rozwiązane bez zmiany schematu: kasujemy poprzedni wpis `oferta` dla tego
-- uczestnika, zanim funkcja spróbuje wstawić nowy. Ślad w dzienniku i tak
-- służy wyłącznie deduplikacji w obrębie jednego przebiegu.
CREATE OR REPLACE FUNCTION odswiez_slad_oferty()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.claim_offered_at IS NOT NULL
     AND OLD.claim_offered_at IS DISTINCT FROM NEW.claim_offered_at THEN
    DELETE FROM maile_wyslane
     WHERE uczestnik_id = NEW.id AND powod = 'oferta';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_odswiez_slad_oferty ON event_participants;
CREATE TRIGGER trg_odswiez_slad_oferty
  BEFORE UPDATE OF claim_offered_at ON event_participants
  FOR EACH ROW EXECUTE FUNCTION odswiez_slad_oferty();

-- ---------------------------------------------------------------------------
-- 5. Gość musi mieć JAK przyjąć ofertę
-- ---------------------------------------------------------------------------
-- Bez tego punktu cała sekcja 3 byłaby kolejną obietnicą bez pokrycia: mail
-- mówiłby „zwolniło się miejsce, potwierdź", a strona `/gracz/przejmij/{token}`
-- miała dotąd tylko dwie akcje — „To ja, potwierdzam" (przejęcie wpisu na
-- konto) i „Nie mogę grać, wypisz mnie". Przyjęcia oferty nie było, bo do tej
-- pory gość ofert nie dostawał.
--
-- Uprawnieniem jest token, jak w całym `128`. Reguły odbijania są te same co
-- w `pilnuj_wlasnego_wpisu()` dla konta: wejść do składu można WYŁĄCZNIE
-- z przyjęcia stojącej oferty, nigdy z własnej woli.

-- Podgląd musi powiedzieć, że oferta stoi i do kiedy — inaczej strona po
-- kliknięciu w link z maila wygląda dokładnie tak samo jak przed nim.
DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);
CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie                text,
  event_id            uuid,
  tytul               text,
  data_meczu          date,
  godzina             time,
  miejsce             text,
  juz_przejety        boolean,
  status_meczu        text,
  na_rezerwie         boolean,
  czeka_na_akceptacje boolean,
  koszt_grosze        integer,
  w_skladzie          integer,
  max_graczy          integer,
  mozna_zmieniac      boolean,
  -- Nowe od `137`.
  oferta_do           timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         e.id,
         coalesce(e.title, e.sport),
         e.event_date,
         e.event_time,
         coalesce(e.field_name, e.custom_location_name, e.custom_address, 'Boisko'),
         (p.claimed_at IS NOT NULL OR p.user_id IS NOT NULL),
         e.status,
         coalesce(p.is_reserve, false),
         coalesce(p.pending_approval, false),
         coalesce(e.cost_grosz, 0),
         (SELECT count(*)::int FROM event_participants x
           WHERE x.event_id = e.id AND x.pending_approval IS NOT TRUE
             AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE),
         e.max_players,
         (p.claimed_at IS NULL AND p.user_id IS NULL AND p.is_guest
          AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')),
         CASE WHEN p.claim_offered_at IS NULL THEN NULL
              ELSE p.claim_offered_at
                   + (coalesce(e.reserve_claim_minutes, 180) || ' minutes')::interval
         END
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;

/** Gość przyjmuje zaproponowane miejsce. Lustro `acceptReserveClaim()` dla
 *  wpisu bez konta. */
CREATE OR REPLACE FUNCTION przyjmij_oferte_goscia(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_event uuid;
BEGIN
  SELECT p.id, p.event_id
    INTO v_id, v_event
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token
     AND p.is_guest AND p.claimed_at IS NULL AND p.user_id IS NULL
     AND p.is_reserve
     -- Oferta MUSI stać. Bez tego warunku token byłby przepustką do składu
     -- z pominięciem kolejki — a kolejka jest tym, co organizator obiecał
     -- pozostałym rezerwowym.
     AND p.claim_offered_at IS NOT NULL
     AND p.claim_passed IS NOT TRUE
     AND p.claim_offered_at + (coalesce(e.reserve_claim_minutes, 180) || ' minutes')::interval > now()
     AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw')
     AND e.status <> 'cancelled';

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Ta oferta miejsca już nie jest aktualna.';
  END IF;

  UPDATE event_participants
     SET is_reserve = false, claim_offered_at = NULL, oferta_wygasla_at = NULL
   WHERE id = v_id;

  RETURN v_event;
END;
$$;

/** Gość odpuszcza miejsce. Tak jak przy koncie: odmowa jest OSTATECZNA. */
CREATE OR REPLACE FUNCTION odpusc_oferte_goscia(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_event uuid;
BEGIN
  SELECT p.id, p.event_id
    INTO v_id, v_event
    FROM event_participants p
   WHERE p.claim_token = p_token
     AND p.is_guest AND p.claimed_at IS NULL AND p.user_id IS NULL
     AND p.claim_offered_at IS NOT NULL;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nie ma oferty do odpuszczenia.';
  END IF;

  UPDATE event_participants
     SET claim_offered_at = NULL, claim_passed = true
   WHERE id = v_id;

  -- Miejsce idzie do następnej osoby od razu, a nie dopiero gdy ktoś otworzy
  -- stronę meczu.
  PERFORM sync_reserve_claim(v_event);
  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION przyjmij_oferte_goscia(uuid) FROM public;
REVOKE ALL ON FUNCTION odpusc_oferte_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION przyjmij_oferte_goscia(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION odpusc_oferte_goscia(uuid) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Organizator musi widzieć, kogo kolejka pominie
-- ---------------------------------------------------------------------------
-- Gość BEZ adresu dalej nie dostanie oferty — nie ma jak go zawiadomić. To jest
-- w porządku, ale musi być WIDOCZNE: inaczej organizator patrzy na listę
-- rezerwową, w której część osób nigdy nie zostanie zaproszona, i nie ma skąd
-- o tym wiedzieć. Cicha reguła po stronie bazy to dokładnie ten rodzaj
-- „wątpliwości", którego w fazie 1 nie chcemy.
--
-- Sam `guest_email` jest od migracji `127` NIECZYTELNY przez API i tak zostaje
-- — to dane osobowe kogoś, kto podał adres wyłącznie po to, żeby wejść do
-- składu. Wystawiamy więc wyłącznie FAKT, nie treść: kolumna pochodna, którą
-- baza liczy sama i której nie da się podrobić z przeglądarki.
ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS ma_guest_email BOOLEAN
  GENERATED ALWAYS AS (guest_email IS NOT NULL) STORED;

COMMENT ON COLUMN event_participants.ma_guest_email IS
  'Czy do tego gościa da się w ogóle napisać. Kolumna pochodna — sam adres pozostaje nieczytelny przez API (migracja 127). Bez niej interfejs nie mógł pokazać organizatorowi, kogo kolejka rezerwowa pominie.';

GRANT SELECT (ma_guest_email) ON event_participants TO anon, authenticated;
