-- Haversine distance helper (km)
CREATE OR REPLACE FUNCTION haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
RETURNS float8 LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT 6371.0 * 2.0 * asin(sqrt(
    pow(sin(radians((lat2 - lat1) / 2.0)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    pow(sin(radians((lng2 - lng1) / 2.0)), 2)
  ))
$$;

-- User alert preferences
CREATE TABLE game_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sport        text,                              -- NULL = any sport
  days_of_week int[] NOT NULL DEFAULT '{}',      -- [] = any day; 1=Mon…7=Sun (ISO)
  lat          float8 NOT NULL,
  lng          float8 NOT NULL,
  radius_km    int NOT NULL DEFAULT 15 CHECK (radius_km BETWEEN 1 AND 50),
  city_label   text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_alerts" ON game_alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- In-app notification inbox
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'game_alert',
  title      text NOT NULL,
  body       text,
  event_id   uuid REFERENCES events(id) ON DELETE CASCADE,
  alert_id   uuid REFERENCES game_alerts(id) ON DELETE SET NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifs_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_notifs_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- How many users are actively looking for a game matching given params
CREATE OR REPLACE FUNCTION count_alert_seekers(
  p_lat   float8,
  p_lng   float8,
  p_sport text,
  p_dow   int    -- ISO: 1=Mon…7=Sun
)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT user_id)::int
  FROM game_alerts
  WHERE is_active = true
    AND (sport IS NULL OR sport = p_sport)
    AND (days_of_week = '{}' OR p_dow = ANY(days_of_week))
    AND haversine_km(lat, lng, p_lat, p_lng) <= radius_km
$$;

-- Nearby public upcoming events (ordered by date)
CREATE OR REPLACE FUNCTION get_nearby_events(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8 DEFAULT 5.0,
  p_limit     int DEFAULT 6
)
RETURNS SETOF events LANGUAGE sql STABLE AS $$
  SELECT * FROM events
  WHERE visibility = 'public'
    AND status = 'active'
    AND event_date >= current_date
    AND lat IS NOT NULL AND lng IS NOT NULL
    AND haversine_km(lat, lng, p_lat, p_lng) <= p_radius_km
  ORDER BY event_date, event_time
  LIMIT p_limit
$$;
