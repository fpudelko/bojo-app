-- Event comments (soft-delete, max 1000 chars)
CREATE TABLE event_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_name  text NOT NULL,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read non-deleted comments
CREATE POLICY "comments_select" ON event_comments FOR SELECT USING (deleted_at IS NULL);
-- Authenticated users can add their own comments
CREATE POLICY "comments_insert" ON event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Only the author can soft-delete their comment
CREATE POLICY "comments_update" ON event_comments FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Event activity log — append-only audit trail
-- action types: event_created, event_updated, event_cancelled, event_restored,
--               participant_joined, participant_left, guest_added, participant_removed,
--               payment_updated, status_changed, visibility_changed,
--               result_saved, comment_added, team_assigned, teams_randomized
CREATE TABLE event_activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  user_name  text,
  action     text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_activity_log ENABLE ROW LEVEL SECURITY;

-- Organizers can read the log for their own events
CREATE POLICY "activity_log_select" ON event_activity_log FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id AND events.organizer_id = auth.uid())
  );

-- Any authenticated user can insert (app controls what gets logged)
CREATE POLICY "activity_log_insert" ON event_activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
