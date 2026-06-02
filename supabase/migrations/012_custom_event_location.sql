-- ============================================================
-- 012: Custom event location fields
-- Events can have a location outside the fields DB (e.g. private pitch,
-- street court). These fields are nullable and only used when the event
-- is NOT pinned to a field from the map.
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS custom_location_name TEXT,
  ADD COLUMN IF NOT EXISTS custom_address        TEXT;
