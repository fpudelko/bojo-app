\pset border 2
SELECT source,
       count(*)                                                      AS obiektow,
       count(*) FILTER (WHERE address IS NOT NULL AND address <> '') AS adres,
       count(*) FILTER (WHERE address ~ '\d')                        AS adres_z_nr,
       count(*) FILTER (WHERE surface IS NOT NULL AND surface <> '') AS nawierzchnia,
       count(*) FILTER (WHERE phone IS NOT NULL)                     AS telefon,
       count(*) FILTER (WHERE website IS NOT NULL)                   AS www,
       count(*) FILTER (WHERE image_url IS NOT NULL OR photo_url IS NOT NULL) AS zdjecie
FROM fields GROUP BY source ORDER BY 2 DESC;

SELECT CASE WHEN name LIKE 'Boisko%' THEN 'generyczna (Boisko …)' ELSE 'instytucjonalna' END AS typ_nazwy,
       count(*) FROM fields WHERE source='osm' GROUP BY 1;

SELECT name, address FROM fields WHERE source='osm' AND name NOT LIKE 'Boisko%' LIMIT 8;
SELECT name, address FROM fields WHERE source='osm' AND name LIKE 'Boisko%' LIMIT 8;

SELECT unnest(sport) AS sport, count(*) FROM fields WHERE source='osm' GROUP BY 1 ORDER BY 2 DESC;
SELECT coalesce(surface,'(brak)') AS nawierzchnia, count(*) FROM fields WHERE source='osm' GROUP BY 1 ORDER BY 2 DESC;

SELECT count(*) AS na_mapie FROM fields
WHERE lat IS NOT NULL AND lng IS NOT NULL AND map_visibility='public'
  AND sport && ARRAY['piłka nożna','futsal','siatkówka','siatkówka plażowa','koszykówka','piłka ręczna','wielofunkcyjne'];
