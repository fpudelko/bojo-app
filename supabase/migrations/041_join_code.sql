-- Migration 041: Replace invite-only token system with join codes
-- Each event gets a short, shareable join code (e.g. "K7QP4B").
-- Organizer can optionally require approval before participants are confirmed.

-- 1. Helper function: generate a random 6-char code (no O/0/I/1/L to avoid confusion)
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i      INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Add columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS join_code       TEXT UNIQUE DEFAULT generate_join_code(),
  ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;

-- 3. Backfill existing events that have no code yet
UPDATE events SET join_code = generate_join_code() WHERE join_code IS NULL;

-- 4. Make join_code NOT NULL now that all rows have one
ALTER TABLE events ALTER COLUMN join_code SET NOT NULL;

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_events_join_code ON events (join_code);

-- 5. Drop old invite system
DROP TABLE IF EXISTS event_invites CASCADE;
ALTER TABLE events DROP COLUMN IF EXISTS invite_only;

-- 6. RLS: anyone can look up an event by join_code (needed for /d/[code] route)
-- The existing "Public events are viewable by everyone" policy already covers public events.
-- Private events need an explicit policy so the redirect route can resolve them.
CREATE POLICY "Join code lookup" ON events
  FOR SELECT USING (join_code IS NOT NULL);
