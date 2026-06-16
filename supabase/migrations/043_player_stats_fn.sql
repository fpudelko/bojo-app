-- 043: Real per-player statistics, aggregated across ALL events
-- (the old /gracz/[id] page read player_stats, which is only populated for
--  recurring-event groups, so goals/attendance showed 0 for most users).
--
-- SECURITY INVOKER + STABLE — every underlying table is already public-readable
-- under RLS, so no elevated privileges are needed.

CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  attended          INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- distinct events the user signed up for (as a real account, not a guest)
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false),
    -- events organized
    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),
    -- matches actually played: participated (non-reserve) in an event that has a result
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN match_results mr ON mr.event_id = ep.event_id
      WHERE ep.user_id = p_user_id AND ep.is_guest = false AND ep.is_reserve = false),
    -- total goals scored across all events
    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),
    -- confirmed attendances
    (SELECT count(*)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false AND ep.status = 'potwierdzony'),
    -- no-shows reported against the player
    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;
