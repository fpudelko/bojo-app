-- ukryj-stary-poznan.sql
--
-- Zdejmuje z mapy poznańskie obiekty pochodzące sprzed importu z OpenStreetMap,
-- ŻEBY PO IMPORCIE WIELKOPOLSKIEGO NIE STAŁY DWIE PINEZKI NA TYM SAMYM BOISKU.
--
-- Klucz obiektu to `source` + `external_id`, więc stary wiersz poznański i nowy
-- z OSM to dla bazy dwa różne obiekty — import ich nie scali. Bez tego kroku
-- na mapie pojawią się pary punktów kilkanaście metrów od siebie, z różnymi
-- nazwami, i nie da się powiedzieć, który jest prawdziwy.
--
-- UKRYWAMY, NIE KASUJEMY. `map_visibility = 'hidden'` znika z mapy, ale wiersz
-- zostaje: telefony, e-maile, strony i zdjęcia zebrane dla Poznania są jedyną
-- rzeczą, której OSM nie da. Kasowanie byłoby decyzją nieodwracalną podjętą,
-- zanim wiadomo, czy nowy katalog jest lepszy pod każdym względem.
--
-- URUCHAMIAJ PRZED importem wielkopolskiego, nie po.
--
-- ===========================================================================
-- KROK 1 — PODGLĄD. Uruchom sam i obejrzyj, zanim cokolwiek zapiszesz.
-- ===========================================================================

WITH kandydaci AS (
  SELECT *
    FROM fields
   WHERE source IS DISTINCT FROM 'osm'
     AND map_visibility = 'public'
     -- Prostokąt wokół Poznania z powiatem
     AND lat BETWEEN 52.20 AND 52.55
     AND lng BETWEEN 16.65 AND 17.20
     -- Obiekty z opiekunem albo z włączoną rezerwacją zostają: ktoś je
     -- świadomie skonfigurował, a import z OSM tego nie odtworzy.
     AND manager_id IS NULL
     AND coalesce(booking_enabled, false) = false
)
SELECT 'do ukrycia'                                        AS grupa,
       count(*)                                            AS ile,
       count(*) FILTER (WHERE phone IS NOT NULL)           AS z_telefonem,
       count(*) FILTER (WHERE email IS NOT NULL)           AS z_emailem,
       count(*) FILTER (WHERE website IS NOT NULL)         AS ze_strona,
       count(*) FILTER (WHERE photo_url IS NOT NULL
                           OR image_url IS NOT NULL)       AS ze_zdjeciem
  FROM kandydaci
UNION ALL
SELECT 'zostaje: ma opiekuna lub rezerwacje', count(*), 0, 0, 0, 0
  FROM fields
 WHERE source IS DISTINCT FROM 'osm'
   AND map_visibility = 'public'
   AND lat BETWEEN 52.20 AND 52.55
   AND lng BETWEEN 16.65 AND 17.20
   AND (manager_id IS NOT NULL OR coalesce(booking_enabled, false) = true);

-- Próbka nazw — sprawdź, czy to faktycznie stare wpisy, a nie coś dodanego ręcznie.
SELECT name, address, source, phone, website
  FROM fields
 WHERE source IS DISTINCT FROM 'osm'
   AND map_visibility = 'public'
   AND lat BETWEEN 52.20 AND 52.55
   AND lng BETWEEN 16.65 AND 17.20
   AND manager_id IS NULL
   AND coalesce(booking_enabled, false) = false
 ORDER BY (phone IS NOT NULL) DESC, name
 LIMIT 25;

-- ===========================================================================
-- KROK 2 — ZAPIS. Odkomentuj dopiero po obejrzeniu podglądu.
-- ===========================================================================
--
-- `previous_map_visibility` zapamiętuje stan sprzed zmiany, żeby cofnięcie było
-- dokładne, a nie „ustaw wszystko z powrotem na public" — część obiektów mogła
-- mieć wcześniej inną wartość.

-- ALTER TABLE fields ADD COLUMN IF NOT EXISTS previous_map_visibility TEXT;
--
-- UPDATE fields
--    SET previous_map_visibility = map_visibility,
--        map_visibility = 'hidden'
--  WHERE source IS DISTINCT FROM 'osm'
--    AND map_visibility = 'public'
--    AND lat BETWEEN 52.20 AND 52.55
--    AND lng BETWEEN 16.65 AND 17.20
--    AND manager_id IS NULL
--    AND coalesce(booking_enabled, false) = false;

-- ===========================================================================
-- KROK 3 — COFNIĘCIE. Gdyby nowy katalog okazał się gorszy.
-- ===========================================================================
--
-- UPDATE fields
--    SET map_visibility = previous_map_visibility,
--        previous_map_visibility = NULL
--  WHERE previous_map_visibility IS NOT NULL;
