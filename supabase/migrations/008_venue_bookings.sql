-- Add manager + bookable columns to fields
ALTER TABLE fields ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users ON DELETE SET NULL;
ALTER TABLE fields ADD COLUMN IF NOT EXISTS is_bookable BOOLEAN NOT NULL DEFAULT false;

-- Managers can create new fields
CREATE POLICY "Managers can insert fields"
  ON fields FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

-- Managers can update their own fields
DROP POLICY IF EXISTS "Admins can update fields" ON fields;
CREATE POLICY "Admins or managers can update fields"
  ON fields FOR UPDATE
  USING (
    auth.uid() = manager_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    auth.uid() = manager_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ------------------------------------------------------------
-- Venue schedules (per day-of-week opening hours + slot size)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venue_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields ON DELETE CASCADE,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  open_time    TIME NOT NULL,
  close_time   TIME NOT NULL,
  slot_minutes SMALLINT NOT NULL DEFAULT 60 CHECK (slot_minutes IN (30, 60, 90, 120)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (field_id, day_of_week)
);

ALTER TABLE venue_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read schedules"
  ON venue_schedules FOR SELECT USING (true);

CREATE POLICY "Manager manages schedules"
  ON venue_schedules FOR ALL
  USING  (EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid()));

-- ------------------------------------------------------------
-- Venue pricing rules
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS venue_pricing (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id     UUID NOT NULL REFERENCES fields ON DELETE CASCADE,
  name         TEXT NOT NULL,
  price_grosz  INT NOT NULL CHECK (price_grosz >= 0),
  day_of_week  SMALLINT[],   -- NULL = all days
  time_from    TIME,          -- NULL = from open
  time_to      TIME,          -- NULL = to close
  priority     SMALLINT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE venue_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read pricing"
  ON venue_pricing FOR SELECT USING (true);

CREATE POLICY "Manager manages pricing"
  ON venue_pricing FOR ALL
  USING  (EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid()));

-- ------------------------------------------------------------
-- Bookings
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    UUID NOT NULL REFERENCES fields,
  user_id     UUID NOT NULL REFERENCES auth.users,
  user_name   TEXT NOT NULL,
  date        DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  price_grosz INT NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- User sees their own; manager sees bookings for their fields
CREATE POLICY "Users and managers can read bookings"
  ON bookings FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid())
  );

CREATE POLICY "Users can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users cancel their own pending bookings
CREATE POLICY "Users can cancel own pending bookings"
  ON bookings FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Managers can confirm/cancel bookings for their fields
CREATE POLICY "Managers can update bookings for their fields"
  ON bookings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM fields WHERE id = field_id AND manager_id = auth.uid()));
