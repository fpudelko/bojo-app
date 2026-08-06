-- ============================================================================
-- BOJO — migracje, część 3 z 3
-- ============================================================================
-- Zawiera 26 migracji: 041_join_code.sql → 066_przejecie_wpisu_goscia.sql
-- 
-- Wklej CAŁOŚĆ do Supabase → SQL Editor → Run.
-- Uruchamiaj części PO KOLEI — późniejsze migracje zakładają wcześniejsze.
-- 
-- Plik generowany: node scripts/build-db-bundles.mjs — nie edytuj ręcznie.
-- ============================================================================


-- ─────────────────────────────────────────────────────────────────────────
-- 041_join_code.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Migration 041: Replace invite-only token system with join codes
-- Each event gets a short, shareable join code (e.g. "K7QP4B").
-- Organizer can optionally require approval before participants are confirmed.

-- 1. Helper function: generate a random 6-char code (no O/0/I/1/L to avoid confusion)
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i      INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Add columns to events
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS join_code       TEXT UNIQUE DEFAULT generate_join_code(),
  ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT false;

-- 3. Backfill existing events that have no code yet
UPDATE events SET join_code = generate_join_code() WHERE join_code IS NULL;

-- 4. Make join_code NOT NULL now that all rows have one
ALTER TABLE events ALTER COLUMN join_code SET NOT NULL;

-- Index for fast lookup by code
CREATE INDEX IF NOT EXISTS idx_events_join_code ON events (join_code);

-- 5. Drop old invite system
DROP TABLE IF EXISTS event_invites CASCADE;
ALTER TABLE events DROP COLUMN IF EXISTS invite_only;

-- 6. RLS: anyone can look up an event by join_code (needed for /d/[code] route)
-- The existing "Public events are viewable by everyone" policy already covers public events.
-- Private events need an explicit policy so the redirect route can resolve them.
CREATE POLICY "Join code lookup" ON events
  FOR SELECT USING (join_code IS NOT NULL);


-- ─────────────────────────────────────────────────────────────────────────
-- 042_publish_teams_fn.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 042: RPC helper for toggling teams_published
-- Bypasses direct PATCH issue; runs as the calling user (SECURITY INVOKER)
-- so the organizer_id check enforces ownership server-side.

CREATE OR REPLACE FUNCTION set_event_teams_published(
  p_event_id  UUID,
  p_published BOOLEAN
)
RETURNS VOID
LANGUAGE SQL
SECURITY INVOKER
AS $$
  UPDATE events
  SET    teams_published = p_published
  WHERE  id = p_event_id
    AND  organizer_id = auth.uid();
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 043_player_stats_fn.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 043: Real per-player statistics, aggregated across ALL events
-- (the old /gracz/[id] page read player_stats, which is only populated for
--  recurring-event groups, so goals/attendance showed 0 for most users).
--
-- SECURITY INVOKER + STABLE — every underlying table is already public-readable
-- under RLS, so no elevated privileges are needed.

CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  attended          INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- distinct events the user signed up for (as a real account, not a guest)
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false),
    -- events organized
    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),
    -- matches actually played: participated (non-reserve) in an event that has a result
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN match_results mr ON mr.event_id = ep.event_id
      WHERE ep.user_id = p_user_id AND ep.is_guest = false AND ep.is_reserve = false),
    -- total goals scored across all events
    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),
    -- confirmed attendances
    (SELECT count(*)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false AND ep.status = 'potwierdzony'),
    -- no-shows reported against the player
    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 044_groups.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 044: Groups — a recurring crew of players. A group has a shareable join
-- code; events can be attached to a group so members see them in one place.

-- generate_join_code() is also defined in 041; redefine here (idempotent) so
-- this migration stands alone even if 041 hasn't been applied yet.
CREATE OR REPLACE FUNCTION generate_join_code() RETURNS TEXT AS $$
DECLARE
  chars  TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i      INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- --- Tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  sport       TEXT,
  city        TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  join_code   TEXT UNIQUE NOT NULL DEFAULT generate_join_code(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS group_members (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id  UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user  ON group_members (user_id);
CREATE INDEX IF NOT EXISTS idx_groups_join_code     ON groups (join_code);

-- Attach events to a group (nullable — most events stand alone)
ALTER TABLE events ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_group ON events (group_id);

-- --- Auto-add creator as admin member --------------------------------------
CREATE OR REPLACE FUNCTION add_group_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO group_members (group_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_created ON groups;
CREATE TRIGGER on_group_created
  AFTER INSERT ON groups
  FOR EACH ROW EXECUTE FUNCTION add_group_creator_as_member();

-- --- RLS --------------------------------------------------------------------
ALTER TABLE groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Groups are publicly readable (needed for join-by-code + group pages).
-- Nothing sensitive lives here.
DROP POLICY IF EXISTS "Groups are readable" ON groups;
CREATE POLICY "Groups are readable" ON groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users create own groups" ON groups;
CREATE POLICY "Users create own groups" ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator updates group" ON groups;
CREATE POLICY "Creator updates group" ON groups FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Creator deletes group" ON groups;
CREATE POLICY "Creator deletes group" ON groups FOR DELETE
  USING (auth.uid() = created_by);

-- Members list is publicly readable (member lists are shown on the group page).
-- Policy references `groups`, never `group_members`, so there's no recursion.
DROP POLICY IF EXISTS "Members are readable" ON group_members;
CREATE POLICY "Members are readable" ON group_members FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users join groups" ON group_members;
CREATE POLICY "Users join groups" ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Leave or be removed by creator" ON group_members;
CREATE POLICY "Leave or be removed by creator" ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 045_player_stats_fix_matches_played.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 045: Fix matches_played definition
-- Old: events that have a match_result record
-- New: non-cancelled events that have started (event_date + event_time <= now())
--      where the player was a non-reserve, non-guest participant

CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  attended          INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- distinct events the user signed up for (as a real account, not a guest)
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false),

    -- events organized
    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),

    -- matches actually played: non-reserve participant, event not cancelled, event has started
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id    = p_user_id
        AND ep.is_guest   = false
        AND ep.is_reserve = false
        AND e.status      != 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    -- total goals scored across all events
    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),

    -- confirmed attendances
    (SELECT count(*)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id AND ep.is_guest = false AND ep.status = 'potwierdzony'),

    -- no-shows reported against the player
    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 046_covers.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 046: Cover images for events and groups
