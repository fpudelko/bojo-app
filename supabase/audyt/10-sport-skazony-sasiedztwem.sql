-- DOWÓD: analiza satelitarna dopisała do obiektu sporty z SĄSIEDNICH obiektów.
--
-- Mechanizm (scraper/analyze_venues.py, build_update):
--   update["sport"] = merged   -- sporty z AI DOKLEJONE do sportów z OSM
-- Model dostaje kafelek Mapbox zoom 18 (~150 m boku), czyli cały kompleks,
-- i opisuje wszystko, co widzi. Kort obok boiska do koszykówki wpada do
-- sportów tego boiska.
--
-- Nazwa obiektu pochodzi z ORYGINALNEGO tagu OSM i nie była nadpisywana,
-- więc pokazuje, czym obiekt był przed analizą.
--
-- Podgląd. Nic nie zapisuje.

SELECT format('%s | sporty w bazie: %s | typ AI: %s | %s',
  name,
  array_to_string(sport, '+'),
  coalesce(venue_type, '—'),
  coalesce(address, '—')) AS wynik
FROM fields
WHERE ai_typed_at IS NOT NULL
  AND array_length(sport, 1) > 1
  AND (
       (name ILIKE 'Boisko — koszykówka%' AND 'tenis' = ANY(sport))
    OR (name ILIKE 'Boisko — piłka nożna%' AND 'tenis' = ANY(sport))
    OR (name ILIKE 'Boisko — koszykówka%' AND 'siatkówka plażowa' = ANY(sport))
  )
ORDER BY name, address
LIMIT 200;
