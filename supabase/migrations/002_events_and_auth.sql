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
