-- ============================================================================
-- BOJO — migracje, część 2 z 3
-- ============================================================================
-- Zawiera 20 migracji: 021_field_outreach_ai.sql → 040_admin_delete_events.sql
-- 
-- Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.
-- Uruchamiaj części PO KOLEI — późniejsze migracje zakładają wcześniejsze.
-- 
-- Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 021_field_outreach_ai.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 021_field_outreach_ai.sql
-- Store AI-enrichment results separately from human outreach notes, so the
-- panel can show "what the AI found" without clobbering what the team wrote.

ALTER TABLE field_outreach
  ADD COLUMN IF NOT EXISTS ai_summary      TEXT,
  ADD COLUMN IF NOT EXISTS ai_enriched_at  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_field_outreach_ai_enriched
  ON field_outreach (ai_enriched_at)
  WHERE ai_enriched_at IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 022_profiles_users_admin.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 022_profiles_users_admin.sql
-- Fix admin management:
--  1. A profiles row now exists for EVERY user (previously only created on
--     avatar upload — which is why `UPDATE profiles SET is_admin` hit 0 rows).
--  2. Store email + display_name on the profile so the admin UI can show
--     who each account is (auth.users isn't readable from the client).
--  3. Auto-create a profile on signup.
--  4. Let admins toggle is_admin on any profile.

-- --- 1 & 2: columns -------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Backfill + ensure a row for every existing auth user.
INSERT INTO profiles (id, email, display_name, is_admin)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data ->> 'display_name',
    u.raw_user_meta_data ->> 'full_name',
    u.raw_user_meta_data ->> 'name'
  ),
  false
FROM auth.users u
ON CONFLICT (id) DO UPDATE
  SET email        = EXCLUDED.email,
      display_name = COALESCE(profiles.display_name, EXCLUDED.display_name);

-- --- 3: auto-create profile on new signup ---------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- --- 4: admins can update any profile (grant / revoke admin) ---------------
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- --- Bootstrap: make ALL current users admin (per request) -----------------
-- Remove or scope this line if you want only specific people to be admins.
UPDATE profiles SET is_admin = true;


-- ─────────────────────────────────────────────────────────────────────────
-- 023_field_outreach_booking_url.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add booking URL and provider columns to field_outreach.
-- Populated by enrich_booking.py when it detects an online booking system.
ALTER TABLE field_outreach
  ADD COLUMN IF NOT EXISTS booking_url      TEXT,
  ADD COLUMN IF NOT EXISTS booking_provider TEXT;

COMMENT ON COLUMN field_outreach.booking_url      IS 'Direct link to reservation form / external platform';
COMMENT ON COLUMN field_outreach.booking_provider IS 'Platform name (Hally, Booksy, Calendly, etc.)';


-- ─────────────────────────────────────────────────────────────────────────
-- 024_field_map_visibility.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add map_visibility to control where a field appears:
--   'public'         → public map + event creation picker
--   'organizer_only' → event creation picker only (no public map/browse)
--   'hidden'         → nowhere (for junk/duplicate AI-enriched entries)
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS map_visibility TEXT NOT NULL DEFAULT 'organizer_only'
  CHECK (map_visibility IN ('public', 'organizer_only', 'hidden'));

