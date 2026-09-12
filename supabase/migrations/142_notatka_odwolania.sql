-- 142 — notatka organizatora przy odwołaniu meczu
--
-- DLACZEGO. Okno „Odwołać mecz?" mówi dziś DOKŁADNIE co się stanie („Uczestnicy
-- z kontem dostaną powiadomienie…"), ale nie daje organizatorowi miejsca, żeby
-- powiedzieć DLACZEGO albo co dalej — „boisko zalane, szukam zastępczego
-- terminu", „gramy w przyszłą sobotę o tej samej porze". Jedyną drogą, żeby to
-- przekazać, było „Odwołaj i wyślij wiadomość" — czyli osobna wiadomość na
-- czacie meczu, którą widzi tylko ten, kto tam zajrzy. Kto dostał wyłącznie
-- dzwonek, push albo maila, widział gołe „Organizator odwołał ten mecz" bez
-- powodu.
--
-- CO TO ZNACZY. Organizator może przy odwołaniu dopisać notatkę — trafia do
-- WSZYSTKICH kanałów, które i tak już wychodzą przy odwołaniu: dzwonek
-- w aplikacji (`070`), push (czyta `notifications.body`, `102`) i mail — do
-- konta (`140`) i do gościa bez konta (`133`). Nie jest to nowy kanał, tylko
-- dopisek do czterech istniejących.
--
-- CZEGO TO NIE JEST. To nie jest pole w formularzu edycji ani osobny powód
-- powiadomień — notatka żyje wyłącznie w kontekście KONKRETNEGO odwołania.
-- Kolumna jest nadpisywana przy każdym odwołaniu (włącznie z pustą wartością,
-- gdy organizator nic nie wpisał) i czyszczona przy przywróceniu meczu — żeby
-- następne odwołanie nie odziedziczyło notatki sprzed tygodnia.
--
-- MIGRACJA JEST IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Kolumna
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS notatka_odwolania TEXT;

COMMENT ON COLUMN events.notatka_odwolania IS
  'Notatka organizatora dołączona do POWIADOMIEŃ o odwołaniu meczu (dzwonek, push, mail — 070/133/140). Nadpisywana przy każdym odwołaniu, czyszczona przy przywróceniu (migracja 142).';

