-- Add district (dzielnica) column to fields table
ALTER TABLE fields
  ADD COLUMN district text;

-- Index for filtering/sorting by district
CREATE INDEX fields_district_idx ON fields (district) WHERE district IS NOT NULL;
