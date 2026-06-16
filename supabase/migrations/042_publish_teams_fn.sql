-- 042: RPC helper for toggling teams_published
-- Bypasses direct PATCH issue; runs as the calling user (SECURITY INVOKER)
-- so the organizer_id check enforces ownership server-side.

CREATE OR REPLACE FUNCTION set_event_teams_published(
  p_event_id  UUID,
  p_published BOOLEAN
)
RETURNS VOID
LANGUAGE SQL
SECURITY INVOKER
AS $$
  UPDATE events
  SET    teams_published = p_published
  WHERE  id = p_event_id
    AND  organizer_id = auth.uid();
$$;
