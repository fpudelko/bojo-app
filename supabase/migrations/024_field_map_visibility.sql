-- Add map_visibility to control where a field appears:
--   'public'         → public map + event creation picker
--   'organizer_only' → event creation picker only (no public map/browse)
--   'hidden'         → nowhere (for junk/duplicate AI-enriched entries)
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS map_visibility TEXT NOT NULL DEFAULT 'organizer_only'
  CHECK (map_visibility IN ('public', 'organizer_only', 'hidden'));

-- Fields that have any contact info are set as public by default
UPDATE fields
SET map_visibility = 'public'
WHERE phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL;
