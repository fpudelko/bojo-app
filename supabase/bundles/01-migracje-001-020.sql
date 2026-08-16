-- ============================================================================
-- BOJO — migracje, część 1 z 3
-- ============================================================================
-- Zawiera 20 migracji: 001_initial_schema.sql → 020_field_outreach.sql
-- 
-- Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.
-- Uruchamiaj części PO KOLEI — późniejsze migracje zakładają wcześniejsze.
-- 
-- Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Boiska Poznań — Initial Database Schema
-- Migration: 001_initial_schema.sql
-- ============================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enable PostGIS for proper geospatial queries (uncomment if available in your Supabase plan)
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- ---------------------------------------------------------------------------
-- Fields table
-- Stores sports fields scraped from Google Places, OpenStreetMap or entered manually
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fields (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255)    NOT NULL,
    address         TEXT            NOT NULL,
    lat             DECIMAL(10, 8)  NOT NULL,
    lng             DECIMAL(11, 8)  NOT NULL,
    sport           TEXT[]          NOT NULL DEFAULT '{}',
    available       BOOLEAN         DEFAULT true,
    surface         VARCHAR(50),        -- 'grass' | 'artificial' | 'concrete' | 'clay' | 'hardcourt'
    is_indoor       BOOLEAN         DEFAULT false,
    phone           VARCHAR(50),
    website         TEXT,
    source          VARCHAR(50),        -- 'google_places' | 'osm' | 'manual'
    external_id     VARCHAR(255),       -- Original ID from source system (for upsert dedup)
    created_at      TIMESTAMPTZ     DEFAULT now(),
    updated_at      TIMESTAMPTZ     DEFAULT now()
);

COMMENT ON TABLE fields IS 'Sports fields aggregated from Google Places, OpenStreetMap and manual entries.';
COMMENT ON COLUMN fields.surface IS 'Playing surface type: grass | artificial | concrete | clay | hardcourt';
COMMENT ON COLUMN fields.source IS 'Data source: google_places | osm | manual';
COMMENT ON COLUMN fields.external_id IS 'ID in the source system — used for idempotent upserts.';

