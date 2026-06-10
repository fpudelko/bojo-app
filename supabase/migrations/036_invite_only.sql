-- 036: Invite-only events + email invite management

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS invite_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.invite_only IS
  'When true, only users with a valid invite token can join the event.';

CREATE TABLE IF NOT EXISTS event_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  invited_by  uuid        REFERENCES auth.users(id),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  note        text,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_invites_event_email
  ON event_invites(event_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_event_invites_token
  ON event_invites(token);

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Organizer can manage all invites for their events
DROP POLICY IF EXISTS "Organizer manages invites" ON event_invites;
CREATE POLICY "Organizer manages invites"
  ON event_invites FOR ALL
  USING (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id))
  WITH CHECK (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id));

-- Token lookup is public (anyone with the token can validate it)
DROP POLICY IF EXISTS "Token validation read" ON event_invites;
CREATE POLICY "Token validation read"
  ON event_invites FOR SELECT
  USING (true);
