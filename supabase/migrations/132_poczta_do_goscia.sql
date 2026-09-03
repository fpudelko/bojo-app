-- 132 — poczta do gościa bez konta
--
-- DLACZEGO. Goście bez konta to ćwierć wszystkich wpisów w składach na
-- produkcji, a po odfiltrowaniu meczów testowych zespołu — 28 %. Z tego
-- większość zapisała się SAMA, podając imię i adres e-mail. Bojo nie wysyłało
-- na ten adres NICZEGO: sprawdzone we wszystkich czterech funkcjach brzegowych,
-- żadna nie czyta `guest_email`; w migracjach służył wyłącznie do deduplikacji
-- (`085`, `088`) i do powiadomienia ISTNIEJĄCEGO konta o tym samym adresie
-- (`084`). Adres był więc zbierany i nieużywany.
--
-- Co z tego wynikało dla organizatora: ćwierć jego składu nie dostawała ani
-- przypomnienia „jutro grasz" (`129` ma `p.user_id IS NOT NULL`), ani
-- wiadomości o ODWOŁANIU meczu (`070`, `116`), ani o zmianie terminu i warunków
-- (`065`, `114`) — bo wszystkie te wyzwalacze piszą do `notifications`, a tam
-- trzeba mieć konto. Jedyną kotwicą gościa był `localStorage` na jednym
-- telefonie: wyczyszczona przeglądarka = wpis nie do odzyskania. Skutki brał na
-- siebie organizator, bo skład kłamał w tej części, którą sam przyprowadził.
--
-- CZTERY POWODY WYSYŁKI, w tej kolejności — i kolejność jest tu istotą, nie
-- porządkiem alfabetycznym. Mail „załóż konto" wysłany jako PIERWSZY kontakt od
-- nadawcy, którego skrzynka nie zna, czyta się jak spam niezależnie od treści.
-- Ten sam mail po trzech, które były oczekiwane i przydatne, trafia w zupełnie
-- inny kontekst:
--   1. `zapis`         — potwierdzenie + link do własnego wpisu. To jest ta
--                        rzecz, która UZASADNIA pobieranie adresu.
--   2. `odwolanie` / `zmiana` — żeby nie przyjechał na boisko.
--   3. `jutro_grasz`   — dzień przed, razem z zadaniem cron.
--   4. `zaloz_konto`   — dzień po meczu, TYLKO gdy ten adres nadal nie ma konta.
--
-- WZORZEC: jeden do jednego jak `send-push` z migracji `102`, która działa na
-- produkcji. Konfiguracja w osobnej tabeli bez polityk (przez API nieczytelna),
-- `pg_net` do wywołania funkcji brzegowej, CICHE WYJŚCIE przy braku
-- konfiguracji i cały korpus w `EXCEPTION WHEN OTHERS` — kanał dodatkowy nie
-- może wywrócić operacji podstawowej, a operacją podstawową jest tu między
-- innymi ODWOŁANIE MECZU.
--
-- ISTNIEJĄCYCH FUNKCJI POWIADOMIEŃ NIE DOTYKAMY. Wysyłkę dokłada OSOBNY
-- wyzwalacz obok nich — z tego samego powodu, dla którego `131` nie przepisywała
-- siedmiu funkcji: każda przepisana linia to okazja, żeby coś zgubić (tak `074`
-- musiała naprawiać `get_player_stats` po `064`).
--
-- Migracja jest IDEMPOTENTNA.

-- ---------------------------------------------------------------------------
-- 1. Konfiguracja (bliźniaczo jak `konfiguracja_push` z `102`)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS konfiguracja_poczty (
  klucz   TEXT PRIMARY KEY,
  wartosc TEXT NOT NULL
);
ALTER TABLE konfiguracja_poczty ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON konfiguracja_poczty FROM anon, authenticated;

-- Ślad wysyłek: `notifications` wymaga konta, więc gość nie ma tam czego
-- szukać. Tabela jest jednocześnie kluczem idempotencji — zadanie cron potrafi
-- wystartować dwa razy, a dwa identyczne maile to już nie „zmiana w meczu",
-- tylko spam.
CREATE TABLE IF NOT EXISTS maile_goscia (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uczestnik_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  powod       TEXT NOT NULL,
  dzien       DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Warsaw')::date,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (uczestnik_id, powod, dzien)
);
ALTER TABLE maile_goscia ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON maile_goscia FROM anon, authenticated;

-- `pg_net` jest na Supabase, ale NIE ma go na gołym Postgresie, na którym
-- `scripts/baza-testowa.sh` sprawdza migracje od zera. Ten sam blok co w `102`.
CREATE SCHEMA IF NOT EXISTS extensions;
DO $pgnet$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net niedostępny (%) — poczta do gości nie będzie wysyłana z tej bazy', SQLERRM;
END
$pgnet$;