-- Fields that have any contact info are set as public by default
UPDATE fields
SET map_visibility = 'public'
WHERE phone IS NOT NULL OR email IS NOT NULL OR website IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 025_game_alerts.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Haversine distance helper (km)
CREATE OR REPLACE FUNCTION haversine_km(lat1 float8, lng1 float8, lat2 float8, lng2 float8)
RETURNS float8 LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT 6371.0 * 2.0 * asin(sqrt(
    pow(sin(radians((lat2 - lat1) / 2.0)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) *
    pow(sin(radians((lng2 - lng1) / 2.0)), 2)
  ))
$$;

-- User alert preferences
CREATE TABLE game_alerts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sport        text,                              -- NULL = any sport
  days_of_week int[] NOT NULL DEFAULT '{}',      -- [] = any day; 1=Mon…7=Sun (ISO)
  lat          float8 NOT NULL,
  lng          float8 NOT NULL,
  radius_km    int NOT NULL DEFAULT 15 CHECK (radius_km BETWEEN 1 AND 50),
  city_label   text,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_alerts" ON game_alerts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- In-app notification inbox
CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'game_alert',
  title      text NOT NULL,
  body       text,
  event_id   uuid REFERENCES events(id) ON DELETE CASCADE,
  alert_id   uuid REFERENCES game_alerts(id) ON DELETE SET NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notifs_select" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_notifs_update" ON notifications FOR UPDATE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- How many users are actively looking for a game matching given params
CREATE OR REPLACE FUNCTION count_alert_seekers(
  p_lat   float8,
  p_lng   float8,
  p_sport text,
  p_dow   int    -- ISO: 1=Mon…7=Sun
)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(DISTINCT user_id)::int
  FROM game_alerts
  WHERE is_active = true
    AND (sport IS NULL OR sport = p_sport)
    AND (days_of_week = '{}' OR p_dow = ANY(days_of_week))
    AND haversine_km(lat, lng, p_lat, p_lng) <= radius_km
$$;

-- Nearby public upcoming events (ordered by date)
CREATE OR REPLACE FUNCTION get_nearby_events(
  p_lat       float8,
  p_lng       float8,
  p_radius_km float8 DEFAULT 5.0,
  p_limit     int DEFAULT 6
)
RETURNS SETOF events LANGUAGE sql STABLE AS $$
  SELECT * FROM events
  WHERE visibility = 'public'
    AND status = 'active'
    AND event_date >= current_date
    AND lat IS NOT NULL AND lng IS NOT NULL
    AND haversine_km(lat, lng, p_lat, p_lng) <= p_radius_km
  ORDER BY event_date, event_time
  LIMIT p_limit
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 026_activity_log_and_comments.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Event comments (soft-delete, max 1000 chars)
CREATE TABLE event_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_name  text NOT NULL,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read non-deleted comments
CREATE POLICY "comments_select" ON event_comments FOR SELECT USING (deleted_at IS NULL);
-- Authenticated users can add their own comments
CREATE POLICY "comments_insert" ON event_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Only the author can soft-delete their comment
CREATE POLICY "comments_update" ON event_comments FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Event activity log — append-only audit trail
-- action types: event_created, event_updated, event_cancelled, event_restored,
--               participant_joined, participant_left, guest_added, participant_removed,
--               payment_updated, status_changed, visibility_changed,
--               result_saved, comment_added, team_assigned, teams_randomized
CREATE TABLE event_activity_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users ON DELETE SET NULL,
  user_name  text,
  action     text NOT NULL,
  payload    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE event_activity_log ENABLE ROW LEVEL SECURITY;

-- Organizers can read the log for their own events
CREATE POLICY "activity_log_select" ON event_activity_log FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM events WHERE events.id = event_id AND events.organizer_id = auth.uid())
  );

-- Any authenticated user can insert (app controls what gets logged)
CREATE POLICY "activity_log_insert" ON event_activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────────
-- 027_event_external_count.sql
-- ─────────────────────────────────────────────────────────────────────────
-- How many players are already committed OUTSIDE the app (offline / other channels).
-- Lets an organizer say "we have 7, need 3 more" — spots & reserve logic count these in.
ALTER TABLE events
  ADD COLUMN external_count int NOT NULL DEFAULT 0 CHECK (external_count >= 0);


-- ─────────────────────────────────────────────────────────────────────────
-- 028_field_district.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add district (dzielnica) column to fields table
ALTER TABLE fields
  ADD COLUMN district text;

-- Index for filtering/sorting by district
CREATE INDEX fields_district_idx ON fields (district) WHERE district IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 029_tournaments.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- 029_tournaments.sql — BOJO Community Cup
-- ----------------------------------------------------------------------------
-- Amatorski turniej drużynowy (Poznań, orliki) sterowany w aplikacji:
--   • format: faza grupowa (grupy po 3, awansuje 2) → pucharowa drabinka
--   • skalowalny: 16 / 32 / 48 / 64 drużyn (group_size, advance_per_group)
--   • drużyny umawiają mecze same w obrębie tygodnia (propozycja → akceptacja)
--   • orliki partnerskie proponują wolne sloty do rezerwacji na poczet turnieju
--   • skład z pozycjami (bramkarz / obrońca / pomocnik / napastnik)
-- ============================================================================

