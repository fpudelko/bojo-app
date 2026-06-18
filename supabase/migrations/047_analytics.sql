-- 047: Analytics — lightweight, app-wide event stream for product analytics.
-- Unlike event_activity_log (which is scoped to a single match and readable by
-- that match's organizer), this table captures cross-app user actions —
-- logins, event/group creation and joins — so admins can measure activation
-- and retention. Append-only; readable by admins only.

CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  path       TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created   ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_type      ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user      ON analytics_events (user_id);
-- For "distinct active users per day" style queries
CREATE INDEX IF NOT EXISTS idx_analytics_user_day  ON analytics_events (user_id, created_at);

-- --- RLS --------------------------------------------------------------------
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may append their own events. The app sets user_id to
-- the acting user; we don't allow spoofing another user's id.
DROP POLICY IF EXISTS "Users append own analytics" ON analytics_events;
CREATE POLICY "Users append own analytics" ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins can read the stream.
DROP POLICY IF EXISTS "Admins read analytics" ON analytics_events;
CREATE POLICY "Admins read analytics" ON analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