-- ---------------------------------------------------------------------------
-- 2. Dzwonek — dopisek do treści, którą i tak czyta push (`102`)
-- ---------------------------------------------------------------------------
-- Ciało przepisane z `070` z jedną zmianą: notatka na końcu treści, gdy jest.
CREATE OR REPLACE FUNCTION powiadom_o_odwolaniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'mecz_odwolany',
         'Mecz odwołany',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || '. Organizator odwołał ten mecz.'
           || CASE WHEN btrim(coalesce(NEW.notatka_odwolania, '')) <> ''
                THEN E'\n\nWiadomość od organizatora: ' || btrim(NEW.notatka_odwolania)
                ELSE '' END,
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Mail do konta — dopisek do payloadu wysyłanego do funkcji brzegowej
-- ---------------------------------------------------------------------------
-- Ciało przepisane z `140` z jedną zmianą: `v_w` niesie teraz notatkę i wiersz
-- JSON dostaje pole `notatka`, WYŁĄCZNIE dla powodu `mecz_odwolany` — pozostałe
-- trzy powody (`zmiana_terminu`, `zmiana_warunkow_meczu`, `mecz_przywrocony`)
-- nie mają z odwołaniem nic wspólnego, choćby kolumna akurat coś niosła.
CREATE OR REPLACE FUNCTION wyslij_mail_do_konta(p_user UUID, p_powod TEXT, p_event UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
  v_email  TEXT;
  v_imie   TEXT;
  v_w      RECORD;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = p_user AND p_powod = ANY(p.mail_wylaczone)
  ) THEN
    RETURN;
  END IF;

  SELECT u.email,
         nullif(btrim(coalesce(
           u.raw_user_meta_data ->> 'display_name',
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name', '')), '')
    INTO v_email, v_imie
    FROM auth.users u WHERE u.id = p_user;

  IF v_email IS NULL THEN RETURN; END IF;

  SELECT e.id, e.title, e.sport, e.event_date, e.event_time,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz,
         e.notatka_odwolania
    INTO v_w
    FROM events e WHERE e.id = p_event;
  IF v_w.id IS NULL THEN RETURN; END IF;

  BEGIN
    INSERT INTO maile_wyslane (user_id, powod, event_id) VALUES (p_user, p_powod, p_event);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod',    p_powod,
      'email',    v_email,
      'imie',     v_imie,
      'event_id', v_w.id,
      'tytul',    coalesce(v_w.title, v_w.sport),
      'data',     to_char(v_w.event_date, 'DD.MM.YYYY'),
      'godzina',  to_char(v_w.event_time, 'HH24:MI'),
      'miejsce',  v_w.miejsce,
      'koszt_grosz', v_w.cost_grosz,
      'ma_konto', true,
      'notatka',  CASE WHEN p_powod = 'mecz_odwolany'
                    AND btrim(coalesce(v_w.notatka_odwolania, '')) <> ''
                  THEN v_w.notatka_odwolania ELSE NULL END
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Mail do gościa bez konta — dopisek do ciała z `137` (OSTATNIA definicja
--    przed tą migracją), nie z `133`. `133` samo w sobie jest już nieaktualne:
--    `134` przeniosło zapis do `maile_wyslane` (rename z `maile_goscia`),
--    a `137` dołożyło `czeka_na_akceptacje` i `oferta_do`. Kopiowanie ciała
--    z `133` przywróciłoby oba te regresy naraz — INSERT do tabeli, która od
--    `134` nazywa się inaczej, i mail „Masz miejsce w składzie" do gościa
--    w poczekalni.
-- ---------------------------------------------------------------------------
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
         e.notatka_odwolania,
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
      'czeka_na_akceptacje', v_w.pending_approval,
      'oferta_do', v_w.oferta_do,
      'token', v_w.claim_token,
      'notatka', CASE WHEN p_powod = 'odwolanie'
                   AND btrim(coalesce(v_w.notatka_odwolania, '')) <> ''
                 THEN v_w.notatka_odwolania ELSE NULL END
    )
  );
EXCEPTION WHEN OTHERS THEN
  RETURN;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Przywrócenie meczu czyści notatkę
-- ---------------------------------------------------------------------------
-- Bez tego drugie odwołanie tego samego meczu, bez nowej notatki, wysłałoby
-- ludziom wiadomość sprzed tygodnia jako aktualną. `restoreEvent()`
-- (`lib/events.ts`) i tak zeruje kolumnę przy każdym przywróceniu — ten
-- wyzwalacz jest siecią bezpieczeństwa dla ścieżek, które zmieniają `status`
-- z pominięciem aplikacji (panel Supabase, skrypt).
CREATE OR REPLACE FUNCTION wyczysc_notatke_po_przywroceniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status <> 'cancelled' AND OLD.status IS NOT DISTINCT FROM 'cancelled'
     AND NEW.notatka_odwolania IS NOT NULL THEN
    NEW.notatka_odwolania := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wyczysc_notatke_po_przywroceniu ON events;
CREATE TRIGGER trg_wyczysc_notatke_po_przywroceniu
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION wyczysc_notatke_po_przywroceniu();

COMMENT ON FUNCTION wyslij_mail_do_konta(UUID, TEXT, UUID) IS
  'Poczta do uczestnika Z KONTEM — wyłącznie cztery powody, przy których niedoręczenie kończy się czyimś wyjazdem na boisko (migracja 140). Niesie notatkę organizatora przy odwołaniu (migracja 142). Respektuje profiles.mail_wylaczone. Cicho wychodzi bez konfiguracji poczty.';

COMMENT ON FUNCTION wyslij_mail_do_goscia(UUID, TEXT) IS
  'Poczta do gościa bez konta — cztery powody (migracja 133). Niesie notatkę organizatora przy odwołaniu (migracja 142). Cicho wychodzi bez konfiguracji poczty.';