-- ── 1. Turniej (jeden wiersz = jedna edycja) ────────────────────────────────
CREATE TABLE tournaments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,                 -- np. 'community-cup-2026'
  name                text NOT NULL,
  sport               text NOT NULL DEFAULT 'piłka nożna',
  city                text NOT NULL DEFAULT 'Poznań',
  -- Stan rozgrywek — steruje tym, co widać na landingu i co można robić.
  status              text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft','registration','group_stage',
                                          'knockout','finals','completed')),
  -- Konfiguracja formatu (skalowalna — nic nie jest zahardkodowane na 64).
  format              text NOT NULL DEFAULT 'group_knockout',
  max_teams           int  NOT NULL DEFAULT 32 CHECK (max_teams BETWEEN 4 AND 128),
  group_size          int  NOT NULL DEFAULT 3  CHECK (group_size BETWEEN 3 AND 8),
  advance_per_group   int  NOT NULL DEFAULT 2  CHECK (advance_per_group BETWEEN 1 AND 4),
  -- Zasady składu.
  min_squad           int  NOT NULL DEFAULT 5  CHECK (min_squad BETWEEN 1 AND 20),
  max_squad           int  NOT NULL DEFAULT 10 CHECK (max_squad BETWEEN 1 AND 30),
  -- Terminy.
  registration_deadline timestamptz,
  start_date            date,
  finals_date           date,
  finals_venue          text,
  -- Treść landingu.
  tagline             text,
  prize_pool          text,
  rules               text,
  entry_fee_grosze    int  NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
-- Każdy (także niezalogowany) czyta — landing jest publiczny.
CREATE POLICY "tournaments_read" ON tournaments FOR SELECT USING (true);
-- Tylko admin zarządza edycją.
CREATE POLICY "tournaments_admin_write" ON tournaments FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 2. Grupy fazy grupowej ──────────────────────────────────────────────────
CREATE TABLE tournament_groups (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name          text NOT NULL,                 -- 'A', 'B', 'C', …
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, name)
);

ALTER TABLE tournament_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "groups_read" ON tournament_groups FOR SELECT USING (true);
CREATE POLICY "groups_admin_write" ON tournament_groups FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 3. Drużyny ──────────────────────────────────────────────────────────────
CREATE TABLE tournament_teams (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id     uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name              text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 40),
  district          text,                       -- dzielnica Poznania
  -- Kapitan zarządza drużyną. Musi być zalogowany.
  captain_id        uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  captain_name      text NOT NULL,
  captain_phone     text,
  captain_email     text,
  -- Cykl życia zgłoszenia.
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','confirmed','rejected',
                                        'eliminated','withdrawn')),
  paid_at           timestamptz,
  -- Rozstawienie i przydział do grupy (ustawiane przy losowaniu).
  group_id          uuid REFERENCES tournament_groups(id) ON DELETE SET NULL,
  seed              int,
  -- Dostępność tygodniowa — używana do parowania meczów „ten sam dzień”.
  availability_days int[] NOT NULL DEFAULT '{}',  -- 1=Pon…7=Niedz (ISO)
  availability_from time,
  availability_to   time,
  finals_confirmed  boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_teams_tournament ON tournament_teams(tournament_id);
CREATE INDEX idx_teams_group      ON tournament_teams(group_id);
CREATE INDEX idx_teams_captain    ON tournament_teams(captain_id);

ALTER TABLE tournament_teams ENABLE ROW LEVEL SECURITY;
-- Lista drużyn jest publiczna (landing pokazuje zarejestrowane ekipy).
CREATE POLICY "teams_read" ON tournament_teams FOR SELECT USING (true);
-- Zalogowany rejestruje drużynę jako jej kapitan.
CREATE POLICY "teams_insert" ON tournament_teams FOR INSERT
  WITH CHECK (auth.uid() = captain_id);
