-- 017_fields_enrichment.sql
-- Add enrichment columns to fields: operator info, contact email,
-- description, photo URL, opening hours.
-- Populated by the scraper from OSM tags.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS operator        TEXT,
  ADD COLUMN IF NOT EXISTS operator_type   TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours   TEXT;
