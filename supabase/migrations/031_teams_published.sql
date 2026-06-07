-- Allow organizer to manage squads privately before revealing them to participants
ALTER TABLE events ADD COLUMN IF NOT EXISTS teams_published boolean NOT NULL DEFAULT false;
