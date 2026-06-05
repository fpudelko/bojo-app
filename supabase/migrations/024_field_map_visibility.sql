-- Add map_visibility to control where a field appears:
--   'public'         → public map + event creation picker
--   'organizer_only' → event creation picker only (no public map/browse)
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS map_visibility TEXT NOT NULL DEFAULT 'organizer_only'
  CHECK (map_visibility IN ('public', 'organizer_only'));

-- Fields that already have contact info are treated as public
UPDATE fields
SET map_visibility = 'public'
WHERE phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL;
