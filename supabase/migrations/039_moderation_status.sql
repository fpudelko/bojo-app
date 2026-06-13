-- 039_moderation_status.sql
-- Admin moderation workflow for venues

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN fields.moderation_status IS 'Admin review state: pending | approved | hidden';

CREATE INDEX IF NOT EXISTS idx_fields_moderation_status
  ON fields (moderation_status);