-- Kapitan edytuje swoją drużynę; admin każdą.
CREATE POLICY "teams_update" ON tournament_teams FOR UPDATE
  USING (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );
-- Kapitan może wycofać drużynę przed startem; admin zawsze.
CREATE POLICY "teams_delete" ON tournament_teams FOR DELETE
  USING (
    auth.uid() = captain_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );


-- ── 4. Skład z pozycjami ────────────────────────────────────────────────────
CREATE TABLE tournament_team_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       uuid NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users ON DELETE SET NULL,  -- opcjonalnie powiązany z kontem
  name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  position      text NOT NULL DEFAULT 'uniwersalny'
                  CHECK (position IN ('bramkarz','obrońca','pomocnik',
                                      'napastnik','uniwersalny')),
  shirt_number  int CHECK (shirt_number BETWEEN 1 AND 99),
  is_captain    boolean NOT NULL DEFAULT false,
  is_reserve    boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_members_team ON tournament_team_members(team_id);

ALTER TABLE tournament_team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members_read" ON tournament_team_members FOR SELECT USING (true);
-- Skład edytuje wyłącznie kapitan drużyny (lub admin).
CREATE POLICY "members_write" ON tournament_team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.id = team_id
        AND (t.captain_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.id = team_id
        AND (t.captain_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
    )
  );


-- ── 5. Orliki partnerskie + proponowane sloty ───────────────────────────────
CREATE TABLE tournament_venues (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  field_id      uuid REFERENCES fields(id) ON DELETE SET NULL,  -- link do bazy boisk
  name          text NOT NULL,
  address       text,
  district      text,
  is_partner    boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE tournament_venues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "venues_read" ON tournament_venues FOR SELECT USING (true);
CREATE POLICY "venues_admin_write" ON tournament_venues FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));

CREATE TABLE tournament_venue_slots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id     uuid NOT NULL REFERENCES tournament_venues(id) ON DELETE CASCADE,
  starts_at    timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60 CHECK (duration_min BETWEEN 30 AND 240),
  status       text NOT NULL DEFAULT 'free'
                 CHECK (status IN ('free','reserved','taken')),
  match_id     uuid,                 -- FK ustawiany po utworzeniu meczów (poniżej)
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_slots_venue ON tournament_venue_slots(venue_id);

ALTER TABLE tournament_venue_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "slots_read" ON tournament_venue_slots FOR SELECT USING (true);
-- Kapitan może zarezerwować wolny slot (status free→reserved); admin wszystko.
CREATE POLICY "slots_update" ON tournament_venue_slots FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "slots_admin_write" ON tournament_venue_slots FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 6. Mecze (faza grupowa + pucharowa) ─────────────────────────────────────
CREATE TABLE tournament_matches (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id     uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  stage             text NOT NULL DEFAULT 'group'
                      CHECK (stage IN ('group','round_of_32','round_of_16',
                                       'quarter','semi','third_place','final')),
  group_id          uuid REFERENCES tournament_groups(id) ON DELETE CASCADE,
  round             int,             -- numer rundy/kolejki w obrębie etapu
  bracket_position  int,             -- pozycja w drabince (do rysowania)
  -- Drużyny — NULL gdy jeszcze nieznane (np. „zwycięzca ćwierćfinału 1”).
  team_a_id         uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  team_b_id         uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  -- W drabince: z którego meczu „spływa” zwycięzca do tego slotu.
  feeds_a_match_id  uuid REFERENCES tournament_matches(id) ON DELETE SET NULL,
  feeds_b_match_id  uuid REFERENCES tournament_matches(id) ON DELETE SET NULL,
  -- Umawianie terminu (drużyny robią to same).
  proposed_by_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  proposed_slot     timestamptz,
  venue_slot_id     uuid REFERENCES tournament_venue_slots(id) ON DELETE SET NULL,
  venue_text        text,
  scheduled_at      timestamptz,
  -- Stan i wynik.
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending','proposed','scheduled',
                                        'played','walkover','disputed')),
  score_a           int,
  score_b           int,
  winner_team_id    uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  reported_by_team_id  uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  confirmed_by_team_id uuid REFERENCES tournament_teams(id) ON DELETE SET NULL,
  dispute_note      text,
  proof_url         text,
  deadline          timestamptz,     -- do kiedy trzeba rozegrać (walkower po terminie)
  played_at         timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX idx_matches_group      ON tournament_matches(group_id);