-- Add cover_image_url column to both tables.
-- Storage bucket 'covers' must be created as PUBLIC in the Supabase dashboard,
-- then run this migration to apply RLS policies.

ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS cover_image_url TEXT;

-- ── Storage RLS for "covers" bucket ─────────────────────────────────────────
-- Anyone can read (public bucket)
DROP POLICY IF EXISTS "Covers are publicly readable" ON storage.objects;
CREATE POLICY "Covers are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

-- Authenticated users can upload covers
DROP POLICY IF EXISTS "Authenticated users can upload covers" ON storage.objects;
CREATE POLICY "Authenticated users can upload covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'covers');

-- Authenticated users can update covers
DROP POLICY IF EXISTS "Authenticated users can update covers" ON storage.objects;
CREATE POLICY "Authenticated users can update covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'covers')
  WITH CHECK (bucket_id = 'covers');

-- Authenticated users can delete covers
DROP POLICY IF EXISTS "Authenticated users can delete covers" ON storage.objects;
CREATE POLICY "Authenticated users can delete covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'covers');


-- ─────────────────────────────────────────────────────────────────────────
-- 047_analytics.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 047: Analytics — lightweight, app-wide event stream for product analytics.
-- Unlike event_activity_log (which is scoped to a single match and readable by
-- that match's organizer), this table captures cross-app user actions —
-- logins, event/group creation and joins — so admins can measure activation
-- and retention. Append-only; readable by admins only.

CREATE TABLE IF NOT EXISTS analytics_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  event_type TEXT NOT NULL,
  path       TEXT,
  metadata   JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_created   ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_type      ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_user      ON analytics_events (user_id);
-- For "distinct active users per day" style queries
CREATE INDEX IF NOT EXISTS idx_analytics_user_day  ON analytics_events (user_id, created_at);

-- --- RLS --------------------------------------------------------------------
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Any authenticated user may append their own events. The app sets user_id to
-- the acting user; we don't allow spoofing another user's id.
DROP POLICY IF EXISTS "Users append own analytics" ON analytics_events;
CREATE POLICY "Users append own analytics" ON analytics_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Only admins can read the stream.
DROP POLICY IF EXISTS "Admins read analytics" ON analytics_events;
CREATE POLICY "Admins read analytics" ON analytics_events FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));


-- ─────────────────────────────────────────────────────────────────────────
-- 048_participant_pending_approval.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 048: Join approval — when an event has require_approval = true (added in 041),
-- new participants land in a "pending" state until the organizer approves them.
-- Pending participants don't count toward capacity and aren't shown in the
-- roster. Approving flips the flag; rejecting deletes the row.
--
-- Organizer approve (UPDATE) and reject (DELETE) are already covered by the
-- existing participant RLS policies (011), so no policy changes are needed.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS pending_approval BOOLEAN NOT NULL DEFAULT false;

-- Fast lookup of an event's pending requests.
CREATE INDEX IF NOT EXISTS idx_participants_pending
  ON event_participants (event_id)
  WHERE pending_approval = true;


-- ─────────────────────────────────────────────────────────────────────────
-- 049_participant_rsvp.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 049: RSVP status for participants
-- 'yes' = confirmed (default, existing behaviour)
-- 'maybe' = interested but not committed; shows in moje-gry, doesn't take a spot

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS rsvp TEXT NOT NULL DEFAULT 'yes'
  CHECK (rsvp IN ('yes', 'maybe'));

-- "maybe" participants are not counted toward capacity
-- (capacity check in joinEvent already uses is_reserve; maybe also skips the spot)
CREATE INDEX IF NOT EXISTS idx_participants_rsvp
  ON event_participants (event_id, rsvp)
  WHERE rsvp = 'maybe';


-- ─────────────────────────────────────────────────────────────────────────
-- 050_max_goalkeepers.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 050: Goalkeeper cap per event (football). Once this many goalkeepers are in
-- the regular roster, additional goalkeepers overflow to the reserve list.
-- Default 2 (one per team).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_goalkeepers SMALLINT NOT NULL DEFAULT 2;


-- ─────────────────────────────────────────────────────────────────────────
-- 051_group_field.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 051: Optional venue (boisko) attached to a group. field_id links to the
-- fields directory; field_name is denormalized for display so listing a group
-- doesn't require a join.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_name TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 052_goalkeepers_enabled.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 052: Optional goalkeeper distinction per event. When false, there is no
-- goalkeeper/field-player split at all (no goalkeeper option on join, no BR
-- badge). When true, players may join as goalkeeper and the max_goalkeepers
-- cap (default 2) applies — extras overflow to the reserve list.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS goalkeepers_enabled BOOLEAN NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────
-- 053_own_participation_update.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 053: Let a signed-in user update their OWN participation row.
--
-- Until now the only UPDATE policies on event_participants were for the
-- organizer (004, 011). That silently blocked a participant from changing
-- their own row — RLS turns the UPDATE into a 0-row no-op with no error, so
-- confirming an RSVP ("Może" → "Dołącz") appeared to do nothing at all.
--
-- Scope: only rows the user owns (user_id = auth.uid()). Guest rows have a
-- NULL user_id and stay organizer-only. This matches the trust model already
-- used on INSERT, where joinEvent computes is_reserve client-side.

