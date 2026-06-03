-- 020_field_outreach.sql
-- Internal CRM for contacting venues: track outreach status, who's handling
-- each venue, what reservation system they use, and free-form notes.
-- Admin-only (RLS). One row per field.

CREATE TABLE IF NOT EXISTS field_outreach (
  field_id          UUID PRIMARY KEY REFERENCES fields ON DELETE CASCADE,

  -- Pipeline stage
  status            TEXT NOT NULL DEFAULT 'nowy'
    CHECK (status IN (
      'nowy',                 -- not touched yet
      'do_kontaktu',          -- queued for contact
      'w_toku',               -- contacting in progress
      'czeka_na_odpowiedz',   -- waiting for their reply
      'odpowiedzial',         -- they replied
      'zainteresowany',       -- interested
      'umowiony',             -- deal / onboarded
      'odrzucony',            -- declined
      'brak_kontaktu'         -- unreachable / no contact info
    )),

  -- How they take reservations (the core thing we're establishing)
  booking_system    TEXT NOT NULL DEFAULT 'nieznany'
    CHECK (booking_system IN (
      'nieznany', 'telefon', 'email', 'wlasny_system', 'zewnetrzny', 'brak', 'inny'
    )),

  priority          SMALLINT NOT NULL DEFAULT 0,   -- 0 = normal, 1 = high (flagged)

  -- Claim model: a team member takes ownership so two people don't double-call.
  assigned_to       UUID REFERENCES auth.users ON DELETE SET NULL,
  assigned_name     TEXT,

  contact_person    TEXT,                          -- who they spoke with at the venue
  notes             TEXT,                          -- what they answered

  last_contacted_at TIMESTAMPTZ,
  next_followup_at  DATE,

  updated_by        UUID REFERENCES auth.users ON DELETE SET NULL,
  updated_by_name   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE field_outreach ENABLE ROW LEVEL SECURITY;

-- Admins have full access; nobody else can read or write outreach data.
CREATE POLICY "Admins manage outreach" ON field_outreach FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

CREATE INDEX IF NOT EXISTS idx_field_outreach_status   ON field_outreach (status);
CREATE INDEX IF NOT EXISTS idx_field_outreach_assigned ON field_outreach (assigned_to);
CREATE INDEX IF NOT EXISTS idx_field_outreach_followup ON field_outreach (next_followup_at)
  WHERE next_followup_at IS NOT NULL;
