-- 1. Rozkład sportów w katalogu, z podziałem na źródło
SELECT '1. sporty wg źródła' AS sekcja, source, unnest(sport) AS sport, count(*)
FROM fields GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 40;

-- 2. Czy jest w bazie COKOLWIEK z siatkówką plażową
SELECT '2. siatkówka plażowa' AS sekcja, count(*) AS ile FROM fields
WHERE 'siatkówka plażowa' = ANY(sport);

-- 3. Podejrzani: siatkówka na piachu = de facto plażówka
SELECT '3. siatkówka + piach' AS sekcja, source, count(*)
FROM fields WHERE 'siatkówka' = ANY(sport) AND surface = 'sand'
GROUP BY 1,2;

-- 4. Jakie województwa mamy już zaimportowane z OSM (zgrubnie, po prostokątach)
SELECT '4. zasięg importu OSM' AS sekcja,
       round(min(lat)::numeric,1) AS lat_min, round(max(lat)::numeric,1) AS lat_max,
       round(min(lng)::numeric,1) AS lng_min, round(max(lng)::numeric,1) AS lng_max,
       count(*) AS ile
FROM fields WHERE source = 'osm';

-- 5. Ile obiektów siedzi w prostokącie lubuskiego (51.0-53.2 N, 14.5-16.5 E)
SELECT '5. lubuskie' AS sekcja, source, count(*)
FROM fields WHERE lat BETWEEN 51.0 AND 53.2 AND lng BETWEEN 14.5 AND 16.5
GROUP BY 1,2;

-- 6. Ile widzi mapa w całej Polsce (po zmianach z PR #83)
SELECT '6. na mapie' AS sekcja, count(*) FROM fields
WHERE lat IS NOT NULL AND lng IS NOT NULL AND map_visibility = 'public'
  AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna','wielofunkcyjne'];