DROP POLICY IF EXISTS "Own participation update" ON event_participants;
CREATE POLICY "Own participation update"
  ON event_participants FOR UPDATE
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 054_drop_external_count.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 054: Drop external_count.
--
-- "Ilu graczy macie już spoza aplikacji" was removed from the UI — it isn't a
-- case we want to support up front (whoever has an outside crew adds them to
-- the roster after creating the match). Keeping a dead column around would
-- only muddy future capacity logic, and no live events depend on it yet.
--
-- Deploy the app code before running this: the app must stop selecting the
-- column first.

ALTER TABLE events DROP COLUMN IF EXISTS external_count;


-- ─────────────────────────────────────────────────────────────────────────
-- 055_stats_exclude_observing.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 055: Keep "observing" RSVPs (rsvp = 'maybe') out of player stats.
--
-- Observing means "I'm watching this match", not "I took part" — it reserves no
-- spot. Counting it inflated events_joined (and could inflate attended), which
-- made the profile look like the player had games they never signed up for.
--
-- matches_played already excluded them implicitly (observers are stored with
-- is_reserve = true), but the condition is now explicit so the intent survives
-- any future change to how observing rows are stored.

CREATE OR REPLACE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  attended          INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- distinct events the user actually signed up for (observing doesn't count)
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id
        AND ep.is_guest = false
        AND ep.rsvp <> 'maybe'),

    -- events organized
    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),

    -- matches actually played: non-reserve participant, event not cancelled, event has started
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id    = p_user_id
        AND ep.is_guest   = false
        AND ep.is_reserve = false
        AND ep.rsvp      <> 'maybe'
        AND e.status      != 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    -- total goals scored across all events
    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),

    -- confirmed attendances
    (SELECT count(*)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id
        AND ep.is_guest = false
        AND ep.rsvp <> 'maybe'
        AND ep.status = 'potwierdzony'),

    -- no-shows reported against the player
    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 056_payment_options.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 056: Payment method + sports-card discount options.
--
-- Event level (organizer sets at creation):
--   accepted_payment_methods — which ways participants may pay (blik/gotowka/inne)
--   blik_phone               — phone number for BLIK transfers, shown when 'blik' accepted
--   accepted_sports_cards    — which sports-benefit cards are honoured (multisport/
--                               fitprofit/medicover/inne)
--   sports_card_discount_grosz — flat discount (grosze) applied when a participant
--                               has any of the accepted cards. One shared amount,
--                               not per-provider — keeps the model and the UI simple.
--                               NULLABLE: real-world discounts vary too much to
--                               force a number (percentage-based, daily-visit
--                               limits, etc). NULL = "there is a discount, ask
--                               the organizer for details"; a value = exact grosze.
--
-- Participant level (player picks when joining a paid match):
--   payment_method     — which of the event's accepted methods they'll use
--   has_sports_card     — whether they hold one of the accepted cards
--   sports_card_provider — which one, when the event accepts more than one

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS accepted_payment_methods TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blik_phone TEXT,
  ADD COLUMN IF NOT EXISTS accepted_sports_cards TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sports_card_discount_grosz INT CHECK (sports_card_discount_grosz IS NULL OR sports_card_discount_grosz >= 0);

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS has_sports_card BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sports_card_provider TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 057_sports_card_other_name.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 057: Custom name for the "inne" (other) sports card option.
--
-- When the organizer accepts a card that isn't Multisport/FitProfit/Medicover,
-- "Inna karta" alone doesn't tell participants which one. This lets the
-- organizer name it once (e.g. "OK System") and have that name shown wherever
-- the generic "Inna karta" label would otherwise appear.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sports_card_other_name TEXT;


-- ─────────────────────────────────────────────────────────────────────────
-- 058_reserve_claim.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 058: Oferta zwolnionego miejsca dla listy rezerwowej.
--
-- Dotąd po wypisaniu się gracza miejsce wracało do wspólnej puli i brał je
-- pierwszy, kto kliknął „Dołącz" — również ktoś z zewnątrz, z pominięciem
-- rezerwy. Teraz miejsce jest najpierw OFEROWANE pierwszej osobie z rezerwy,
-- która ma ograniczony czas na decyzję („Wchodzę" / „Odpuszczam"). Po upływie
-- okna oferta przechodzi do kolejnej osoby.
--
-- Świadomie NIE ma auto-awansu: rezerwowy musi kliknąć. Nikt nie wskakuje do
-- składu po cichu — patrz docs/domena.md.
--
-- Osoba, która przepuściła ofertę (odrzuciła lub nie zdążyła), NIE jest
-- usuwana z wydarzenia — dostaje `claim_passed = true`, zostaje na liście
-- (organizator wciąż może ją awansować ręcznie), ale nie blokuje kolejki.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reserve_claim_hours SMALLINT NOT NULL DEFAULT 3
    CHECK (reserve_claim_hours BETWEEN 1 AND 72);

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS claim_offered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_passed     BOOLEAN NOT NULL DEFAULT false;

-- Szybkie znalezienie aktywnej oferty dla wydarzenia.
CREATE INDEX IF NOT EXISTS idx_participants_claim
  ON event_participants (event_id)
  WHERE claim_offered_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- sync_reserve_claim — utrzymuje kolejkę ofert w spójnym stanie.