-- ---------------------------------------------------------------------------
-- Games (szukam graczy) table
-- Stores player-created game announcements
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS games (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id        UUID            REFERENCES fields(id) ON DELETE CASCADE,
    sport           VARCHAR(100)    NOT NULL,
    game_date       DATE            NOT NULL,
    game_time       TIME            NOT NULL,
    players_needed  INTEGER         NOT NULL CHECK (players_needed > 0 AND players_needed <= 100),
    players_joined  INTEGER         DEFAULT 0 CHECK (players_joined >= 0),
    author_name     VARCHAR(255)    NOT NULL,
    author_email    VARCHAR(255),
    description     TEXT,
    is_active       BOOLEAN         DEFAULT true,
    created_at      TIMESTAMPTZ     DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

COMMENT ON TABLE games IS 'Game announcements — players looking for other players.';
COMMENT ON COLUMN games.expires_at IS 'Auto-computed: game_date + game_time + 2 hours.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Spatial index for proximity search (point-based; replace with PostGIS if available)
CREATE INDEX IF NOT EXISTS idx_fields_lat_lng ON fields (lat, lng);

-- GIN index for array containment queries: WHERE sport @> '{piłka nożna}'
CREATE INDEX IF NOT EXISTS idx_fields_sport ON fields USING GIN (sport);

-- Composite for common filter pattern
CREATE INDEX IF NOT EXISTS idx_fields_available ON fields (available) WHERE available = true;

-- Source + external_id index for upsert deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_fields_source_external
    ON fields (source, external_id)
    WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_games_field_id    ON games (field_id);
CREATE INDEX IF NOT EXISTS idx_games_date        ON games (game_date);
CREATE INDEX IF NOT EXISTS idx_games_active      ON games (is_active) WHERE is_active = true;

-- ---------------------------------------------------------------------------
-- Updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_fields_updated_at ON fields;
CREATE TRIGGER set_fields_updated_at
    BEFORE UPDATE ON fields
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ---------------------------------------------------------------------------
-- expires_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trigger_set_expires_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.expires_at = (NEW.game_date::TEXT || ' ' || NEW.game_time::TEXT)::TIMESTAMP
                     AT TIME ZONE 'UTC' + INTERVAL '2 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_games_expires_at ON games;
CREATE TRIGGER set_games_expires_at
    BEFORE INSERT OR UPDATE ON games
    FOR EACH ROW EXECUTE FUNCTION trigger_set_expires_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE games  ENABLE ROW LEVEL SECURITY;

-- Fields are publicly readable (no auth required)
DROP POLICY IF EXISTS "Fields are publicly readable" ON fields;
CREATE POLICY "Fields are publicly readable"
    ON fields FOR SELECT USING (true);

-- Games are publicly readable
DROP POLICY IF EXISTS "Games are publicly readable" ON games;
CREATE POLICY "Games are publicly readable"
    ON games FOR SELECT USING (true);

-- Anyone can create a game announcement (no auth required for MVP)
DROP POLICY IF EXISTS "Anyone can create games" ON games;
CREATE POLICY "Anyone can create games"
    ON games FOR INSERT WITH CHECK (true);

-- Only service role can insert/update fields (scraper uses service key)
-- Anon users cannot modify field data
DROP POLICY IF EXISTS "Service role can manage fields" ON fields;
CREATE POLICY "Service role can manage fields"
    ON fields FOR ALL USING (auth.role() = 'service_role');


-- ─────────────────────────────────────────────────────────────────────────
-- 002_events_and_auth.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- Boiska Poznań — Events & Auth
-- Migration: 002_events_and_auth.sql
-- Run AFTER 001_initial_schema.sql in the Supabase SQL Editor.
-- ============================================================

-- ---------------------------------------------------------------------------
-- events — sports events organised by a logged-in user
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organizer_name  TEXT NOT NULL,
    sport           TEXT NOT NULL,
    field_id        UUID REFERENCES fields(id) ON DELETE SET NULL,
    field_name      TEXT NOT NULL,           -- denormalised for display
    lat             DECIMAL(10, 8),
    lng             DECIMAL(11, 8),
    title           TEXT,
    description     TEXT,
    event_date      DATE NOT NULL,
    event_time      TIME NOT NULL,
    max_players     INTEGER NOT NULL CHECK (max_players > 0 AND max_players <= 100),
    visibility      TEXT NOT NULL DEFAULT 'private'
                    CHECK (visibility IN ('private', 'public')),
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_organizer  ON events (organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events (visibility) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_events_date       ON events (event_date);

-- ---------------------------------------------------------------------------
-- event_participants — one row per person going (registered users + guests)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_participants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,  -- NULL for guests
    name        TEXT NOT NULL,
    is_guest    BOOLEAN NOT NULL DEFAULT false,   -- added by organiser, no account
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- a logged-in user can join a given event only once
CREATE UNIQUE INDEX IF NOT EXISTS idx_participant_unique_user
    ON event_participants (event_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_event ON event_participants (event_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
ALTER TABLE events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;

-- Events: readable by anyone (private = unlisted, shared via link by UUID).
DROP POLICY IF EXISTS "Events readable by all" ON events;
CREATE POLICY "Events readable by all"
    ON events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create own events" ON events;
CREATE POLICY "Users create own events"
    ON events FOR INSERT WITH CHECK (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizer updates own events" ON events;
CREATE POLICY "Organizer updates own events"
    ON events FOR UPDATE USING (auth.uid() = organizer_id);

DROP POLICY IF EXISTS "Organizer deletes own events" ON events;
CREATE POLICY "Organizer deletes own events"
    ON events FOR DELETE USING (auth.uid() = organizer_id);

-- Participants: readable by anyone who can see the event.
DROP POLICY IF EXISTS "Participants readable by all" ON event_participants;
CREATE POLICY "Participants readable by all"
    ON event_participants FOR SELECT USING (true);

-- Insert: either you add yourself (user_id = you), or you are the event organiser
-- adding a guest.
DROP POLICY IF EXISTS "Join or organiser adds guest" ON event_participants;
CREATE POLICY "Join or organiser adds guest"
    ON event_participants FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    );

-- Delete: you can remove yourself, or the organiser can remove anyone.
DROP POLICY IF EXISTS "Leave or organiser removes" ON event_participants;
CREATE POLICY "Leave or organiser removes"
    ON event_participants FOR DELETE
    USING (
        auth.uid() = user_id
        OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    );

-- ---------------------------------------------------------------------------
-- Seed: real Poznań sports venues (idempotent)
-- ---------------------------------------------------------------------------
INSERT INTO fields (id, name, address, lat, lng, sport, available, surface, is_indoor, website, source)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Orlik Rataje', 'os. Piastowskie 65, 61-156 Poznań', 52.3942, 16.9580, ARRAY['piłka nożna','futsal'], true, 'artificial', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000002', 'Boisko Orlik Jeżyce', 'ul. Kościelna 74, 60-538 Poznań', 52.4205, 16.9020, ARRAY['piłka nożna','koszykówka'], true, 'artificial', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000003', 'Hala Sportowa AWF Poznań', 'ul. Królowej Jadwigi 27/39, 61-871 Poznań', 52.3990, 16.9290, ARRAY['siatkówka','koszykówka','futsal'], true, 'hardcourt', true, 'https://awf.poznan.pl', 'manual'),
    ('c0000000-0000-0000-0000-000000000004', 'Boisko Park Sołacki', 'ul. Niegolewskich, 60-365 Poznań', 52.4310, 16.9000, ARRAY['piłka nożna','siatkówka'], true, 'grass', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000005', 'Korty Tenisowe AKT Poznań', 'ul. Druskienicka 12, 60-476 Poznań', 52.4450, 16.8920, ARRAY['tenis'], true, 'clay', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000006', 'Orlik Wilda', 'ul. Rolna 30, 61-487 Poznań', 52.3850, 16.9180, ARRAY['piłka nożna','futsal'], true, 'artificial', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000007', 'Termy Maltańskie — Boiska', 'ul. Termalna 1, 61-028 Poznań', 52.4030, 16.9870, ARRAY['siatkówka','piłka nożna'], true, 'artificial', false, 'https://termymaltanskie.com.pl', 'manual'),
    ('c0000000-0000-0000-0000-000000000008', 'Boisko Grunwald', 'ul. Grunwaldzka 22, 60-782 Poznań', 52.4010, 16.9000, ARRAY['koszykówka','piłka nożna'], true, 'concrete', false, NULL, 'manual'),
    ('c0000000-0000-0000-0000-000000000009', 'Hala Sportowa Politechniki Poznańskiej', 'ul. Piotrowo 4, 61-138 Poznań', 52.4070, 16.9530, ARRAY['siatkówka','koszykówka','futsal'], true, 'hardcourt', true, 'https://put.poznan.pl', 'manual'),
    ('c0000000-0000-0000-0000-000000000010', 'Boisko Os. Winogrady', 'os. Przyjaźni, 61-685 Poznań', 52.4360, 16.9430, ARRAY['piłka nożna','koszykówka'], true, 'artificial', false, NULL, 'manual')
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────────
-- 003_end_time.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add optional end time to events (e.g. "gramy 18:00 – 20:00")
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;


-- ─────────────────────────────────────────────────────────────────────────
-- 004_participants_extra.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Rozszerzenie tabeli event_participants o płatności i rezerwę.
-- Uruchom w Supabase SQL Editor.

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS has_paid  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT false;

-- Organizator może zmieniać has_paid i is_reserve uczestników swojego wydarzenia.
DROP POLICY IF EXISTS "Organizer updates participants" ON event_participants;
CREATE POLICY "Organizer updates participants"
    ON event_participants FOR UPDATE
    USING  (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id))
    WITH CHECK (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id));


-- ─────────────────────────────────────────────────────────────────────────
-- 005_profiles.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Profiles: avatar + admin flag
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  is_admin   BOOLEAN  NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON profiles;
CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Admins can update any event (in addition to existing organizer policy)
DROP POLICY IF EXISTS "Admins can update any event" ON events;
CREATE POLICY "Admins can update any event"
  ON events FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Fields: enable RLS with public read + admin write
ALTER TABLE fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Fields are publicly readable" ON fields;
CREATE POLICY "Fields are publicly readable"
  ON fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update fields" ON fields;
CREATE POLICY "Admins can update fields"
  ON fields FOR UPDATE
  USING  (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ─────────────────────────────────────────────────────────────────────────
-- 006_avatar_storage.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Storage RLS policies for the "avatars" bucket
-- Run AFTER creating the public "avatars" bucket in Supabase Storage.

-- Anyone can read avatars (bucket is public)
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- A user may upload only into their own folder: avatars/<uid>/...
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- A user may overwrite their own avatar (upsert)
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- A user may delete their own avatar
DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Make sure the profiles UPDATE policy also has a WITH CHECK so upsert works.
-- (Insert + update both needed for upsert into profiles.)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────
-- 007_recurring_events.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- 008_venue_bookings.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- 009_booking_type.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add booking_type and booking_url to fields
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS booking_type TEXT NOT NULL DEFAULT 'none'
    CHECK (booking_type IN ('internal', 'external', 'none')),
  ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Migrate existing is_bookable=true → booking_type='internal'
UPDATE fields SET booking_type = 'internal' WHERE is_bookable = true AND booking_type = 'none';

-- Extend bookings with sport, players_count, phone
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS sport TEXT,
  ADD COLUMN IF NOT EXISTS players_count SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- Managers can also update booking_type / booking_url (already covered by existing manager update policy)
-- Admin can update all fields (already covered by existing admin update policy)


-- ─────────────────────────────────────────────────────────────────────────
-- 010_booking_enabled.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Add booking_enabled flag so a single field can enable reservations
-- even when the global FEATURE_RESERVATIONS env flag is off.
ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS booking_enabled BOOLEAN NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────
-- 011_advanced_event_features.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- 012_custom_event_location.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- 012: Custom event location fields
-- Events can have a location outside the fields DB (e.g. private pitch,
-- street court). These fields are nullable and only used when the event
-- is NOT pinned to a field from the map.
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS custom_location_name TEXT,
  ADD COLUMN IF NOT EXISTS custom_address        TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 013_event_reminders.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- 014_match_results_extended.sql
-- ─────────────────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────────────────
-- 015_event_status_and_added_by.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- 015: Event status (active/cancelled) + guest added_by tracking
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'cancelled'));

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES auth.users;


-- ─────────────────────────────────────────────────────────────────────────
-- 016_delete_account_rate_limits.sql
-- ─────────────────────────────────────────────────────────────────────────
-- ============================================================
-- 016: Account deletion RPC, rate limiting, profile phone field
-- ============================================================

-- Phone number + consent on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS phone_consent     BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users ON DELETE CASCADE,
  action     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient window lookup
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits (user_id, action, created_at);

-- Auto-clean old records (keeps table small)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON rate_limits (created_at);

-- Users must not read or manipulate rate_limits directly
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = deny all direct access; functions use SECURITY DEFINER to bypass.

-- Check and record a rate limit action.
-- Returns TRUE if allowed, FALSE if limit exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action       TEXT,
  p_max_per_hour INT DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid   UUID := auth.uid();
  cnt   INT;
BEGIN
  IF uid IS NULL THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO cnt
  FROM rate_limits
  WHERE user_id   = uid
    AND action     = p_action
    AND created_at > NOW() - INTERVAL '1 hour';

  IF cnt >= p_max_per_hour THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (uid, p_action);
  RETURN TRUE;
END;
$$;

-- Periodically prune records older than 24h (call from a cron job / Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- ---------------------------------------------------------------------------
-- Account deletion (GDPR right to be forgotten)
-- Anonymises participant records, deletes profile, then deletes auth user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Anonymise personal data in event_participants (keep event history, lose identity)
  UPDATE public.event_participants
  SET user_id   = NULL,
      name      = 'Usunięty użytkownik',
      phone     = NULL,
      added_by  = NULL
  WHERE user_id = uid;

  -- Anonymise organizer name in events (keep events visible)
  UPDATE public.events
  SET organizer_name = 'Usunięty użytkownik'
  WHERE organizer_id = uid;

  -- Remove recurring event organizer entries
  UPDATE public.recurring_events
  SET organizer_name = 'Usunięty użytkownik'
  WHERE organizer_id = uid;

  -- Delete profile (avatar stays in storage — purge separately if needed)
  DELETE FROM public.profiles WHERE id = uid;

  -- Delete auth user — Supabase cascades to auth-linked data
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 017_fields_enrichment.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 017_fields_enrichment.sql
-- Add enrichment columns to fields: operator info, contact email,
-- description, photo URL, opening hours.
-- Populated by the scraper from OSM tags.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS operator        TEXT,
  ADD COLUMN IF NOT EXISTS operator_type   TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS description     TEXT,
  ADD COLUMN IF NOT EXISTS image_url       TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours   TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 018_fields_source_external_unique_constraint.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 018_fields_source_external_unique_constraint.sql
-- PostgREST ON CONFLICT upsert requires a formal UNIQUE CONSTRAINT,
-- not just a UNIQUE INDEX. Convert the existing index to a constraint.

ALTER TABLE fields
  DROP CONSTRAINT IF EXISTS fields_source_external_key;

DROP INDEX IF EXISTS idx_fields_source_external;

ALTER TABLE fields
  ADD CONSTRAINT fields_source_external_key UNIQUE (source, external_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 019_fields_facilities.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 019_fields_facilities.sql
-- Add venue facility columns populated by the OSM scraper.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS postcode           VARCHAR(10),
  ADD COLUMN IF NOT EXISTS lit                BOOLEAN,
  ADD COLUMN IF NOT EXISTS access             TEXT,
  ADD COLUMN IF NOT EXISTS fee                BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_changing_rooms BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_shower         BOOLEAN,
  ADD COLUMN IF NOT EXISTS has_toilets        BOOLEAN,
  ADD COLUMN IF NOT EXISTS capacity           SMALLINT;


-- ─────────────────────────────────────────────────────────────────────────
-- 020_field_outreach.sql
-- ─────────────────────────────────────────────────────────────────────────
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
