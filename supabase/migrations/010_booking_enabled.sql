-- Add booking_enabled flag so a single field can enable reservations
-- even when the global FEATURE_RESERVATIONS env flag is off.
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT false;
