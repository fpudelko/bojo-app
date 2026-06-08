-- 032_field_venue_type.sql
-- AI satellite-image analysis: full classification of every venue

ALTER TABLE fields
  -- Core classification
  ADD COLUMN IF NOT EXISTS venue_type      TEXT,        -- full_size|seven_a_side|five_a_side|orlik|futsal_hall|basketball_full|basketball_half|volleyball_outdoor|volleyball_beach|tennis_outdoor|multi_sport|other
  ADD COLUMN IF NOT EXISTS dimensions_m    TEXT,        -- "105×68", "56×26", etc. — approximate playing area
  ADD COLUMN IF NOT EXISTS pitch_count     SMALLINT,    -- number of separate pitches/courts at this location

  -- Access / ownership context
  ADD COLUMN IF NOT EXISTS access_type     TEXT,        -- public|school|private|club|unknown

  -- Verification — some OSM entries are wrongly tagged
  ADD COLUMN IF NOT EXISTS is_verified_venue BOOLEAN,  -- Claude confirms it is actually a sports venue

  -- Visible infrastructure (fills in gaps where scraper left NULLs)
  -- NOTE: lit, has_changing_rooms, has_shower, has_toilets already exist from 019
  ADD COLUMN IF NOT EXISTS has_stands      BOOLEAN,    -- bleachers / tribune visible
  ADD COLUMN IF NOT EXISTS has_fence       BOOLEAN,    -- enclosed / fenced perimeter

  -- Condition estimate
  ADD COLUMN IF NOT EXISTS condition       TEXT,        -- good|fair|poor|unknown

  -- Free-form AI notes (unusual features, uncertainty, etc.)
  ADD COLUMN IF NOT EXISTS ai_notes        TEXT,

  -- Audit
  ADD COLUMN IF NOT EXISTS ai_typed_at     TIMESTAMPTZ;

COMMENT ON COLUMN fields.venue_type      IS 'AI label: full_size | seven_a_side | five_a_side | orlik | futsal_hall | basketball_full | basketball_half | volleyball_outdoor | volleyball_beach | tennis_outdoor | multi_sport | other';
COMMENT ON COLUMN fields.dimensions_m    IS 'Approximate playing area e.g. "105×68". Estimated from satellite.';
COMMENT ON COLUMN fields.pitch_count     IS 'Number of separate pitches/courts at this location.';
COMMENT ON COLUMN fields.access_type     IS 'public (park/street) | school | private | club | unknown';
COMMENT ON COLUMN fields.is_verified_venue IS 'Claude confirms the location is actually a sports venue (filters bad OSM data).';
COMMENT ON COLUMN fields.has_stands      IS 'Bleachers or tribune structure visible from satellite.';
COMMENT ON COLUMN fields.has_fence       IS 'Enclosed/fenced perimeter visible.';
COMMENT ON COLUMN fields.condition       IS 'Visual condition: good | fair | poor | unknown';
COMMENT ON COLUMN fields.ai_notes        IS 'Free-form notes from Claude: uncertainty, unusual features, etc.';
COMMENT ON COLUMN fields.ai_typed_at     IS 'Timestamp of last Claude satellite analysis.';
