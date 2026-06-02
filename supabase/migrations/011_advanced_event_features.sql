-- ============================================================
-- 011: Advanced event features — confirmations, teams, payments, stats
-- ============================================================

-- ---- Feature flags on events ---------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS require_sms_confirmation  BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_attendance          BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_mode                 TEXT      NOT NULL DEFAULT 'brak'
    CHECK (team_mode IN ('brak', 'reczne', 'kapitanowie', 'losowe')),
  ADD COLUMN IF NOT EXISTS track_payments            BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_payment_status       BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_results             BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmation_deadline_h   SMALLINT  NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS cost_grosz                INT       NOT NULL DEFAULT 0;

-- ---- Feature flags on recurring_events -----------------------
ALTER TABLE recurring_events
  ADD COLUMN IF NOT EXISTS require_sms_confirmation  BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_attendance          BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS team_mode                 TEXT      NOT NULL DEFAULT 'brak'
    CHECK (team_mode IN ('brak', 'reczne', 'kapitanowie', 'losowe')),
  ADD COLUMN IF NOT EXISTS track_payments            BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_payment_status       BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_results             BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_grosz                INT       NOT NULL DEFAULT 0;

-- ---- Extend event_participants --------------------------------
ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS status             TEXT        NOT NULL DEFAULT 'zaproszony'
    CHECK (status IN ('zaproszony', 'potwierdzony', 'odrzucony', 'brak_odpowiedzi')),
  ADD COLUMN IF NOT EXISTS confirmed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team               TEXT        CHECK (team IN ('A', 'B')),
  ADD COLUMN IF NOT EXISTS paid_amount        INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phone              TEXT,
  ADD COLUMN IF NOT EXISTS confirmation_token TEXT        UNIQUE,
  ADD COLUMN IF NOT EXISTS is_captain         BOOLEAN     NOT NULL DEFAULT false;

-- Existing registered participants are already confirmed
UPDATE event_participants
  SET status = 'potwierdzony', confirmed_at = created_at
  WHERE user_id IS NOT NULL AND status = 'zaproszony';

-- Policy: organizer can update participant fields (status, team, paid, etc.)
DROP POLICY IF EXISTS "Organiser updates participant" ON event_participants;
CREATE POLICY "Organiser updates participant"
  ON event_participants FOR UPDATE
  USING  (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id))
  WITH CHECK (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id));

-- ---- match_results -------------------------------------------
CREATE TABLE IF NOT EXISTS match_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES events ON DELETE CASCADE UNIQUE,
  score_a       SMALLINT    NOT NULL DEFAULT 0,
  score_b       SMALLINT    NOT NULL DEFAULT 0,
  recorded_by   UUID        REFERENCES auth.users,
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read match results"
  ON match_results FOR SELECT USING (true);

CREATE POLICY "Organizer manages match results"
  ON match_results FOR ALL
  USING  (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()));

-- ---- player_goals --------------------------------------------
CREATE TABLE IF NOT EXISTS player_goals (
  id             UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID     NOT NULL REFERENCES events ON DELETE CASCADE,
  participant_id UUID     NOT NULL REFERENCES event_participants ON DELETE CASCADE,
  goals          SMALLINT NOT NULL DEFAULT 1 CHECK (goals >= 0),
  UNIQUE (event_id, participant_id)
);

ALTER TABLE player_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read player goals"
  ON player_goals FOR SELECT USING (true);

CREATE POLICY "Organizer manages player goals"
  ON player_goals FOR ALL
  USING  (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()));

-- ---- player_stats (per user per recurring group) -------------
CREATE TABLE IF NOT EXISTS player_stats (
  id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID     NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  recurring_event_id   UUID     REFERENCES recurring_events ON DELETE CASCADE,
  invited_count        INT      NOT NULL DEFAULT 0,
  confirmed_count      INT      NOT NULL DEFAULT 0,
  no_show_count        INT      NOT NULL DEFAULT 0,
  goals_total          INT      NOT NULL DEFAULT 0,
  matches_played       INT      NOT NULL DEFAULT 0,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, recurring_event_id)
);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Organizers of the recurring group can read stats
CREATE POLICY "Organizer reads group player stats"
  ON player_stats FOR SELECT
  USING (
    recurring_event_id IS NULL OR
    EXISTS (
      SELECT 1 FROM recurring_events
      WHERE id = recurring_event_id AND organizer_id = auth.uid()
    )
  );

-- Service role (Edge Functions) can write stats
CREATE POLICY "Users can manage own stats"
  ON player_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- player_reports ------------------------------------------
CREATE TABLE IF NOT EXISTS player_reports (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID        NOT NULL REFERENCES events ON DELETE CASCADE,
  reported_participant_id UUID      NOT NULL REFERENCES event_participants ON DELETE CASCADE,
  reporter_id           UUID        REFERENCES auth.users,
  report_type           TEXT        NOT NULL
    CHECK (report_type IN ('niesportowe_zachowanie', 'nie_przyszedl', 'inne')),
  comment               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE player_reports ENABLE ROW LEVEL SECURITY;

-- Only organizer of the event can see reports
CREATE POLICY "Organizer reads reports for their events"
  ON player_reports FOR SELECT
  USING (EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()));

-- Authenticated users can file reports
CREATE POLICY "Authenticated can submit reports"
  ON player_reports FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
