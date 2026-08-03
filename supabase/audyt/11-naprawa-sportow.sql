-- ============================================================================
-- NAPRAWA: przywrócenie sportów sprzed analizy satelitarnej
-- ============================================================================
-- Analiza AI dokleiła do kolumny `sport` dyscypliny z sąsiednich obiektów na
-- tym samym kafelku satelitarnym. Skutek: filtr "koszykówka" na mapie Bojo
-- zwraca korty tenisowe, a filtr "tenis" zwraca boiska piłkarskie.
--
-- Nazwa obiektu (`name`) pochodzi z oryginalnego tagu OSM `sport` i NIE była
-- nadpisywana przez AI — nadaje się na źródło prawdy.
--
-- Dotyczy wyłącznie obiektów o nazwie generycznej ("Boisko — <sport>").
-- Obiekty nazwane (POSiR, Orlik Skórzewo, hale) zostają nietknięte.
--
-- Transakcja kończy się ROLLBACK. Zamień na COMMIT, gdy podgląd się zgadza.
-- ============================================================================

BEGIN;

-- Sport odczytany z nazwy: fragment między "— " a " ·" (albo do końca).
CREATE TEMP VIEW sport_z_nazwy AS
SELECT id, name, sport AS sport_teraz,
       btrim(split_part(regexp_replace(name, '^Boisko — ', ''), ' · ', 1)) AS sport_osm
FROM fields
WHERE name ~ '^Boisko — '
  AND ai_typed_at IS NOT NULL;

-- Co się zmieni.
SELECT format('%s | %s  →  %s',
  name, array_to_string(sport_teraz, '+'), sport_osm) AS wynik
FROM sport_z_nazwy
WHERE sport_teraz IS DISTINCT FROM ARRAY[sport_osm]
ORDER BY name
LIMIT 300;

-- Ile wierszy dotknie.
SELECT format('do naprawy: %s obiektów', count(*)) AS wynik
FROM sport_z_nazwy
WHERE sport_teraz IS DISTINCT FROM ARRAY[sport_osm];

UPDATE fields f
SET sport = ARRAY[s.sport_osm]
FROM sport_z_nazwy s
WHERE f.id = s.id
  AND f.sport IS DISTINCT FROM ARRAY[s.sport_osm];

-- Typ z AI też opisuje kafelek, nie obiekt — przy nazwie generycznej
-- kasujemy go, żeby nie kłócił się z nazwą.
UPDATE fields
SET venue_type = NULL
WHERE name ~ '^Boisko — '
  AND ai_typed_at IS NOT NULL
  AND venue_type IN ('tennis_outdoor', 'volleyball_beach', 'futsal_hall',
                     'basketball_full', 'basketball_half')
  AND name NOT ILIKE '%' || CASE venue_type
        WHEN 'tennis_outdoor'    THEN 'tenis'
        WHEN 'volleyball_beach'  THEN 'siatkówka plażowa'
        WHEN 'futsal_hall'       THEN 'futsal'
        ELSE 'koszykówka' END || '%';

ROLLBACK;  -- ← zamień na COMMIT, gdy podgląd się zgadza