--
-- SECURITY DEFINER, bo musi zmieniać cudze wiersze (przekazać ofertę dalej),
-- a polityki RLS pozwalają uczestnikowi ruszać tylko własny. Nie ma backendu
-- ani crona — funkcję woła klient przy wejściu na stronę meczu, więc musi być
-- idempotentna i bezpieczna przy równoległych wywołaniach.
--
-- Kolejność działań:
--   1. wygasłą ofertę oznacz jako przepuszczoną,
--   2. jeśli jest wolne miejsce i nikt nie ma aktywnej oferty — zaproponuj je
--      pierwszej osobie z rezerwy, która jeszcze nie przepuściła.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max          INT;
  v_hours        SMALLINT;
  v_started      BOOLEAN;
  v_taken        INT;
  v_active_offer INT;
  v_next_id      UUID;
BEGIN
  SELECT max_players,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled'
    INTO v_max, v_hours, v_started
    FROM events
   WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN
    RETURN; -- brak wydarzenia albo już się zaczęło/odwołane — nie ruszamy kolejki
  END IF;

  -- 1. Wygasłe oferty: przepuszczone, miejsce wraca do puli.
  UPDATE event_participants
     SET claim_passed = true,
         claim_offered_at = NULL
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- 2. Ile miejsc realnie zajętych (ta sama definicja co w joinEvent).
  SELECT count(*) INTO v_taken
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = false
     AND pending_approval = false
     AND rsvp <> 'maybe';

  SELECT count(*) INTO v_active_offer
    FROM event_participants
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL;

  -- Miejsce pod aktywną ofertą jest zarezerwowane — nie oferujemy go drugi raz.
  IF v_taken + v_active_offer >= v_max THEN
    RETURN;
  END IF;

  -- 3. Zaproponuj miejsce pierwszej osobie w kolejce.
  SELECT id INTO v_next_id
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = true
     AND claim_passed = false
     AND claim_offered_at IS NULL
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND user_id IS NOT NULL   -- gość bez konta nie kliknie „Wchodzę"
   ORDER BY created_at
   LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE event_participants
       SET claim_offered_at = now()
     WHERE id = v_next_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 059_team_proposals.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 059: Propozycje składów od uczestników.
--
-- Dotąd składy ustalał wyłącznie organizator. Teraz każdy uczestnik może
-- zaproponować własny podział, reszta go popiera (👍), a organizator jednym
-- kliknięciem przenosi wybraną propozycję na realne drużyny.
--
-- Rozdział ról jest tu istotny: propozycja NIE zmienia niczego w składzie.
-- Dopóki organizator jej nie zatwierdzi, `event_participants.team` pozostaje
-- nietknięte — propozycja to osobny byt, nie „szkic" prawdziwych drużyn.

CREATE TABLE IF NOT EXISTS team_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 'accepted' ustawia organizator przy zatwierdzeniu; historia zostaje.
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted'))
);

-- Jedna aktywna propozycja na osobę i mecz — inaczej ktoś zasypie listę.
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_one_per_author
  ON team_proposals (event_id, proposed_by);

CREATE INDEX IF NOT EXISTS idx_proposals_event ON team_proposals (event_id);

-- Przypisania w ramach propozycji. Osobno od event_participants.team.
CREATE TABLE IF NOT EXISTS team_proposal_picks (
  proposal_id    UUID NOT NULL REFERENCES team_proposals(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  team           TEXT NOT NULL CHECK (team IN ('A', 'B')),
  PRIMARY KEY (proposal_id, participant_id)
);

-- Poparcia. Jeden głos na osobę.
CREATE TABLE IF NOT EXISTS team_proposal_votes (
  proposal_id UUID NOT NULL REFERENCES team_proposals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

ALTER TABLE team_proposals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_proposal_picks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_proposal_votes  ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS. Czytać może każdy, kto widzi mecz (spójnie z resztą — mecze prywatne
-- chroni nieodgadywalny link, nie polityka). Pisać — tylko uczestnicy.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Proposals readable" ON team_proposals;
CREATE POLICY "Proposals readable" ON team_proposals FOR SELECT USING (true);

-- Zaproponować może tylko ktoś, kto realnie gra w tym meczu.
DROP POLICY IF EXISTS "Participant proposes" ON team_proposals;
CREATE POLICY "Participant proposes" ON team_proposals FOR INSERT
  WITH CHECK (
    auth.uid() = proposed_by
    AND EXISTS (
      SELECT 1 FROM event_participants ep
       WHERE ep.event_id = team_proposals.event_id
         AND ep.user_id = auth.uid()
         AND ep.pending_approval = false
    )
  );

-- Autor może swoją propozycję usunąć; organizator — każdą (moderacja).
DROP POLICY IF EXISTS "Author or organizer deletes proposal" ON team_proposals;
CREATE POLICY "Author or organizer deletes proposal" ON team_proposals FOR DELETE
  USING (
    auth.uid() = proposed_by
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
  );

-- Zatwierdzenie (status → 'accepted') to decyzja wyłącznie organizatora.
DROP POLICY IF EXISTS "Organizer accepts proposal" ON team_proposals;
CREATE POLICY "Organizer accepts proposal" ON team_proposals FOR UPDATE
  USING     (auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id))
  WITH CHECK(auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id));

DROP POLICY IF EXISTS "Picks readable" ON team_proposal_picks;
CREATE POLICY "Picks readable" ON team_proposal_picks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Author writes picks" ON team_proposal_picks;
CREATE POLICY "Author writes picks" ON team_proposal_picks FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT proposed_by FROM team_proposals WHERE id = proposal_id)
  );

DROP POLICY IF EXISTS "Votes readable" ON team_proposal_votes;
CREATE POLICY "Votes readable" ON team_proposal_votes FOR SELECT USING (true);

