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