CREATE INDEX idx_matches_team_a     ON tournament_matches(team_a_id);
CREATE INDEX idx_matches_team_b     ON tournament_matches(team_b_id);

-- domknij FK slot→match (utworzony wcześniej bez referencji)
ALTER TABLE tournament_venue_slots
  ADD CONSTRAINT fk_slot_match
  FOREIGN KEY (match_id) REFERENCES tournament_matches(id) ON DELETE SET NULL;

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_read" ON tournament_matches FOR SELECT USING (true);
-- Kapitan jednej z grających drużyn umawia/zgłasza; admin zawsze.
CREATE POLICY "matches_update" ON tournament_matches FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    OR EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.captain_id = auth.uid() AND t.id IN (team_a_id, team_b_id)
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    OR EXISTS (
      SELECT 1 FROM tournament_teams t
      WHERE t.captain_id = auth.uid() AND t.id IN (team_a_id, team_b_id)
    )
  );
CREATE POLICY "matches_admin_write" ON tournament_matches FOR ALL
  USING      (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));


-- ── 7. Tabela grupowa (widok liczony z meczów) ──────────────────────────────
-- 3 pkt za zwycięstwo, 1 za remis. Walkower liczony jak rozegrany mecz.
CREATE OR REPLACE VIEW tournament_standings AS
WITH played AS (
  SELECT id, group_id, team_a_id AS team_id, score_a AS gf, score_b AS ga
  FROM tournament_matches
  WHERE stage = 'group' AND status IN ('played','walkover')
    AND group_id IS NOT NULL AND team_a_id IS NOT NULL
  UNION ALL
  SELECT id, group_id, team_b_id AS team_id, score_b AS gf, score_a AS ga
  FROM tournament_matches
  WHERE stage = 'group' AND status IN ('played','walkover')
    AND group_id IS NOT NULL AND team_b_id IS NOT NULL
)
SELECT
  t.id                                    AS team_id,
  t.tournament_id,
  t.group_id,
  t.name                                  AS team_name,
  COUNT(p.id)                             AS played,
  COUNT(*) FILTER (WHERE p.gf >  p.ga)    AS won,
  COUNT(*) FILTER (WHERE p.gf =  p.ga)    AS drawn,
  COUNT(*) FILTER (WHERE p.gf <  p.ga)    AS lost,
  COALESCE(SUM(p.gf), 0)                  AS goals_for,
  COALESCE(SUM(p.ga), 0)                  AS goals_against,
  COALESCE(SUM(p.gf), 0) - COALESCE(SUM(p.ga), 0) AS goal_diff,
  COUNT(*) FILTER (WHERE p.gf >  p.ga) * 3
    + COUNT(*) FILTER (WHERE p.gf = p.ga) AS points
FROM tournament_teams t
LEFT JOIN played p ON p.team_id = t.id
WHERE t.group_id IS NOT NULL
GROUP BY t.id, t.tournament_id, t.group_id, t.name;


-- ── 8. Parowanie meczów po wspólnym dniu dostępności ────────────────────────
-- Zwraca dni tygodnia (ISO) wspólne dla obu drużyn — frontend proponuje je
-- jako pierwsze przy umawianiu meczu.
CREATE OR REPLACE FUNCTION shared_availability_days(p_team_a uuid, p_team_b uuid)
RETURNS int[] LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT UNNEST(a.availability_days)
      INTERSECT
      SELECT UNNEST(b.availability_days)
      ORDER BY 1
    ), '{}'::int[]
  )
  FROM tournament_teams a, tournament_teams b
  WHERE a.id = p_team_a AND b.id = p_team_b