-- Głosować może uczestnik meczu, w swoim imieniu.
DROP POLICY IF EXISTS "Participant votes" ON team_proposal_votes;
CREATE POLICY "Participant votes" ON team_proposal_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
        FROM team_proposals tp
        JOIN event_participants ep ON ep.event_id = tp.event_id
       WHERE tp.id = proposal_id
         AND ep.user_id = auth.uid()
         AND ep.pending_approval = false
    )
  );

DROP POLICY IF EXISTS "Own vote removable" ON team_proposal_votes;
CREATE POLICY "Own vote removable" ON team_proposal_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- accept_team_proposal — przenosi propozycję na realne drużyny.
--
-- SECURITY DEFINER, bo musi zapisać `team` na cudzych wierszach uczestników,
-- a polityki pozwalają na to tylko organizatorowi. Sprawdzenie uprawnień jest
-- w środku: kto nie jest organizatorem, dostaje wyjątek.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION accept_team_proposal(p_proposal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
BEGIN
  SELECT event_id INTO v_event_id FROM team_proposals WHERE id = p_proposal_id;
  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Propozycja nie istnieje';
  END IF;

  IF auth.uid() <> (SELECT organizer_id FROM events WHERE id = v_event_id) THEN
    RAISE EXCEPTION 'Tylko organizator może zatwierdzić składy';
  END IF;

  -- Czyścimy poprzedni podział, żeby zatwierdzona propozycja była pełnym
  -- obrazem, a nie nakładką na stare przypisania.
  UPDATE event_participants SET team = NULL WHERE event_id = v_event_id;

  UPDATE event_participants ep
     SET team = pick.team
    FROM team_proposal_picks pick
   WHERE pick.proposal_id = p_proposal_id
     AND pick.participant_id = ep.id;

  UPDATE team_proposals SET status = 'accepted' WHERE id = p_proposal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_team_proposal(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 060_event_player_invites.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 060_event_player_invites.sql
--
-- Imienne zaproszenia na mecz kierowane do użytkowników Bojo.
--
-- Powód: dotąd jedynym sposobem ściągnięcia ekipy był link zaproszenia wklejony
-- na czacie. Kto go przewinął, nie dowiadywał się o meczu. Zaproszenie ma
-- wylądować w aplikacji zapraszanego, a nie w cudzym wątku na Messengerze.
--
-- Dlaczego nowa tabela, a nie wiersz w event_participants: pojemność meczu liczy
-- się po wierszach uczestników (is_reserve = false AND pending_approval = false).
-- Zaproszony NIE zajmuje miejsca. Wrzucenie zaproszeń tam wymagałoby dopisania
-- wyjątku do trzech niezależnych miejsc liczących pojemność (joinEvent, addGuest,
-- confirmFromMaybe) i było prostą drogą do rozjazdu między nimi.
--
-- Dlaczego nie istniejąca tabela event_invites (migracja 036): tamta trzyma
-- zaproszenia po ADRESIE E-MAIL z tokenem, ma email NOT NULL i nie jest przez
-- aplikację używana (lib/invites.ts nie jest nigdzie importowany). Tu chodzi
-- o zaproszenie konta, które już istnieje — inny klucz, inny cykl życia.

CREATE TABLE IF NOT EXISTS event_player_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES events     ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  invited_by   UUID          REFERENCES auth.users ON DELETE SET NULL,
  -- Skąd wyszło zaproszenie — pozwala pokazać kontekst „z ekipy Środowa Liga".
  group_id     UUID          REFERENCES groups     ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Zaproszony odrzucił albo schował. Wiersz zostaje, żeby ponowne „zaproś
  -- grupę" nie wskrzeszało zaproszenia, które ktoś świadomie odrzucił.
  dismissed_at TIMESTAMPTZ,

  UNIQUE (event_id, user_id)
);

COMMENT ON TABLE  event_player_invites              IS 'Imienne zaproszenia na mecz. Nie zajmują miejsca w składzie.';
COMMENT ON COLUMN event_player_invites.dismissed_at IS 'Zaproszony odrzucił lub schował zaproszenie. Wiersz zostaje, żeby nie wróciło.';
COMMENT ON COLUMN event_player_invites.group_id     IS 'Grupa, z której poszło zaproszenie — tylko do wyświetlenia kontekstu.';

CREATE INDEX IF NOT EXISTS idx_event_player_invites_user
  ON event_player_invites (user_id) WHERE dismissed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_player_invites_event
  ON event_player_invites (event_id);

ALTER TABLE event_player_invites ENABLE ROW LEVEL SECURITY;

-- Widzi: zaproszony, organizator meczu, administrator.
DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;
CREATE POLICY "Invitee and organizer read invites" ON event_player_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- Zaprasza: organizator, administrator albo ktoś już zapisany na ten mecz.
-- Uczestnik i tak może dziś rozesłać link zaproszenia (JoinCodePanel), więc
-- imienne zaproszenie nie daje mu nowej możliwości, tylko wygodę.
DROP POLICY IF EXISTS "Organizer and participants invite" ON event_player_invites;
CREATE POLICY "Organizer and participants invite" ON event_player_invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
  );

