-- Alert łapie WIELE SPORTÓW naraz — zgłoszone wprost przez właściciela
-- (2026-09-15): „powinna być opcja wybrania wielu sportów na raz".
--
-- Do tej pory `game_alerts.sport` (migracja 025) trzymał JEDEN sport albo
-- NULL („dowolny"). Kto gra w piłkę i w siatkówkę, miał dwie drogi i obie złe:
-- założyć dwa alerty (dwa maile o jednym meczu nie groziły, bo mecz ma jeden
-- sport — ale lista alertów rosła z powodu, który nie jest powodem) albo
-- wybrać „dowolny" i dostawać też koszykówkę, której nie szuka.
--
-- Nowa kolumna `sports text[]`: pusta tablica = dowolny sport, czyli dokładnie
-- to samo, co znaczył `sport IS NULL`. Stara kolumna ZOSTAJE wypełniona, gdy
-- sport jest dokładnie jeden — nie dla zgodności „na wszelki wypadek", tylko
-- dlatego, że funkcja brzegowa `notify-game-alert` wdraża się OSOBNO od
-- migracji (patrz AGENTS.md) i przez chwilę może chodzić jej stara wersja,
-- czytająca `sport`. Bez tego alert po edycji przestałby wyłapywać cokolwiek
-- do czasu wdrożenia funkcji — cicho, bo nikt nie dostaje błędu o maila,
-- który nie przyszedł.
--
-- Migracja jest ODPORNA NA POWTÓRZENIE (AGENTS.md: „migracja ma dać się puścić
-- drugi raz"), więc backfill pomija wiersze już wypełnione.

ALTER TABLE game_alerts ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN game_alerts.sports IS
  'Sporty, które alert łapie. Pusta tablica = dowolny sport (to samo, co dawne sport IS NULL). '
  'Kolumna sport zostaje wypełniona przy dokładnie jednym sporcie — czyta ją starsza wersja '
  'funkcji notify-game-alert, wdrażana osobno od migracji.';

-- Backfill: jeden sport ze starej kolumny wjeżdża do tablicy. Tylko tam, gdzie
-- tablica jest jeszcze pusta, żeby powtórzenie migracji nie nadpisało wyboru
-- zrobionego już w nowym oknie.
UPDATE game_alerts
   SET sports = ARRAY[sport]
 WHERE sport IS NOT NULL
   AND cardinality(sports) = 0;

-- Spójność w drugą stronę pilnuje aplikacja (lib/alerts.ts), ale niezgodny
-- wiersz wpisany z ręki po cichu psułby dopasowanie w starej funkcji, więc
-- baza mówi to wprost: albo sport stoi w tablicy, albo tablica jest pusta.
ALTER TABLE game_alerts DROP CONSTRAINT IF EXISTS alert_sport_w_tablicy;
ALTER TABLE game_alerts ADD CONSTRAINT alert_sport_w_tablicy CHECK (
  sport IS NULL OR sport = ANY(sports)
);

-- `count_alert_seekers` liczy, ilu ludzi czeka na taki mecz (pokazywane
-- organizatorowi w kreatorze). Musi umieć obie reprezentacje, bo wiersz
-- wstawiony starą wersją aplikacji ma tylko `sport`.
CREATE OR REPLACE FUNCTION count_alert_seekers(
  p_lat   float8,
  p_lng   float8,
  p_sport text,
  p_dow   int    -- ISO: 1=Mon…7=Sun
)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT user_id)::int
  FROM game_alerts
  WHERE is_active = true
    AND (
      CASE WHEN cardinality(sports) > 0
           THEN p_sport = ANY(sports)
           ELSE (sport IS NULL OR sport = p_sport)
      END
    )
    AND (days_of_week = '{}' OR p_dow = ANY(days_of_week))
    AND haversine_km(lat, lng, p_lat, p_lng) <= radius_km
$$;
