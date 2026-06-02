-- Recurring event templates
CREATE TABLE IF NOT EXISTS recurring_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id       UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  organizer_name     TEXT NOT NULL,
  sport              TEXT NOT NULL,
  field_id           UUID REFERENCES fields,
  field_name         TEXT NOT NULL,
  lat                NUMERIC,
  lng                NUMERIC,
  title              TEXT,
  description        TEXT,
  day_of_week        SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon … 7=Sun
  event_time         TIME NOT NULL,
  end_time           TIME,
  max_players        INT NOT NULL DEFAULT 10,
  visibility         TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','private')),
  notify_days_before SMALLINT NOT NULL DEFAULT 3,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Readable recurring events"
  ON recurring_events FOR SELECT
  USING (auth.uid() = organizer_id OR visibility = 'public');

CREATE POLICY "Organizer inserts recurring events"
  ON recurring_events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizer updates recurring events"
  ON recurring_events FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizer deletes recurring events"
  ON recurring_events FOR DELETE
  USING (auth.uid() = organizer_id);

-- Invite list per recurring event
CREATE TABLE IF NOT EXISTS recurring_event_invites (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_event_id   UUID NOT NULL REFERENCES recurring_events ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  email                TEXT,
  phone                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE recurring_event_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organizer manages invites"
  ON recurring_event_invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recurring_events
      WHERE id = recurring_event_id AND organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recurring_events
      WHERE id = recurring_event_id AND organizer_id = auth.uid()
    )
  );
