-- =============================================================================
-- 148 — Alert o nowych meczach: czas życia, pora dnia, kanały i WYŁĄCZNIK
-- =============================================================================
--
-- DLACZEGO POWSTAŁA
--
-- Alert (`game_alerts`, migracja 025) miał dotąd jeden wymiar czasu: dni
-- tygodnia, na które ma polować. Nie miał ani pory dnia (ktoś pracujący do 17
-- dostawał alerty o meczach o 10:00), ani własnego czasu życia — raz założony
-- działał w nieskończoność.
--
-- Decyzja właściciela (2026-09-14): alert jest domyślnie BEZTERMINOWY. To dobry
-- wybór dla człowieka, który naprawdę czeka na mecz, ale ma jeden warunek bez
-- którego zamienia się w spam: musi dać się wyłączyć Z SAMEJ WIADOMOŚCI, bez
-- logowania. Mail czyta się w skrzynce, często na innym urządzeniu i pół roku
-- po założeniu alertu — „wejdź do aplikacji i znajdź okno alertu" nie jest
-- wtedy żadnym wyjściem. Stąd `wylacz_token` i funkcja niżej.
--
-- MOŻNA PUŚCIĆ DRUGI RAZ. Każdy krok jest `IF NOT EXISTS` / `DROP … IF EXISTS`,
-- bo migracje w tym repo wkleja się ręcznie do SQL Editora i przerwanie
-- w połowie zdarzyło się już wcześniej (patrz `118_rezerwa_czas_w_minutach`).
-- =============================================================================

-- ── 1. Promień do 100 km ─────────────────────────────────────────────────────
-- Suwak odległości w filtrach sięga od 2026-09-14 do 100 km (`PROMIENIE_SUWAK_KM`
-- w `lib/miejscowosci.ts`). Alert bierze promień z tych samych filtrów, więc bez
-- poszerzenia tego ograniczenia zapis alertu z promieniem 65/80/100 km odbijałby
-- się od bazy — i to nie przy zakładaniu, tylko przy próbie zapisu, czyli po
-- wypełnieniu całego okna.
--
-- Ograniczenie z `025` powstało inline, więc nazywa się `game_alerts_radius_km_check`.
-- Zdejmujemy je po nazwie i zakładamy własne, NAZWANE — żeby następna zmiana nie
-- musiała zgadywać, jak nazwał je Postgres.
ALTER TABLE game_alerts DROP CONSTRAINT IF EXISTS game_alerts_radius_km_check;
ALTER TABLE game_alerts DROP CONSTRAINT IF EXISTS alert_promien_w_zakresie;
ALTER TABLE game_alerts
  ADD CONSTRAINT alert_promien_w_zakresie CHECK (radius_km BETWEEN 1 AND 100);

-- ── 2. Czas życia alertu ─────────────────────────────────────────────────────
-- NULL = bezterminowo, i to jest wartość domyślna. Data = alert gaśnie sam.
-- Kolumna jest `timestamptz`, nie „liczba dni": liczba dni wymagałaby liczenia
-- od `created_at` przy każdym dopasowaniu, a zapisany moment czyta się wprost
-- i nie zmienia znaczenia, gdy ktoś alert edytuje.
ALTER TABLE game_alerts ADD COLUMN IF NOT EXISTS expires_at timestamptz;

COMMENT ON COLUMN game_alerts.expires_at IS
  'Kiedy alert gaśnie sam. NULL = bezterminowo (domyślnie). Sprawdzane w funkcji brzegowej notify-game-alert przy dopasowaniu.';

-- ── 3. Pora dnia meczu ───────────────────────────────────────────────────────
-- Drugi, ZUPEŁNIE INNY wymiar czasu niż `expires_at`: tamten mówi, jak długo
-- żyje alert, ten — o jakich meczach ma powiadamiać. Oba trzymamy osobno
-- i osobno nazywamy w interfejsie, bo zlanie ich w jedno „kiedy" jest
-- dokładnie tym nieporozumieniem, przez które nikt nie wie, co ustawia.
--
-- Godzina, nie `time`: mecze zaczynają się o pełnych i połówkach, a do filtra
-- wystarczy godzina startu. `smallint` 0–23, NULL = dowolna pora.
ALTER TABLE game_alerts ADD COLUMN IF NOT EXISTS godzina_od smallint;
ALTER TABLE game_alerts ADD COLUMN IF NOT EXISTS godzina_do smallint;

