-- ============================================================
-- 015: Event status (active/cancelled) + guest added_by tracking
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled'));

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users;
