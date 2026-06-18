-- 048: Join approval — when an event has require_approval = true (added in 041),
-- new participants land in a "pending" state until the organizer approves them.
-- Pending participants don't count toward capacity and aren't shown in the
-- roster. Approving flips the flag; rejecting deletes the row.
--
-- Organizer approve (UPDATE) and reject (DELETE) are already covered by the
-- existing participant RLS policies (011), so no policy changes are needed.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT false;

-- Fast lookup of an event's pending requests.
CREATE INDEX IF NOT EXISTS idx_participants_pending
  ON event_participants (event_id)
  WHERE pending_approval = true;