-- Odrzucenie/schowanie robi wyłącznie zaproszony.
DROP POLICY IF EXISTS "Invitee dismisses own invite" ON event_player_invites;
CREATE POLICY "Invitee dismisses own invite" ON event_player_invites FOR UPDATE
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Wycofać zaproszenie może organizator, administrator albo sam zaproszony.
DROP POLICY IF EXISTS "Organizer or invitee removes invite" ON event_player_invites;
CREATE POLICY "Organizer or invitee removes invite" ON event_player_invites FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 061_fix_invite_select_policy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 061_fix_invite_select_policy.sql
--
-- Naprawa: „new row violates row-level security policy for table
-- event_player_invites" przy zapraszaniu przez UCZESTNIKA (nie organizatora).
--
-- Co się działo. `invitePlayers()` woła
--     .upsert(rows, …).select('id')
-- czyli w SQL: INSERT … RETURNING id. Postgres stosuje do wierszy zwracanych
-- przez RETURNING politykę SELECT — i gdy wiersz jej nie przejdzie, przerywa
-- całą operację błędem o naruszeniu RLS. Wygląda to na odrzucony zapis, choć
-- warunek INSERT (WITH CHECK) przeszedł bez zarzutu.
--
-- Polityka SELECT z migracji `060` przepuszczała tylko zaproszonego,
-- organizatora i administratora. Uczestnik zapraszający kolegę nie jest żadnym
-- z nich: nowy wiersz ma `user_id` = zapraszany, a nie on. Efekt — zaproszenie
-- powstawało w bazie tylko wtedy, gdy wysyłał je organizator.
--
-- Dlatego INSERT nie wymaga zmian; brakowało prawa do odczytu.
--
-- Przy okazji druga rzecz z tego samego korzenia: dialog „Zaproś z ekipy"
-- podpisuje „już zaproszony" na podstawie `getEventPlayerInvites()`. Uczestnik
-- nie widział cudzych zaproszeń, więc etykieta kłamała i dało się zaprosić
-- kogoś drugi raz. Uczestnicy meczu widzą teraz jego zaproszenia — to mniejsza
-- ekspozycja niż sam skład, który jest czytelny dla wszystkich
-- (`event_participants` ma SELECT USING (true) od migracji `002`).

DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;

CREATE POLICY "Invitee, inviter and participants read invites" ON event_player_invites FOR SELECT
  USING (
    -- zaproszony
    user_id = auth.uid()
    -- kto wysłał (bez tego INSERT … RETURNING wywala się uczestnikowi)
    OR invited_by = auth.uid()
    -- organizator meczu
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    -- uczestnik tego meczu — żeby „już zaproszony" mówiło prawdę
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 062_reserve_claim_notification.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 062: Powiadomienie o ofercie zwolnionego miejsca z rezerwy.
--
-- sync_reserve_claim (058) ustawia claim_offered_at, ale dotąd nikt się o tym
-- nie dowiadywał, dopóki rezerwowy sam nie wszedł na stronę meczu — funkcja
-- jest wołana tylko przy ładowaniu strony, nie ma crona ani pusha. Oferta
-- regularnie przepadała niezauważona, co podważa obietnicę „znajdź
-- brakujących graczy i nie odwołuj gry": rezerwowy nie dostawał sygnału.
--
-- Ta migracja dopisuje wpis do notifications (już używanej przez alerty gry,
-- 025_game_alerts.sql) w tym samym momencie, w którym oferta zostaje
-- ustawiona — bez nowego kanału dostawy, tylko istniejąca skrzynka w appce.
-- Wstawiane jest tylko w gałęzi, w której v_next_id był dotąd NULL (patrz
-- WHERE claim_offered_at IS NULL w zapytaniu niżej), więc jedna oferta =
-- jedno powiadomienie, bez duplikatów przy kolejnych wywołaniach.

CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max          INT;
  v_hours        SMALLINT;
  v_started      BOOLEAN;
  v_title        TEXT;
  v_sport        TEXT;
  v_taken        INT;
  v_active_offer INT;
  v_next_id      UUID;
  v_next_user    UUID;
BEGIN
  SELECT max_players,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport),
         sport
    INTO v_max, v_hours, v_started, v_title, v_sport
    FROM events
   WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN
    RETURN; -- brak wydarzenia albo już się zaczęło/odwołane — nie ruszamy kolejki
  END IF;

  -- 1. Wygasłe oferty: przepuszczone, miejsce wraca do puli.
  UPDATE event_participants
     SET claim_passed = true,
         claim_offered_at = NULL
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- 2. Ile miejsc realnie zajętych (ta sama definicja co w joinEvent).
  SELECT count(*) INTO v_taken
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = false
     AND pending_approval = false
     AND rsvp <> 'maybe';

  SELECT count(*) INTO v_active_offer
    FROM event_participants
   WHERE event_id = p_event_id
     AND claim_offered_at IS NOT NULL;

  -- Miejsce pod aktywną ofertą jest zarezerwowane — nie oferujemy go drugi raz.
  IF v_taken + v_active_offer >= v_max THEN
    RETURN;
  END IF;

  -- 3. Zaproponuj miejsce pierwszej osobie w kolejce.
  SELECT id, user_id INTO v_next_id, v_next_user
    FROM event_participants
   WHERE event_id = p_event_id
     AND is_reserve = true
     AND claim_passed = false
     AND claim_offered_at IS NULL
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND user_id IS NOT NULL   -- gość bez konta nie kliknie „Wchodzę"
   ORDER BY created_at
   LIMIT 1;

  IF v_next_id IS NOT NULL THEN
    UPDATE event_participants
       SET claim_offered_at = now()
     WHERE id = v_next_id;

    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (
      v_next_user,
      'reserve_claim_offered',
      'Zwolniło się miejsce!',
      'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '” (' || v_sport || ').',
      p_event_id
    );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 063_field_comments.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 063_field_comments.sql