-- ---------------------------------------------------------------------------
-- 2. Wysyłka
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
  -- Brak konfiguracji = kanał jeszcze niewłączony. Wychodzimy CICHO: wyjątek
  -- tutaj wywróciłby operację, przy której jesteśmy wołani.
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  SELECT p.id, p.name, p.guest_email, p.claim_token, p.is_reserve, p.pending_approval,
         e.id AS event_id, e.title, e.sport, e.event_date, e.event_time, e.status,
         coalesce(e.field_name, e.custom_location_name) AS miejsce,
         e.cost_grosz
    INTO v_w
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.id = p_uczestnik
     AND p.is_guest
     AND p.guest_email IS NOT NULL
     AND p.claimed_at IS NULL;   -- wpis przejęty ma już konto, więc ma dzwonek

  IF v_w.id IS NULL THEN RETURN; END IF;

  -- Idempotencja: jeden powód, na jeden wpis, na dobę.
  BEGIN
    INSERT INTO maile_goscia (uczestnik_id, powod) VALUES (p_uczestnik, p_powod);
  EXCEPTION WHEN unique_violation THEN
    RETURN;
  END;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-bojo-sekret', v_sekret),
    body    := jsonb_build_object(
      'powod',      p_powod,
      'email',      v_w.guest_email,
      'imie',       v_w.name,
      'event_id',   v_w.event_id,
      'tytul',      coalesce(v_w.title, v_w.sport),
      'data',       to_char(v_w.event_date, 'DD.MM.YYYY'),
      'godzina',    to_char(v_w.event_time, 'HH24:MI'),
      'miejsce',    v_w.miejsce,
      'koszt_grosz', v_w.cost_grosz,
      'na_rezerwie', v_w.is_reserve,
      'token',      v_w.claim_token
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Ta sama zasada co przy braku konfiguracji, ale dla awarii `pg_net`.
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_mail_do_goscia(UUID, TEXT) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Powód 1 — potwierdzenie zaraz po zapisie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_goscia_o_zapisie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_guest AND NEW.guest_email IS NOT NULL AND NEW.claimed_at IS NULL THEN
    PERFORM wyslij_mail_do_goscia(NEW.id, 'zapis');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_goscia_o_zapisie ON event_participants;
CREATE TRIGGER trg_powiadom_goscia_o_zapisie
  AFTER INSERT ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_goscia_o_zapisie();

-- ---------------------------------------------------------------------------
-- 4. Powód 2 — odwołanie meczu i zmiana warunków
-- ---------------------------------------------------------------------------
-- OSOBNY wyzwalacz obok `trg_powiadom_o_odwolaniu` (`070`),
-- `trg_powiadom_o_zmianie_terminu` (`065`) i `trg_powiadom_o_zmianie_warunkow`
-- (`114`) — te zostają nietknięte.
CREATE OR REPLACE FUNCTION powiadom_gosci_o_zmianie_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_powod TEXT;
  v_g     RECORD;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    v_powod := 'odwolanie';
  ELSIF NEW.status <> 'cancelled'
        AND (NEW.event_date IS DISTINCT FROM OLD.event_date
          OR NEW.event_time IS DISTINCT FROM OLD.event_time
          OR NEW.field_name IS DISTINCT FROM OLD.field_name
          OR NEW.custom_location_name IS DISTINCT FROM OLD.custom_location_name
          OR NEW.cost_grosz IS DISTINCT FROM OLD.cost_grosz) THEN
    v_powod := 'zmiana';
  ELSE
    RETURN NEW;
  END IF;

  FOR v_g IN
    SELECT p.id FROM event_participants p
     WHERE p.event_id = NEW.id AND p.is_guest
       AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL
  LOOP
    PERFORM wyslij_mail_do_goscia(v_g.id, v_powod);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_gosci_o_zmianie_meczu ON events;
CREATE TRIGGER trg_powiadom_gosci_o_zmianie_meczu
  AFTER UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_gosci_o_zmianie_meczu();

-- ---------------------------------------------------------------------------
-- 5. Powody 3 i 4 — zadanie cron
-- ---------------------------------------------------------------------------
-- Osobna funkcja obok `wyslij_przypomnienia()` (`129`), a nie dopisek w środku
-- niej: tamta ma ~150 linii logiki, której ta zmiana nie dotyczy.
-- Czas liczony `AT TIME ZONE 'Europe/Warsaw'` — baza stoi na UTC (`130`).
CREATE OR REPLACE FUNCTION wyslij_maile_do_gosci()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_g   RECORD;
  v_ile INTEGER := 0;
BEGIN
  -- 3. „Jutro grasz" — tylko ci z miejscem w składzie: rezerwa i poczekalnia
  --    jeszcze nie wiedzą, czy grają, więc przypomnienie byłoby myląca.
  FOR v_g IN
    SELECT p.id
      FROM event_participants p
      JOIN events e ON e.id = p.event_id
     WHERE p.is_guest AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL
       AND NOT p.is_reserve AND NOT p.pending_approval
       AND e.status = 'active'
       AND e.event_date = (dzis_pl() + 1)
  LOOP
    PERFORM wyslij_mail_do_goscia(v_g.id, 'jutro_grasz');
    v_ile := v_ile + 1;
  END LOOP;

  -- 4. „Załóż konto" — dzień PO meczu i tylko wtedy, gdy ten adres nadal nie ma
  --    konta w Bojo. Ten sam kształt sprawdzenia co w `084`.
  FOR v_g IN
    SELECT p.id
      FROM event_participants p
      JOIN events e ON e.id = p.event_id
     WHERE p.is_guest AND p.guest_email IS NOT NULL AND p.claimed_at IS NULL
       AND NOT p.is_reserve AND NOT p.pending_approval
       AND e.status = 'active'
       AND e.event_date = (dzis_pl() - 1)
       AND NOT EXISTS (
         SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(p.guest_email)
       )
  LOOP
    PERFORM wyslij_mail_do_goscia(v_g.id, 'zaloz_konto');
    v_ile := v_ile + 1;
  END LOOP;

  RETURN v_ile;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_maile_do_gosci() FROM anon, authenticated;

-- Zadanie cron zakładane warunkowo — wzorem `073` i `129`.
DO $cron$
BEGIN
  PERFORM cron.schedule('bojo-maile-gosci', '10 16 * * *', 'SELECT wyslij_maile_do_gosci();');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron niedostępny (%) — wołaj wyslij_maile_do_gosci() ręcznie', SQLERRM;
END
$cron$;
