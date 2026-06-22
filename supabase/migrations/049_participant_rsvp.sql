-- 049: RSVP status for participants
-- 'yes' = confirmed (default, existing behaviour)
-- 'maybe' = interested but not committed; shows in moje-gry, doesn't take a spot

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS rsvp TEXT NOT NULL DEFAULT 'yes'
  CHECK (rsvp IN ('yes', 'maybe'));

-- "maybe" participants are not counted toward capacity
-- (capacity check in joinEvent already uses is_reserve; maybe also skips the spot)
CREATE INDEX IF NOT EXISTS idx_participants_rsvp
  ON event_participants (event_id, rsvp)
  WHERE rsvp = 'maybe';
