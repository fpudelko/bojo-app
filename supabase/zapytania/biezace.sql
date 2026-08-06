\pset border 2

-- 1. Kompletność danych wg źródła
SELECT source,
       count(*)                                                   AS obiektow,
       count(*) FILTER (WHERE address IS NOT NULL AND address <> '') AS adres,
       count(*) FILTER (WHERE address ~ '\d')                     AS adres_z_numerem,
       count(*) FILTER (WHERE surface IS NOT NULL AND surface <> '') AS nawierzchnia,
       count(*) FILTER (WHERE phone IS NOT NULL)                  AS telefon,
       count(*) FILTER (WHERE website IS NOT NULL)                AS www,
       count(*) FILTER (WHERE image_url IS NOT NULL OR photo_url IS NOT NULL) AS zdjecie,
       count(*) FILTER (WHERE district IS NOT NULL)               AS dzielnica,
       count(*) FILTER (WHERE venue_type IS NOT NULL)             AS typ_obiektu
FROM fields GROUP BY source ORDER BY 2 DESC;

-- 2. Co dokładnie siedzi w address dla obiektów z OSM (10 przykładów każdego kształtu)
SELECT 'z numerem' AS ksztalt, address FROM fields WHERE source='osm' AND address ~ '\d' LIMIT 5;
SELECT 'bez numeru' AS ksztalt, address FROM fields WHERE source='osm' AND address !~ '\d' AND address <> '' LIMIT 5;
SELECT 'pusty' AS ksztalt, count(*) FROM fields WHERE source='osm' AND (address IS NULL OR address = '');

-- 3. Jakość nazw z OSM
SELECT CASE
         WHEN name LIKE 'Boisko%' THEN 'generyczna (Boisko …)'
         ELSE 'instytucjonalna' END AS typ_nazwy,
       count(*)
FROM fields WHERE source='osm' GROUP BY 1;

-- 4. Przykłady nazw instytucjonalnych i generycznych
SELECT 'instytucjonalna' AS typ, name, address FROM fields WHERE source='osm' AND name NOT LIKE 'Boisko%' LIMIT 8;
SELECT 'generyczna' AS typ, name, address FROM fields WHERE source='osm' AND name LIKE 'Boisko%' LIMIT 8;

-- 5. Rozkład sportów i nawierzchni z OSM
SELECT unnest(sport) AS sport, count(*) FROM fields WHERE source='osm' GROUP BY 1 ORDER BY 2 DESC;
SELECT coalesce(surface,'(brak)') AS nawierzchnia, count(*) FROM fields WHERE source='osm' GROUP BY 1 ORDER BY 2 DESC;

-- 6. Ile widzi mapa dziś
SELECT count(*) AS na_mapie FROM fields
WHERE lat IS NOT NULL AND lng IS NOT NULL AND map_visibility='public'
  AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna','wielofunkcyjne'];
