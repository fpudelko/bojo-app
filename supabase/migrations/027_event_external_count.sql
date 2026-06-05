-- How many players are already committed OUTSIDE the app (offline / other channels).
-- Lets an organizer say "we have 7, need 3 more" — spots & reserve logic count these in.
ALTER TABLE events
  ADD COLUMN external_count int NOT NULL DEFAULT 0 CHECK (external_count >= 0);
