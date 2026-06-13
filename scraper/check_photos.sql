-- Photo distribution audit
-- Run in Supabase SQL editor or via psql

SELECT
  COALESCE(photo_source, '(none)') AS source,
  COUNT(*)                          AS total,
  COUNT(photo_reference)            AS has_photo_reference,
  COUNT(photo_url)                  AS has_photo_url
FROM fields
GROUP BY photo_source
ORDER BY total DESC;

-- Which venues have a Google photo_reference ready to proxy?
SELECT id, name, google_place_id, LEFT(photo_reference, 30) || '…' AS photo_ref_preview
FROM fields
WHERE photo_reference IS NOT NULL
ORDER BY name;

-- Venues still missing any photo
SELECT id, name, lat, lng
FROM fields
WHERE photo_reference IS NULL AND photo_url IS NULL AND lat IS NOT NULL
ORDER BY name;
