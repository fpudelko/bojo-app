-- 052: Optional goalkeeper distinction per event. When false, there is no
-- goalkeeper/field-player split at all (no goalkeeper option on join, no BR
-- badge). When true, players may join as goalkeeper and the max_goalkeepers
-- cap (default 2) applies — extras overflow to the reserve list.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS goalkeepers_enabled BOOLEAN NOT NULL DEFAULT false;