--
-- Komentarze pod obiektem z katalogu boisk.
--
-- Po co osobna tabela zamiast doklejenia do `event_comments`. Tamte komentarze
-- należą do jednego meczu i znikają razem z nim (`ON DELETE CASCADE`).
-- Komentarz pod boiskiem żyje dłużej niż każdy pojedynczy mecz i mówi
-- o miejscu: „bramki bez siatek", „brama od strony parkingu zamknięta po 20",
-- „nawierzchnia sztuczna, nie trawa". Wspólna tabela z kolumną „na co wskazuje"
-- oznaczałaby, że każde zapytanie o komentarze meczu musi pamiętać o filtrze,
-- a polityki RLS obsłużyć oba przypadki naraz.
--
-- Kształt celowo bliźniaczy do `event_comments` z migracji `026`: ta sama
-- długość, to samo miękkie kasowanie, te same reguły dostępu. Dzięki temu
-- komponent i funkcje w `lib/` czyta się jak kopię tamtych, bo nią są.

CREATE TABLE IF NOT EXISTS field_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id   uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  user_name  text NOT NULL,
  body       text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Strona boiska pobiera komentarze po `field_id` i sortuje po dacie.
CREATE INDEX IF NOT EXISTS idx_field_comments_field
  ON field_comments (field_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE field_comments ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, także niezalogowany: strony boisk są publiczne i mają sens
-- w wynikach wyszukiwania razem z tym, co ludzie o obiekcie napisali.
DROP POLICY IF EXISTS "field_comments_select" ON field_comments;
CREATE POLICY "field_comments_select" ON field_comments FOR SELECT
  USING (deleted_at IS NULL);

-- Pisze zalogowany, wyłącznie we własnym imieniu.
DROP POLICY IF EXISTS "field_comments_insert" ON field_comments;
CREATE POLICY "field_comments_insert" ON field_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Kasuje miękko tylko autor. Administrator ma osobną ścieżkę: `is_admin`
-- w `profiles` — bez tego moderacja obraźliwego wpisu wymagałaby wejścia
-- do SQL Editora.
DROP POLICY IF EXISTS "field_comments_update" ON field_comments;
CREATE POLICY "field_comments_update" ON field_comments FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 064_usun_statusy_uczestnika.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 064_usun_statusy_uczestnika.sql
--
-- Usuwa oś „status uczestnika" (`zaproszony` / `potwierdzony` / `odrzucony` /
-- `brak_odpowiedzi`) razem ze śledzeniem obecności, które było jej jedynym
-- interfejsem.
--
-- Dlaczego. Bojo opisuje relację gracza do meczu DWOMA polami, które liczymy
-- przy każdym zapisie: `pending_approval` (czy organizator już przepuścił)
-- oraz `rsvp` (`yes` = gram, `maybe` = obserwuję). Kolumna `status` opowiadała
-- tę samą historię trzeci raz, własnym słownikiem, i nikt jej nie utrzymywał
-- w zgodzie z tamtymi dwoma: gracz mógł być `potwierdzony` i jednocześnie
-- czekać na akceptację. Organizator dostawał listę rozwijaną, która niczego
-- nie zmieniała poza samą sobą.
--
-- `events.track_attendance` włączało sekcję „Potwierdzenia" i nic poza tym,
-- więc po usunięciu statusów nie ma czego włączać.
--
-- Kolumny są kasowane, nie ukrywane. Zostawiona kolumna, której nikt nie pisze,
-- po kilku miesiącach wygląda jak dane — a jest śmieciem sprzed decyzji.

ALTER TABLE event_participants DROP COLUMN IF EXISTS status;
ALTER TABLE event_participants DROP COLUMN IF EXISTS confirmed_at;

ALTER TABLE events DROP COLUMN IF EXISTS track_attendance;


-- ─────────────────────────────────────────────────────────────────────────
-- 065_powiadomienia_akceptacja_termin.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 065_powiadomienia_akceptacja_termin.sql
--
-- Powiadomienia dla dwóch zdarzeń, o których gracz dotąd nie miał jak się
-- dowiedzieć: organizator zaakceptował jego zapis oraz mecz zmienił termin.
--
-- Dlaczego wyzwalacze, a nie kod aplikacji. Tabela `notifications` ma politykę
-- INSERT tylko dla własnych wierszy — i słusznie, bo inaczej dowolny użytkownik
-- mógłby wpisać komukolwiek cokolwiek do skrzynki. Powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję: akceptuje organizator, a wpis
-- dostaje gracz. Wyzwalacz z SECURITY DEFINER jest jedynym miejscem, w którym
-- można to zrobić bez otwierania tabeli na oścież. Przy okazji działa niezależnie
-- od tego, którędy zmiana przyszła — z aplikacji, z panelu Supabase czy ze
-- skryptu.
--
-- Kanał: skrzynka w aplikacji, ta sama co alerty o grach (`025`) i oferta
-- zwolnionego miejsca (`062`). E-mail i SMS to osobna decyzja i osobna migracja;
-- struktura wpisu jest już taka, żeby dało się z niej złożyć wiadomość.

-- ---------------------------------------------------------------------------
-- 1. Organizator zaakceptował zapis
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_akceptacji()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  -- Tylko przejście „czeka" → „przyjęty". Bez tego warunku każda inna zmiana
  -- w wierszu (drużyna, płatność, przejście na rezerwę) słałaby powiadomienie.
  IF NEW.user_id IS NULL
     OR OLD.pending_approval IS NOT TRUE
     OR NEW.pending_approval IS NOT FALSE THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(title, sport) INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    NEW.user_id,
    'zapis_zaakceptowany',
    'Jesteś w składzie',
    'Organizator przyjął Twój zapis na mecz: ' || coalesce(v_tytul, 'mecz') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_akceptacji ON event_participants;
CREATE TRIGGER trg_powiadom_o_akceptacji
  AFTER UPDATE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_akceptacji();

