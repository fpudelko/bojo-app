-- ============================================================
-- 013: Event reminders — configurable by organizer
-- ============================================================

CREATE TABLE IF NOT EXISTS event_reminders (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES events ON DELETE CASCADE,
  offset_minutes INT         NOT NULL CHECK (offset_minutes > 0),
  message        TEXT,
  channel        TEXT        NOT NULL DEFAULT 'sms'
    CHECK (channel IN ('sms', 'email', 'both')),
  sent           BOOLEAN     NOT NULL DEFAULT false,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

-- Organizer manages their own reminders
CREATE POLICY "Organizer manages reminders"
  ON event_reminders FOR ALL
  USING  (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()));

-- Index for the scheduled job that finds reminders to send
CREATE INDEX IF NOT EXISTS idx_event_reminders_unsent
  ON event_reminders (event_id, sent)
  WHERE sent = false;
