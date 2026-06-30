-- 050: Goalkeeper cap per event (football). Once this many goalkeepers are in
-- the regular roster, additional goalkeepers overflow to the reserve list.
-- Default 2 (one per team).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_goalkeepers SMALLINT NOT NULL DEFAULT 2;
