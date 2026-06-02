-- Add booking_type and booking_url to fields
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'none'
    CHECK (booking_type IN ('internal', 'external', 'none')),
  ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Migrate existing is_bookable=true → booking_type='internal'
UPDATE fields SET booking_type = 'internal' WHERE is_bookable = true AND booking_type = 'none';

-- Extend bookings with sport, players_count, phone
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sport TEXT,
  ADD COLUMN IF NOT EXISTS players_count SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Managers can also update booking_type / booking_url (already covered by existing manager update policy)
-- Admin can update all fields (already covered by existing admin update policy)
