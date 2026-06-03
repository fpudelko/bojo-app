-- 021_field_outreach_ai.sql
-- Store AI-enrichment results separately from human outreach notes, so the
-- panel can show "what the AI found" without clobbering what the team wrote.

ALTER TABLE field_outreach
  ADD COLUMN IF NOT EXISTS ai_summary      TEXT,
  ADD COLUMN IF NOT EXISTS ai_enriched_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_field_outreach_ai_enriched
  ON field_outreach (ai_enriched_at)
  WHERE ai_enriched_at IS NOT NULL;
