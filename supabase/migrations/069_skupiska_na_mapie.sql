-- 069_skupiska_na_mapie.sql
--
-- Agregacja obiektów dla oddalonych widoków mapy.
--
-- Problem, który to rozwiązuje. Mapa pobiera dziś wszystkie publiczne obiekty
-- naraz. Przy Poznaniu i lubelskiem to ~2 tys. wierszy i da się z tym żyć.
-- Po imporcie całego kraju będzie ich kilkadziesiąt tysięcy, a wtedy bolą dwie
-- rzeczy naraz: transfer oraz to, że Leaflet musi utworzyć w przeglądarce
-- tyleż obiektów markerów, żeby zaraz zwinąć je w klastry.
--
-- Rozwiązanie: przy oddaleniu nie wysyłamy obiektów, tylko LICZBY W SIATCE.
-- Baza grupuje po komórce, zwraca środek ciężkości i liczność. Zamiast
-- 40 tysięcy wierszy przychodzi kilkaset, a przeglądarka rysuje z nich kółka
-- z liczbami — czyli dokładnie to, co i tak zobaczyłby użytkownik.
--
-- Dlaczego siatka na szerokości i długości, a nie PostGIS. Nie mamy rozszerzenia
-- PostGIS, a do zliczania w kwadratach nie jest potrzebne: `floor(lat / krok)`
-- wystarczy. Zniekształcenie przy dużych szerokościach geograficznych nie ma
-- znaczenia — Polska mieści się w wąskim pasie, a to i tak tylko wizualne
-- skupisko, nie pomiar.

CREATE OR REPLACE FUNCTION mapa_skupiska(
  p_lat_min DOUBLE PRECISION,
  p_lat_max DOUBLE PRECISION,
  p_lng_min DOUBLE PRECISION,
  p_lng_max DOUBLE PRECISION,
  p_krok    DOUBLE PRECISION,
  p_sporty  TEXT[] DEFAULT NULL,
  p_typy    TEXT[] DEFAULT NULL
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
         count(*),
         -- Sporty w komórce — kolor kółka bierze się z tego, co w niej jest.
         -- Ograniczone do pięciu, bo ikona i tak pokazuje najwyżej kilka.
         (array_agg(DISTINCT s))[1:5]
    FROM fields f
    CROSS JOIN LATERAL unnest(f.sport) AS s
   WHERE f.map_visibility = 'public'
     AND f.lat IS NOT NULL AND f.lng IS NOT NULL
     AND f.lat BETWEEN p_lat_min AND p_lat_max
     AND f.lng BETWEEN p_lng_min AND p_lng_max
     AND (p_sporty IS NULL OR f.sport && p_sporty)
     AND (p_typy   IS NULL OR f.venue_type = ANY(p_typy))
   GROUP BY floor(f.lat / p_krok), floor(f.lng / p_krok)
$$;

COMMENT ON FUNCTION mapa_skupiska IS
  'Liczby obiektów w komórkach siatki dla oddalonych widoków mapy — zamiast tysięcy wierszy.';

-- Indeks pod zapytanie po prostokącie. Częściowy, bo mapa pyta wyłącznie
-- o obiekty publiczne, a te są mniejszością całego katalogu.
CREATE INDEX IF NOT EXISTS idx_fields_mapa_bbox
  ON fields (lat, lng)
  WHERE map_visibility = 'public';

REVOKE ALL ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                     DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                        DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[])
  TO anon, authenticated;
