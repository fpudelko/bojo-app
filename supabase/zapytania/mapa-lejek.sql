-- Lejek zapytania mapy: ile obiektów odpada na którym warunku.
-- Odpowiednik getExplorerFields() z frontend/src/lib/api.ts.
-- Prostokąt domyślnie lubelskie — podmień, gdy sprawdzasz inne województwo.

\set lat_min 50.20
\set lat_max 52.30
\set lng_min 21.50
\set lng_max 24.20

WITH w_zasiegu AS (
  SELECT * FROM fields
  WHERE lat BETWEEN :lat_min AND :lat_max
    AND lng BETWEEN :lng_min AND :lng_max
)
SELECT '1. w prostokącie'                     AS krok, count(*) FROM w_zasiegu
UNION ALL
SELECT '2. + ma współrzędne',                       count(*) FROM w_zasiegu WHERE lat IS NOT NULL AND lng IS NOT NULL
UNION ALL
SELECT '3. + source = osm',                         count(*) FROM w_zasiegu WHERE source = 'osm'
UNION ALL
SELECT '4. + map_visibility = public',               count(*) FROM w_zasiegu WHERE source = 'osm' AND map_visibility = 'public'
UNION ALL
SELECT '5. + sport z listy mapy  <- TO WIDZI MAPA',  count(*) FROM w_zasiegu
  WHERE source = 'osm' AND map_visibility = 'public'
    AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna','wielofunkcyjne']
ORDER BY 1;

-- Rozkład sportów w prostokącie
SELECT unnest(sport) AS sport, count(*)
FROM fields
WHERE lat BETWEEN :lat_min AND :lat_max
  AND lng BETWEEN :lng_min AND :lng_max
GROUP BY 1 ORDER BY 2 DESC;

-- Ile obiektów widzi mapa w całej Polsce
SELECT count(*) AS na_mapie_cala_polska
FROM fields
WHERE lat IS NOT NULL AND lng IS NOT NULL
  AND map_visibility = 'public'
  AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna','wielofunkcyjne'];
