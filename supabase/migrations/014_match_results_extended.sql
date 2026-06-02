-- ============================================================
-- 014: Flexible match results — result_data JSONB per sport
-- Extends the existing match_results table (from 011) with a flexible
-- JSON column. score_a / score_b are kept for backward compat.
-- ============================================================

ALTER TABLE match_results
  ADD COLUMN IF NOT EXISTS result_data JSONB,
  ADD COLUMN IF NOT EXISTS winner      TEXT CHECK (winner IN ('A', 'B', 'remis'));

-- Per-player flexible stats (replaces the narrow player_goals for non-football sports)
CREATE TABLE IF NOT EXISTS player_match_stats (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events ON DELETE CASCADE,
  participant_id UUID        NOT NULL REFERENCES event_participants ON DELETE CASCADE,
  stat_data      JSONB       NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, participant_id)
);

ALTER TABLE player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads player match stats"
  ON player_match_stats FOR SELECT USING (true);

CREATE POLICY "Organizer manages player match stats"
  ON player_match_stats FOR ALL
  USING  (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()));
