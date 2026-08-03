-- Obiekty PUBLICZNE — to, co widzi użytkownik na mapie.
-- Kolejne strony: zmień OFFSET 0 na 300, 600, 900, 1200.
-- Format: nazwa ~ adres ~ lat,lng ~ sporty ~ nawierzchnia ~ typ ~ źródło ~ flagi
-- Flagi: AI = opisane przez model, T = telefon, W = strona, M = e-mail, Z = zdjęcie

SELECT format('%s ~ %s ~ %s,%s ~ %s ~ %s ~ %s ~ %s ~ %s',
  name, coalesce(address, '—'),
  round(lat::numeric, 5), round(lng::numeric, 5),
  coalesce(array_to_string(sport, '+'), '—'),
  coalesce(surface, '—'), coalesce(venue_type, '—'), coalesce(source, '—'),
  concat_ws('',
    CASE WHEN ai_typed_at IS NOT NULL THEN 'AI' END,
    CASE WHEN phone   IS NOT NULL THEN 'T' END,
    CASE WHEN website IS NOT NULL THEN 'W' END,
    CASE WHEN email   IS NOT NULL THEN 'M' END,
    CASE WHEN photo_url IS NOT NULL OR photo_reference IS NOT NULL THEN 'Z' END)
) AS wynik
FROM fields
WHERE map_visibility = 'public'
ORDER BY name
LIMIT 300 OFFSET 0;
