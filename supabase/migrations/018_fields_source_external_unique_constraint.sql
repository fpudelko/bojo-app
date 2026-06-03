-- 018_fields_source_external_unique_constraint.sql
-- PostgREST ON CONFLICT upsert requires a formal UNIQUE CONSTRAINT,
-- not just a UNIQUE INDEX. Convert the existing index to a constraint.

ALTER TABLE fields
  DROP CONSTRAINT IF EXISTS fields_source_external_key;

DROP INDEX IF EXISTS idx_fields_source_external;

ALTER TABLE fields
  ADD CONSTRAINT fields_source_external_key UNIQUE (source, external_id);
