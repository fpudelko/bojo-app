-- 037_field_photo_url.sql
-- Venue photo: best available image (Google Places, Wikimedia Commons, or satellite)
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS photo_url    TEXT,
  ADD COLUMN IF NOT EXISTS photo_source TEXT;  -- 'google' | 'wikimedia' | 'satellite'

COMMENT ON COLUMN fields.photo_url    IS 'Primary venue photo URL (Google Places, Wikimedia Commons, or Mapbox satellite).';
COMMENT ON COLUMN fields.photo_source IS 'Origin of photo_url: google | wikimedia | satellite';
