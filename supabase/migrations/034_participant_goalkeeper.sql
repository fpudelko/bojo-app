-- 034: Goalkeeper slot for casual games
-- Players can join an open match either as an outfield player or as a goalkeeper.
-- This lets organizers see at a glance whether a keeper is still needed.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS is_goalkeeper boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN event_participants.is_goalkeeper IS
  'True when the player joined specifically as a goalkeeper (bramkarz).';
