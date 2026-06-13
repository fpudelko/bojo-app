-- 038_google_place_id.sql
-- Google Places integration: store place_id and photo_reference for proxy display
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT,
  ADD COLUMN IF NOT EXISTS photo_reference  TEXT;  -- Google Places photo_reference (proxied via /api/venue-photo)

COMMENT ON COLUMN fields.google_place_id IS 'Google Places place_id — used to look up photos, reviews etc.';
COMMENT ON COLUMN fields.photo_reference IS 'Google Places photo_reference for the primary venue photo. Display via /api/venue-photo?ref=<value>.';

CREATE INDEX IF NOT EXISTS idx_fields_google_place_id ON fields (google_place_id) WHERE google_place_id IS NOT NULL;
