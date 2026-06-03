-- 019_fields_facilities.sql
-- Add venue facility columns populated by the OSM scraper.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS postcode           VARCHAR(10),
  ADD COLUMN IF NOT EXISTS lit                BOOLEAN,
  ADD COLUMN IF NOT EXISTS access             TEXT,
  ADD COLUMN IF NOT EXISTS fee                BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_changing_rooms BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_shower         BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_toilets        BOOLEAN,
  ADD COLUMN IF NOT EXISTS capacity           SMALLINT;