$$;


-- ── 9. Licznik wolnych miejsc (na landing) ──────────────────────────────────
CREATE OR REPLACE FUNCTION tournament_team_count(p_tournament uuid)
RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COUNT(*)::int FROM tournament_teams
  WHERE tournament_id = p_tournament AND status <> 'withdrawn'
$$;


-- ── 10. Seed: pierwsza edycja (otwórz rejestrację, edytowalne w adminie) ─────
INSERT INTO tournaments (
  slug, name, sport, city, status, max_teams, group_size, advance_per_group,
  min_squad, max_squad, tagline, prize_pool,
  registration_deadline, start_date
) VALUES (
  'community-cup-2026',
  'BOJO Community Cup',
  'piłka nożna',
  'Poznań',
  'registration',
  32, 3, 2,
  5, 10,
  'Pierwszy amatorski puchar Poznania. Zbierz ekipę, wejdź do gry.',
  'Puchar, nagrody dla podium oraz tytuły MVP i króla strzelców.',
  now() + interval '21 days',
  (now() + interval '28 days')::date
)
ON CONFLICT (slug) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- 030_tournament_privacy_and_tweaks.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================================
-- 030_tournament_privacy_and_tweaks.sql
-- ----------------------------------------------------------------------------
--  • RODO: dane kontaktowe kapitana (telefon, e-mail) NIE mogą być publicznie
--    czytane. To, że gracz podał numer do organizacji turnieju, nie znaczy, że
--    zgodził się na pokazywanie go w internecie każdemu.
--  • Minimalny skład: 7 (pełen skład). Reszta zasad — osobny temat.
-- ============================================================================

-- ── 1. Ukryj kolumny kontaktowe przed publicznym odczytem ───────────────────
-- PostgREST mapuje ruch z aplikacji na role `anon` (niezalogowani) i
-- `authenticated` (zalogowani). Odbieramy im prawo SELECT na tych dwóch
-- kolumnach — INSERT/UPDATE zostaje nietknięty, więc kapitan dalej je zapisuje.
REVOKE SELECT (captain_phone, captain_email) ON tournament_teams FROM anon;
REVOKE SELECT (captain_phone, captain_email) ON tournament_teams FROM authenticated;

