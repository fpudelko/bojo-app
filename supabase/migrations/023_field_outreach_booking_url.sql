-- Add booking URL and provider columns to field_outreach.
-- Populated by enrich_booking.py when it detects an online booking system.
ALTER TABLE field_outreach
  ADD COLUMN IF NOT EXISTS booking_url      TEXT,
  ADD COLUMN IF NOT EXISTS booking_provider TEXT;

COMMENT ON COLUMN field_outreach.booking_url      IS 'Direct link to reservation form / external platform';
COMMENT ON COLUMN field_outreach.booking_provider IS 'Platform name (Hally, Booksy, Calendly, etc.)';
