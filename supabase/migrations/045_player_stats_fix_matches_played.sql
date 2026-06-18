-- 045: Fix matches_played definition
-- Old: events that have a match_result record
-- New: non-cancelled events that have started (event_date + event_time <= now())
--      where the player was a non-reserve, non-guest participant

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

    -- matches actually played: non-reserve participant, event not cancelled, event has started
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id    = p_user_id
        AND ep.is_guest   = false
        AND ep.is_reserve = false
        AND e.status      != 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

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