-- ── 2. Kontakty widoczne tylko dla admina (kontrolowana funkcja) ─────────────
-- Admin potrzebuje numerów, by skontaktować się z drużynami. SECURITY DEFINER
-- omija RLS, ale w środku twardo sprawdzamy flagę is_admin wywołującego.
CREATE OR REPLACE FUNCTION admin_team_contacts(p_tournament uuid)
RETURNS TABLE (
  team_id       uuid,
  team_name     text,
  captain_name  text,
  captain_phone text,
  captain_email text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id, t.name, t.captain_name, t.captain_phone, t.captain_email
  FROM tournament_teams t
  WHERE t.tournament_id = p_tournament
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  ORDER BY t.created_at
$$;

-- ── 3. Minimalny skład 7 zawodników ─────────────────────────────────────────
ALTER TABLE tournaments
  ALTER COLUMN min_squad SET DEFAULT 7;

UPDATE tournaments
   SET min_squad = 7,
       max_squad = GREATEST(max_squad, 12)
 WHERE slug = 'community-cup-2026';


-- ─────────────────────────────────────────────────────────────────────────
-- 031_teams_published.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Allow organizer to manage squads privately before revealing them to participants
ALTER TABLE events ADD COLUMN IF NOT EXISTS teams_published boolean NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────
-- 032_field_venue_type.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 032_field_venue_type.sql
-- AI satellite-image analysis: full classification of every venue

ALTER TABLE fields
  -- Core classification
  ADD COLUMN IF NOT EXISTS venue_type      TEXT,        -- full_size|seven_a_side|five_a_side|orlik|futsal_hall|basketball_full|basketball_half|volleyball_outdoor|volleyball_beach|tennis_outdoor|multi_sport|other
  ADD COLUMN IF NOT EXISTS dimensions_m    TEXT,        -- "105×68", "56×26", etc. — approximate playing area
  ADD COLUMN IF NOT EXISTS pitch_count     SMALLINT,    -- number of separate pitches/courts at this location

  -- Access / ownership context
  ADD COLUMN IF NOT EXISTS access_type     TEXT,        -- public|school|private|club|unknown

  -- Verification — some OSM entries are wrongly tagged
  ADD COLUMN IF NOT EXISTS is_verified_venue BOOLEAN,  -- Claude confirms it is actually a sports venue

  -- Visible infrastructure (fills in gaps where scraper left NULLs)
  -- NOTE: lit, has_changing_rooms, has_shower, has_toilets already exist from 019
  ADD COLUMN IF NOT EXISTS has_stands      BOOLEAN,    -- bleachers / tribune visible
  ADD COLUMN IF NOT EXISTS has_fence       BOOLEAN,    -- enclosed / fenced perimeter

  -- Condition estimate
  ADD COLUMN IF NOT EXISTS condition       TEXT,        -- good|fair|poor|unknown

  -- Free-form AI notes (unusual features, uncertainty, etc.)
  ADD COLUMN IF NOT EXISTS ai_notes        TEXT,

  -- Audit
  ADD COLUMN IF NOT EXISTS ai_typed_at     TIMESTAMPTZ;

COMMENT ON COLUMN fields.venue_type      IS 'AI label: full_size | seven_a_side | five_a_side | orlik | futsal_hall | basketball_full | basketball_half | volleyball_outdoor | volleyball_beach | tennis_outdoor | multi_sport | other';
COMMENT ON COLUMN fields.dimensions_m    IS 'Approximate playing area e.g. "105×68". Estimated from satellite.';
COMMENT ON COLUMN fields.pitch_count     IS 'Number of separate pitches/courts at this location.';
COMMENT ON COLUMN fields.access_type     IS 'public (park/street) | school | private | club | unknown';
COMMENT ON COLUMN fields.is_verified_venue IS 'Claude confirms the location is actually a sports venue (filters bad OSM data).';
COMMENT ON COLUMN fields.has_stands      IS 'Bleachers or tribune structure visible from satellite.';
COMMENT ON COLUMN fields.has_fence       IS 'Enclosed/fenced perimeter visible.';
COMMENT ON COLUMN fields.condition       IS 'Visual condition: good | fair | poor | unknown';
COMMENT ON COLUMN fields.ai_notes        IS 'Free-form notes from Claude: uncertainty, unusual features, etc.';
COMMENT ON COLUMN fields.ai_typed_at     IS 'Timestamp of last Claude satellite analysis.';


-- ─────────────────────────────────────────────────────────────────────────
-- 033_contact_visibility.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 033_contact_visibility.sql
-- Phone numbers and e-mails scraped from OSM are hidden by default.
-- Admins can opt specific venues in by setting contact_visible = true.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS contact_visible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN fields.contact_visible IS
  'When false (default), phone and email are stripped from API responses.
   Set to true by an admin to make contact info visible to all users.';


-- ─────────────────────────────────────────────────────────────────────────
-- 034_participant_goalkeeper.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 034: Goalkeeper slot for casual games
-- Players can join an open match either as an outfield player or as a goalkeeper.
-- This lets organizers see at a glance whether a keeper is still needed.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS is_goalkeeper boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN event_participants.is_goalkeeper IS
  'True when the player joined specifically as a goalkeeper (bramkarz).';


-- ─────────────────────────────────────────────────────────────────────────
-- 035_allow_guest_adds.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 035: Let organizers allow participants to add guests
-- When allow_guest_adds = true on an event, any logged-in user can insert
-- a guest row (is_guest = true) into event_participants.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS allow_guest_adds boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.allow_guest_adds IS
  'When true, any authenticated user can add a guest participant to this event.';

-- Extend the existing INSERT policy to cover participant-added guests.
DROP POLICY IF EXISTS "Join or organiser adds guest" ON event_participants;
CREATE POLICY "Join or organiser adds guest"
    ON event_participants FOR INSERT
    WITH CHECK (
        -- User adding themselves
        auth.uid() = user_id
        -- Organizer adding anyone (guests included)
        OR auth.uid() = (SELECT organizer_id FROM events WHERE events.id = event_id)
        -- Any logged-in user adding a guest when the organizer has enabled it
        OR (
            is_guest = true
            AND auth.uid() IS NOT NULL
            AND (SELECT allow_guest_adds FROM events WHERE events.id = event_id) = true
        )
    );


-- ─────────────────────────────────────────────────────────────────────────
-- 036_invite_only.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 036: Invite-only events + email invite management

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS invite_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.invite_only IS
  'When true, only users with a valid invite token can join the event.';

CREATE TABLE IF NOT EXISTS event_invites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  invited_by  uuid        REFERENCES auth.users(id),
  token       text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(20), 'hex'),
  note        text,
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_invites_event_email
  ON event_invites(event_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_event_invites_token
  ON event_invites(token);

ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- Organizer can manage all invites for their events
DROP POLICY IF EXISTS "Organizer manages invites" ON event_invites;
CREATE POLICY "Organizer manages invites"
  ON event_invites FOR ALL
  USING (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id))
  WITH CHECK (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id));