ALTER TABLE game_alerts DROP CONSTRAINT IF EXISTS alert_godziny_w_dobie;
ALTER TABLE game_alerts ADD CONSTRAINT alert_godziny_w_dobie CHECK (
  (godzina_od IS NULL OR godzina_od BETWEEN 0 AND 23)
  AND (godzina_do IS NULL OR godzina_do BETWEEN 0 AND 23)
);

-- Oba albo żadne. Sama dolna granica bez górnej („od 18:00") dałaby się
-- obronić, ale wtedy dwa pola znaczą trzy różne rzeczy zależnie od tego, które
-- jest puste — a filtr, którego nie da się przeczytać na jeden rzut oka, jest
-- gorszy niż brak filtra.
ALTER TABLE game_alerts DROP CONSTRAINT IF EXISTS alert_godziny_parami;
ALTER TABLE game_alerts ADD CONSTRAINT alert_godziny_parami CHECK (
  (godzina_od IS NULL) = (godzina_do IS NULL)
);

COMMENT ON COLUMN game_alerts.godzina_od IS
  'Najwcześniejsza godzina STARTU meczu, o którym powiadamiamy (0-23). NULL = dowolna pora; wtedy godzina_do też jest NULL.';

-- ── 4. Kanał: mail ───────────────────────────────────────────────────────────
-- Świadomie JEDNA kolumna, nie tablica kanałów. Pozostałe dwa kanały mają już
-- swoje miejsca i dublowanie ich tutaj dałoby dwa przełączniki na jedną rzecz:
--
--   * powiadomienie w aplikacji — jest ZAWSZE. Dzwonek to historia tego, co się
--     wydarzyło, a nie kanał, który przerywa komuś dzień (patrz doktryna
--     w `lib/ustawieniaPowiadomien.ts`).
--   * push — jedzie automatycznie z wiersza w `notifications` (wyzwalacz
--     z migracji `102`), a wyłącza się w ustawieniach powiadomień, per typ.
--     Ta migracja NIE dokłada mu drugiego wyłącznika.
--   * SMS — nie ma bramki (`SHOW_SMS_FEATURES = false`).
ALTER TABLE game_alerts ADD COLUMN IF NOT EXISTS kanal_email boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN game_alerts.kanal_email IS
  'Czy wysyłać maila o dopasowanym meczu. Powiadomienie w aplikacji idzie zawsze, push steruje się ustawieniami powiadomień (typ game_alert).';

-- ── 5. Wyłącznik działający z maila, bez logowania ───────────────────────────
ALTER TABLE game_alerts
  ADD COLUMN IF NOT EXISTS wylacz_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_game_alerts_wylacz_token
  ON game_alerts (wylacz_token);

COMMENT ON COLUMN game_alerts.wylacz_token IS
  'Sekret z linku „nie chcę więcej" w mailu. Jedyne, co nim można zrobić, to wyłączyć TEN alert — patrz wylacz_alert_tokenem().';

-- FUNKCJA, NIE POLITYKA RLS. Kuszące jest dopisanie polityki UPDATE dla `anon`
-- po tokenie, ale polityka otwiera CAŁĄ tabelę na aktualizację — czyli także
-- `lat`, `lng`, `sport` i `user_id` — a my potrzebujemy dokładnie jednej
-- operacji. `SECURITY DEFINER` z ustalonym `search_path` robi jedną rzecz
-- i nic poza nią, więc dziura w niej nie ma jak powstać.
--
-- Zwraca `true`, gdy coś naprawdę wyłączyła. `false` znaczy „nie ma takiego
-- tokenu albo alert był już wyłączony" — strona nie rozróżnia tych dwóch
-- przypadków w komunikacie, bo dla klikającego znaczą to samo.
CREATE OR REPLACE FUNCTION wylacz_alert_tokenem(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  zmienione int;
BEGIN
  UPDATE game_alerts
     SET is_active = false
   WHERE wylacz_token = p_token
     AND is_active = true;
  GET DIAGNOSTICS zmienione = ROW_COUNT;
  RETURN zmienione > 0;
END;
$$;

COMMENT ON FUNCTION wylacz_alert_tokenem(uuid) IS
  'Wyłącza alert linkiem z maila, bez logowania. Robi wyłącznie is_active=false dla pasującego tokenu.';

-- `anon` celowo obok `authenticated`: link z maila otwiera się w przeglądarce,
-- w której nikt nie musi być zalogowany — i to jest cały sens tego wyłącznika.
REVOKE ALL ON FUNCTION wylacz_alert_tokenem(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION wylacz_alert_tokenem(uuid) TO anon, authenticated;
