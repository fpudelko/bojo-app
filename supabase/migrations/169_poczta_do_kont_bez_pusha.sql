-- 169: poczta do konta jako ZAPAS, gdy konto nie ma pusha (Z-1,
-- docs/faza1-runda10-plan.md).
--
-- DLACZEGO. `140` wysyła mail do konta tylko przy odwołaniu/zmianach,
-- zakładając, że resztę doniesie push. Na produkcji push ma 3 z 33 graczy
-- i 2 z 9 organizatorów (60 dni). Przypomnienie dzień przed czytało 5 z 12
-- osób, mediana po 19,5 h; 7 z 13 zaproszeń nie przeczytano wcale. Gość bez
-- konta z adresem dostaje te same rzeczy mailem (`133`/`137`) — konto
-- pogarszało dostarczalność, odwrotność argumentu, którym organizator ma
-- przekonywać ekipę do zakładania kont.
--
-- CO. Cztery istniejące typy (`przypomnienie_o_meczu`, `reserve_claim_offered`,
-- `zaproszenie_na_mecz`, `po_meczu_do_domkniecia`) dostają mail WYŁĄCZNIE gdy
-- konto nie ma żadnej subskrypcji push. Żadnego nowego typu powiadomień.
-- Cztery powody z `140` bez zmian (zawsze mail, bez limitu).
--
-- BEZPIECZNIK DZIENNY. Resend w darmowym planie przepuszcza 100 maili dziennie
-- ŁĄCZNIE z mailami logowania (SMTP Supabase idzie przez ten sam klucz). Dla
-- czterech nowych powodów funkcja wychodzi cicho, gdy `maile_wyslane` z bieżącej
-- doby ma już `limit_dzienny` wierszy (domyślnie 80, zmienialne wpisem
-- w `konfiguracja_poczty`, bez migracji). Widoczny strażnik zbliżania się do
-- limitu Resend → `zdrowie-produkcji.yml` (Z-1a), osobno od tego bezpiecznika.
--
-- TREŚĆ Z DZWONKA, JEDNO ŹRÓDŁO. `v_tresc` czyta `notifications.body` wiersza,
-- który i tak już istnieje — wyzwalacz jest AFTER INSERT, więc wiersz jest
-- widoczny w tej samej transakcji. Bez tego zdanie „brakuje 2 (12/14)" albo
-- „kto zaprasza" trzeba by utrzymywać w drugim miejscu, w drugim języku SQL.
--
-- FUNKCJA BRZEGOWA MUSI BYĆ WDROŻONA PRZED TĄ MIGRACJĄ (gałąź
-- `claude/funkcje/runda10`, workflow „Wdróż funkcje brzegowe"). Odwrotna
-- kolejność: `tresc()` dostaje nieznany powód, zwraca `null`, a `maile_wyslane`
-- i tak zapisuje „wysłane" — mail przepada po cichu.
--
-- MIGRACJA JEST IDEMPOTENTNA. Skaner ryzyka: podmiana ciała dwóch funkcji,
-- bez DROP/TRUNCATE/DELETE/RENAME/ALTER COLUMN — bezpieczna.

CREATE OR REPLACE FUNCTION wyslij_mail_do_konta(p_user UUID, p_powod TEXT, p_event UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, auth, pg_temp
AS $$
DECLARE
  v_url        TEXT;
  v_sekret     TEXT;
  v_email      TEXT;
  v_imie       TEXT;
  v_w          RECORD;
  v_limit      INT;
  v_tresc      TEXT;
  v_oferta_do  TEXT;
  v_krytyczny  BOOLEAN := p_powod IN ('mecz_odwolany', 'zmiana_terminu', 'zmiana_warunkow_meczu', 'mecz_przywrocony');
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_poczty WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_poczty WHERE klucz = 'sekret';
  -- Brak konfiguracji = kanał jeszcze niewłączony. Wychodzimy CICHO: wyjątek
  -- tutaj wywróciłby operację, przy której jesteśmy wołani — a jest nią między
  -- innymi ODWOŁANIE MECZU.
  IF v_url IS NULL OR v_sekret IS NULL THEN RETURN; END IF;

  -- Ustawienia sprawdzamy WCZEŚNIE: to najtańszy sposób na niewysłanie.
  IF EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = p_user AND p_powod = ANY(p.mail_wylaczone)
  ) THEN
    RETURN;
  END IF;

  -- Bezpiecznik dzienny — WYŁĄCZNIE dla czterech nowych powodów. Cztery
  -- krytyczne z `140` (odwołanie, zmiany, przywrócenie) limitu nie mają: to
  -- jest dokładnie ten zbiór, przy którym niedoręczenie kończy się czyimś
  -- wyjazdem na boisko.
  IF NOT v_krytyczny THEN
    SELECT CASE WHEN wartosc ~ '^[0-9]+$' THEN wartosc::int END INTO v_limit
      FROM konfiguracja_poczty WHERE klucz = 'limit_dzienny';
    IF (SELECT count(*) FROM maile_wyslane
         WHERE created_at >= date_trunc('day', now())) >= coalesce(v_limit, 80) THEN
      RETURN;
    END IF;
  END IF;

  -- Imię tą samą drogą co `wyslij_mail_powitalny()` (`134`) — trzy pola, bo
  -- Google i rejestracja hasłem wpisują je pod różnymi nazwami.
  SELECT u.email,
         nullif(btrim(coalesce(
           u.raw_user_meta_data ->> 'display_name',
           u.raw_user_meta_data ->> 'full_name',
           u.raw_user_meta_data ->> 'name', '')), '')
    INTO v_email, v_imie
    FROM auth.users u WHERE u.id = p_user;

  IF v_email IS NULL THEN RETURN; END IF;

  SELECT e.id, e.title, e.sport, e.event_date, e.event_time, e.organizer_id,
         coalesce(e.field_name, e.custom_location_name) AS miejsce, e.cost_grosz,
         e.notatka_odwolania, e.reserve_claim_minutes
    INTO v_w
    FROM events e WHERE e.id = p_event;
  IF v_w.id IS NULL THEN RETURN; END IF;

  IF NOT v_krytyczny THEN
    -- Treść z dzwonka — jedno źródło zdania (np. „brakuje 2 (12/14)" dla
    -- organizatora, „kto zaprasza" dla zaproszenia). Wyzwalacz jest AFTER
    -- INSERT, więc wiersz `notifications` już istnieje w tej transakcji.
    SELECT n.body INTO v_tresc FROM notifications n
     WHERE n.user_id = p_user AND n.event_id = p_event AND n.type = p_powod
     ORDER BY n.created_at DESC LIMIT 1;
  END IF;

  IF p_powod = 'reserve_claim_offered' THEN
    SELECT to_char((p.claim_offered_at
             + (coalesce(v_w.reserve_claim_minutes, 180) || ' minutes')::interval)
             AT TIME ZONE 'Europe/Warsaw', 'DD.MM, godz. HH24:MI')
      INTO v_oferta_do
      FROM event_participants p
     WHERE p.event_id = p_event AND p.user_id = p_user AND p.claim_offered_at IS NOT NULL
     LIMIT 1;
  END IF;

  BEGIN
    INSERT INTO maile_wyslane (user_id, powod, event_id) VALUES (p_user, p_powod, p_event);
  EXCEPTION WHEN unique_violation THEN
    RETURN;   -- ten sam powód, ten sam mecz, ta sama doba
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
      -- Odbiorca ma KONTO, więc dostaje link do meczu i do ustawień, nie do
      -- wpisu gościa.
      'ma_konto', true,
      'notatka',  CASE WHEN p_powod = 'mecz_odwolany'
                    AND btrim(coalesce(v_w.notatka_odwolania, '')) <> ''
                  THEN v_w.notatka_odwolania ELSE NULL END,
      'organizator', (v_w.organizer_id = p_user),
      'tresc',       v_tresc,
      'oferta_do',   v_oferta_do
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Ta sama zasada co przy braku konfiguracji, ale dla awarii `pg_net`.
  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION wyslij_mail_do_konta(UUID, TEXT, UUID) FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- Wyzwalacz — cztery powody krytyczne z `140` bez zmian, cztery nowe WYŁĄCZNIE
-- gdy konto nie ma żadnej subskrypcji push. Martwa subskrypcja (`send-push`
-- kasuje ją po 404/410) sprawia, że pierwsze powiadomienie po jej śmierci nie
-- dojdzie żadnym kanałem — kolejne pójdzie już mailem. Akceptowalne.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION wyslij_mail_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.event_id IS NULL THEN RETURN NEW; END IF;

  IF NEW.type IN ('mecz_odwolany', 'zmiana_terminu', 'zmiana_warunkow_meczu', 'mecz_przywrocony') THEN
    PERFORM wyslij_mail_do_konta(NEW.user_id, NEW.type, NEW.event_id);
  ELSIF NEW.type IN ('przypomnienie_o_meczu', 'reserve_claim_offered', 'zaproszenie_na_mecz', 'po_meczu_do_domkniecia')
    AND NOT EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = NEW.user_id) THEN
    PERFORM wyslij_mail_do_konta(NEW.user_id, NEW.type, NEW.event_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wyslij_mail_po_powiadomieniu ON notifications;
CREATE TRIGGER trg_wyslij_mail_po_powiadomieniu
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION wyslij_mail_po_powiadomieniu();

COMMENT ON FUNCTION wyslij_mail_do_konta(UUID, TEXT, UUID) IS
  'Poczta do uczestnika Z KONTEM. Cztery powody krytyczne z migracji 140 — zawsze. Cztery powody z migracji 169 (przypomnienie, oferta z rezerwy, zaproszenie, po meczu) — wyłącznie bez subskrypcji push, z bezpiecznikiem dziennym limit_dzienny. Respektuje profiles.mail_wylaczone. Cicho wychodzi bez konfiguracji poczty.';