-- Token lookup is public (anyone with the token can validate it)
DROP POLICY IF EXISTS "Token validation read" ON event_invites;
CREATE POLICY "Token validation read"
  ON event_invites FOR SELECT
  USING (true);


-- ─────────────────────────────────────────────────────────────────────────
-- 037_field_photo_url.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 037_field_photo_url.sql
-- Venue photo: best available image (Google Places, Wikimedia Commons, or satellite)
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS photo_url    TEXT,
  ADD COLUMN IF NOT EXISTS photo_source TEXT;  -- 'google' | 'wikimedia' | 'satellite'

COMMENT ON COLUMN fields.photo_url    IS 'Primary venue photo URL (Google Places, Wikimedia Commons, or Mapbox satellite).';
COMMENT ON COLUMN fields.photo_source IS 'Origin of photo_url: google | wikimedia | satellite';


-- ─────────────────────────────────────────────────────────────────────────
-- 038_google_place_id.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 038_google_place_id.sql
-- Google Places integration: store place_id and photo_reference for proxy display
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS google_place_id  TEXT,
  ADD COLUMN IF NOT EXISTS photo_reference  TEXT;  -- Google Places photo_reference (proxied via /api/venue-photo)

COMMENT ON COLUMN fields.google_place_id IS 'Google Places place_id — used to look up photos, reviews etc.';
COMMENT ON COLUMN fields.photo_reference IS 'Google Places photo_reference for the primary venue photo. Display via /api/venue-photo?ref=<value>.';

CREATE INDEX IF NOT EXISTS idx_fields_google_place_id ON fields (google_place_id) WHERE google_place_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────
-- 039_moderation_status.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 039_moderation_status.sql
-- Admin moderation workflow for venues

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS moderation_status TEXT DEFAULT 'pending';

COMMENT ON COLUMN fields.moderation_status IS 'Admin review state: pending | approved | hidden';

CREATE INDEX IF NOT EXISTS idx_fields_moderation_status
  ON fields (moderation_status);


-- ─────────────────────────────────────────────────────────────────────────
-- 040_admin_delete_events.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 040_admin_delete_events.sql
-- Allow admins to delete ANY event (not just events they organize).
--
-- The frontend already treats admins as organizers for management actions
-- (isOrganizer = own || isAdmin), so the delete button is shown — but the only
-- DELETE policy on `events` was `auth.uid() = organizer_id`, so an admin's
-- delete silently affected 0 rows. This adds the missing policy.
--
-- All event-related rows (participants, comments, results, reminders, …) are
-- declared ON DELETE CASCADE, so removing the event cleans them up too.

DROP POLICY IF EXISTS "Admins can delete any event" ON events;
CREATE POLICY "Admins can delete any event"
  ON events FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