-- ---------------------------------------------------------------------------
-- 2. Zmiana terminu meczu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_zmianie_terminu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.event_date IS NOT DISTINCT FROM OLD.event_date
     AND NEW.event_time IS NOT DISTINCT FROM OLD.event_time THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  -- Dostają wszyscy związani z meczem, także rezerwowi i obserwujący: zmiana
  -- terminu unieważnia ich plany tak samo jak plany grających. Organizator nie,
  -- bo to on ją wprowadził.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'zmiana_terminu',
         'Zmiana terminu meczu',
         'Nowy termin: ' || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || ' — ' || coalesce(v_tytul, 'mecz') || '.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_terminu ON events;
CREATE TRIGGER trg_powiadom_o_zmianie_terminu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zmianie_terminu();


-- ─────────────────────────────────────────────────────────────────────────
-- 066_przejecie_wpisu_goscia.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 066_przejecie_wpisu_goscia.sql
--
-- Pozwala osobie dopisanej ręcznie jako gość przejąć swój wpis po założeniu
-- konta — zamiast zaczynać od zera i mieć w składzie dwie pozycje o tym samym
-- imieniu.
--
-- Problem. Organizator dopisuje „Marek" i tyle: wpis nie ma `user_id`, więc
-- nie należy do nikogo. Marek zakłada konto, dołącza — i w składzie jest teraz
-- „Marek" (gość) oraz „Marek Nowak" (konto). Organizator musi ręcznie usunąć
-- jednego, a historia gier Marka zaczyna się od pustej karty.
--
-- Dlaczego token, a nie samo dopasowanie po imieniu. Imię nie jest tożsamością:
-- na osiedlowym meczu bywa trzech Marków, a przejęcie cudzego wpisu oznacza
-- przejęcie cudzego miejsca w składzie i cudzej historii. Token jest losowy,
-- jednorazowy i wędruje kanałem, który wybrał organizator (SMS, czat) — kto go
-- ma, dostał go od osoby, która wie, kogo dopisała.
--
-- Przejęcie robi funkcja z SECURITY DEFINER, bo wpis gościa z definicji nie
-- należy jeszcze do nikogo — żadna polityka RLS oparta na `auth.uid()` nie
-- mogłaby go przepuścić.

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS claim_token uuid,
  ADD COLUMN IF NOT EXISTS claimed_at  timestamptz;

-- Token służy do wyszukania jednego wiersza — bez indeksu byłoby to skanowanie
-- całej tabeli przy każdym kliknięciu w link.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_claim_token
  ON event_participants (claim_token)
  WHERE claim_token IS NOT NULL;

-- Token powstaje sam przy dopisywaniu gościa. Gdyby zakładał go frontend,
-- losowość zależałaby od przeglądarki, a starsze wpisy zostałyby bez tokenu.
CREATE OR REPLACE FUNCTION nadaj_token_gosciowi()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_guest AND NEW.user_id IS NULL AND NEW.claim_token IS NULL THEN
    NEW.claim_token := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_nadaj_token_gosciowi ON event_participants;
CREATE TRIGGER trg_nadaj_token_gosciowi
  BEFORE INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION nadaj_token_gosciowi();

-- Tokeny dla gości dopisanych przed tą migracją.
UPDATE event_participants
   SET claim_token = gen_random_uuid()
 WHERE is_guest AND user_id IS NULL AND claim_token IS NULL;

-- ---------------------------------------------------------------------------
-- Podgląd zaproszenia — co zobaczy klikający, zanim się zaloguje
-- ---------------------------------------------------------------------------
-- Zwraca tylko to, co potrzebne do decyzji „czy to o mnie": imię z wpisu oraz
-- mecz. Nie zwraca składu ani niczego o innych uczestnikach.
CREATE OR REPLACE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie        text,
  event_id    uuid,
  tytul       text,
  data_meczu  date,
  godzina     time,
  miejsce     text,
  juz_przejety boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         e.id,
         coalesce(e.title, e.sport),
         e.event_date,
         e.event_time,
         e.field_name,
         (p.claimed_at IS NOT NULL OR p.user_id IS NOT NULL)
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- Przejęcie wpisu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION przejmij_wpis_goscia(p_token uuid, p_nazwa text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_event    uuid;
  v_zajety   boolean;
  v_duplikat boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby przejąć wpis.';
  END IF;

  SELECT id, event_id, (claimed_at IS NOT NULL OR user_id IS NOT NULL)
    INTO v_id, v_event, v_zajety
    FROM event_participants
   WHERE claim_token = p_token;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nieznany albo nieaktualny link.';
  END IF;

  -- Token jest jednorazowy. Bez tego drugi kliknięty link przepisywałby wpis
  -- na kolejną osobę, cicho odbierając go pierwszej.
  IF v_zajety THEN
    RAISE EXCEPTION 'Ten wpis został już przejęty.';
  END IF;

  -- Kto jest już w tym meczu na własnym koncie, nie może dobrać sobie drugiego
  -- miejsca przez wpis gościa.
  SELECT EXISTS (
    SELECT 1 FROM event_participants
     WHERE event_id = v_event AND user_id = auth.uid()
  ) INTO v_duplikat;

  IF v_duplikat THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz na swoim koncie.';
  END IF;

  UPDATE event_participants
     SET user_id    = auth.uid(),
         is_guest   = false,
         name       = coalesce(nullif(trim(p_nazwa), ''), name),
         claimed_at = now(),
         claim_token = NULL
   WHERE id = v_id;

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
REVOKE ALL ON FUNCTION przejmij_wpis_goscia(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION przejmij_wpis_goscia(uuid, text) TO authenticated;
