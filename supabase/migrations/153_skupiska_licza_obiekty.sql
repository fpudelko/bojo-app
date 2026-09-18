-- 153_skupiska_licza_obiekty.sql
--
-- DLACZEGO POWSTAŁA (zgłoszone wprost: „filtry na mapie się nie zgadzają").
-- Trzy błędy w jednej funkcji, wszystkie widoczne na licznikach nad mapą:
--
--  1. `count(*)` po `CROSS JOIN LATERAL unnest(f.sport)` liczył WIERSZ NA
--     SPORT, nie obiekt. Boisko opisane jako „piłka nożna + koszykówka"
--     wchodziło do liczby dwa razy. Stąd 38 314 (suma par obiekt-sport)
--     w miejscu, gdzie publicznych obiektów jest 35 952 — i stąd liczba
--     w kółku skupiska nie zgadzała się z liczbą pinezek po przybliżeniu.
--     Ta sama zawyżona liczba krążyła w repo jako „katalog ma 38 314
--     obiektów"; to była suma par, nie obiektów.
--
--  2. Brak bramki na sporty, które mapa w ogóle pokazuje. Zapytanie
--     o pinezki zawsze zawężało do siedmiu sportów mapy, a skupiska liczyły
--     wszystko — również tenis, baseball i hokej (151 wierszy), których
--     pinezki nigdy nie przyjdą. Bramka nie jest wpisana w SQL, tylko
--     PRZYCHODZI w `p_sporty`: jedna lista w `lib/sports.ts`
--     (`SPORTY_NA_MAPIE`) zamiast drugiej, zaszytej w treści funkcji.
--
--  3. Brak filtra nawierzchni — jedyny z filtrów obiektu, który przy
--     oddalonej mapie nie robił NIC: kółka i licznik zostawały niezmienione,
--     więc filtr wyglądał na zepsuty dokładnie tam, gdzie zaczyna się
--     korzystanie z mapy.
--
-- `p_typy` odchodzi razem z filtrem „Typ obiektu", zdjętym z mapy w tym samym
-- PR-ze: `venue_type` ma dane w 539 z 35 952 publicznych wierszy (1,5%), więc
-- każdy wybór typu wycinał niemal cały katalog, a trzy jego opcje
-- („Siatkówka", „Siatkówka plażowa", „Koszykówka") dublowały filtr Sport.
--
-- ŚRODEK KÓŁKA (`avg`) jest nadal liczony po wierszach z rozbitym sportem,
-- czyli obiekt wielosportowy przyciąga go mocniej. Zostawione świadomie:
-- poprawienie tego wymaga drugiego przebiegu po całym kadrze (1,2 s przy
-- widoku kraju wobec 0,25 s teraz, przy limicie 3 s dla roli `anon`), a mówimy
-- o kilkuset metrach przesunięcia dekoracyjnego kółka. Liczba w kółku — ta,
-- którą ktoś czyta — jest już policzona po obiektach.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ. Stara wersja musi odejść jawnie: typy argumentów
-- są te same, a zmienia się NAZWA ostatniego (`p_typy` → `p_nawierzchnie`),
-- czego samo `CREATE OR REPLACE` nie zrobi („cannot change name of input
-- parameter"). Gdyby zmienił się też typ, powstałoby PRZECIĄŻENIE — a wtedy
-- PostgREST nie umie wybrać kandydata i każde RPC kończy się błędem.

DROP FUNCTION IF EXISTS mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                      DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[]);

CREATE OR REPLACE FUNCTION mapa_skupiska(
  p_lat_min       DOUBLE PRECISION,
  p_lat_max       DOUBLE PRECISION,
  p_lng_min       DOUBLE PRECISION,
  p_lng_max       DOUBLE PRECISION,
  p_krok          DOUBLE PRECISION,
  p_sporty        TEXT[] DEFAULT NULL,
  p_nawierzchnie  TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  lat    DOUBLE PRECISION,
  lng    DOUBLE PRECISION,
  ile    BIGINT,
  sporty TEXT[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT avg(f.lat)::DOUBLE PRECISION,
         avg(f.lng)::DOUBLE PRECISION,
         -- OBIEKTY, nie pary obiekt-sport (patrz nagłówek, punkt 1).
         count(DISTINCT f.id),
         -- Sporty w komórce — kolor kółka bierze się z tego, co w niej jest.
         -- Ograniczone do pięciu, bo ikona i tak pokazuje najwyżej kilka.
         (array_agg(DISTINCT s))[1:5]
    FROM fields f
    CROSS JOIN LATERAL unnest(f.sport) AS s
   WHERE f.map_visibility = 'public'
     AND f.lat IS NOT NULL AND f.lng IS NOT NULL
     AND f.lat BETWEEN p_lat_min AND p_lat_max
     AND f.lng BETWEEN p_lng_min AND p_lng_max
     -- Warunek na POJEDYNCZYM sporcie, nie na całej tablicy (`&&`): tak jedna
     -- linia robi dwie rzeczy naraz — odsiewa obiekty bez pasującego sportu
     -- i pilnuje, żeby kolor kółka nie brał się ze sportu, którego użytkownik
     -- właśnie odfiltrował.
     AND (p_sporty IS NULL OR s = ANY(p_sporty))
     AND (p_nawierzchnie IS NULL OR f.surface = ANY(p_nawierzchnie))
   GROUP BY floor(f.lat / p_krok), floor(f.lng / p_krok)
$$;

COMMENT ON FUNCTION mapa_skupiska IS
  'Liczby obiektów w komórkach siatki dla oddalonych widoków mapy — zamiast tysięcy wierszy.';

REVOKE ALL ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                     DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                        DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[])
  TO anon, authenticated;
