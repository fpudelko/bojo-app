-- 102: Powiadomienia push — subskrypcje przeglądarek i wyzwalacz wysyłki.
--
-- PO CO: dziś każde powiadomienie Bojo (`notifications`, migracje `020`, `072`,
-- `079`, `097`) czeka, aż użytkownik SAM otworzy aplikację. Przy stałej ekipie
-- pętla wygląda tak: organizator zakłada mecz w czwartek, a ludzie dowiadują
-- się o tym w piątek na WhatsAppie — czyli Bojo przegrywa z komunikatorem
-- w jedynej rzeczy, która decyduje o zebraniu składu.
--
-- ARCHITEKTURA, w trzech krokach:
--   1. przeglądarka zapisuje subskrypcję w `push_subscriptions`,
--   2. wyzwalacz na `notifications` woła funkcję brzegową `send-push`
--      (przez `pg_net`, bo Postgres sam nie umie w HTTP),
--   3. `send-push` podpisuje wiadomość kluczem VAPID i wysyła do przeglądarki.
--
-- DLACZEGO WYZWALACZ, A NIE WYSYŁKA Z APLIKACJI: powiadomienia powstają
-- w bazie, z wyzwalaczy (nowy mecz w grupie, komplet składu, prośba
-- o dołączenie). Aplikacja często nawet nie wie, że powstały — zakłada mecz
-- jedna osoba, a powiadomienia dostaje dziesięć. Jedyne miejsce, w którym
-- widać KAŻDE powiadomienie, to sama tabela.

-- ---------------------------------------------------------------------------
-- 1. Subskrypcje
-- ---------------------------------------------------------------------------
-- Jeden wiersz = jedna przeglądarka na jednym urządzeniu. Ta sama osoba ma
-- ich kilka (telefon, laptop, apka z ekranu głównego) i każda ma dostać
-- powiadomienie — dlatego kluczem jest `endpoint`, nie `user_id`.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  -- Do diagnostyki „czemu mi nie przychodzi": bez tego jedyną odpowiedzią jest
  -- zgadywanie, z jakiej przeglądarki pochodzi martwa subskrypcja.
  przegladarka TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ostatni raz, gdy wysyłka się UDAŁA. `send-push` kasuje wiersze odrzucone
  -- przez dostawcę (410 Gone), ale zostawia ślad po tych żywych.
  last_ok_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Każdy zarządza WYŁĄCZNIE swoimi subskrypcjami. Cudzy `endpoint` to adres,
-- pod który da się wysłać powiadomienie w imieniu Bojo — nie może być
-- czytelny dla nikogo poza właścicielem i funkcją brzegową (ta chodzi kluczem
-- serwisowym, więc RLS jej nie dotyczy).
DROP POLICY IF EXISTS "push_wlasne_select" ON push_subscriptions;
CREATE POLICY "push_wlasne_select" ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_insert" ON push_subscriptions;
CREATE POLICY "push_wlasne_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_update" ON push_subscriptions;
CREATE POLICY "push_wlasne_update" ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_delete" ON push_subscriptions;
CREATE POLICY "push_wlasne_delete" ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Konfiguracja wysyłki
-- ---------------------------------------------------------------------------
-- Adres funkcji brzegowej i sekret, którym wyzwalacz się przy niej
-- przedstawia. RLS WŁĄCZONE I ZERO POLITYK — czyli przez API nie czyta tego
-- nikt, nigdy. Czyta wyłącznie wyzwalacz, bo jest `SECURITY DEFINER`.
--
-- Dlaczego nie `ALTER DATABASE ... SET`: te ustawienia widać w `pg_settings`
-- dla każdego zalogowanego. Dlaczego nie Vault: działa, ale dokłada zależność
-- od rozszerzenia, którego poza tym jednym miejscem tu nie używamy.
CREATE TABLE IF NOT EXISTS konfiguracja_push (
  klucz    TEXT PRIMARY KEY,
  wartosc  TEXT NOT NULL
);

ALTER TABLE konfiguracja_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON konfiguracja_push FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wyzwalacz: nowe powiadomienie → wysyłka
-- ---------------------------------------------------------------------------
-- `pg_net` jest na Supabase, ale NIE ma go na gołym Postgresie, na którym
-- `scripts/baza-testowa.sh` sprawdza, czy migracje aplikują się od zera.
-- Twarde `CREATE EXTENSION` wywracało tam całą migrację — a jej reszta (tabele
-- i polityki) jest przenośna i sprawdzalna. Brak rozszerzenia oznacza tylko
-- tyle, że wyzwalacz nie ma czym zawołać funkcji brzegowej; łapie to jego
-- blok EXCEPTION niżej.
CREATE SCHEMA IF NOT EXISTS extensions;
DO $pgnet$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net niedostępny (%) — push nie będzie wysyłany z tej bazy', SQLERRM;
END
$pgnet$;

CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';

  -- Brak konfiguracji = push jeszcze niewłączony. Wychodzimy CICHO: wyjątek
  -- tutaj wywróciłby INSERT do `notifications`, czyli zepsułby powiadomienie
  -- w aplikacji przez to, że nie działa jego wysyłka na telefon. Kanał
  -- dodatkowy nie może psuć podstawowego.
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  -- `net.http_post` jest asynchroniczne — wraca od razu, a żądanie leci
  -- w tle. Dzięki temu czas odpowiedzi dostawcy pusha nie wydłuża zapisu
  -- do bazy ani nie blokuje transakcji, w której powstało powiadomienie.
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'tytul',   NEW.title,
      'tresc',   NEW.body,
      'typ',     NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ta sama zasada co wyżej, ale dla awarii samego `pg_net`.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wyslij_push ON notifications;
CREATE TRIGGER trg_wyslij_push
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION wyslij_push_po_powiadomieniu();

COMMENT ON TABLE push_subscriptions IS
  'Subskrypcje web-push: jeden wiersz = jedna przeglądarka. Wysyłką zajmuje się funkcja brzegowa send-push, wołana wyzwalaczem z notifications (migracja 102).';
