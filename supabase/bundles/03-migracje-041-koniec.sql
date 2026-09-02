-- ============================================================================
-- BOJO — migracje, część 3 z 3
-- ============================================================================
-- Zawiera 86 migracji: 041_join_code.sql → 128_gosc_zarzadza_swoim_zapisem.sql
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


-- ─────────────────────────────────────────────────────────────────────────
-- 067_powiadomienie_o_zaproszeniu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 067_powiadomienie_o_zaproszeniu.sql
--
-- Imienne zaproszenie na mecz nie tworzyło powiadomienia. Zaproszony widział je
-- wyłącznie wchodząc na stronę główną Bojo — czyli dokładnie wtedy, gdy i tak
-- by je zobaczył. Dzwonek pokazywał zero, mimo trzech czekających zaproszeń.
--
-- Powiadomienia (`025`) powstały wcześniej niż zaproszenia (`060`) i nikt ich
-- wtedy nie połączył. Ta migracja to naprawia oraz uzupełnia wpisy dla zaproszeń,
-- które już czekają w bazie — inaczej naprawa działałaby dopiero od następnego
-- zaproszenia, a te dzisiejsze zostałyby niewidoczne na zawsze.

CREATE OR REPLACE FUNCTION powiadom_o_zaproszeniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul     TEXT;
  v_data      DATE;
  v_godzina   TIME;
  v_kto       TEXT;
BEGIN
  SELECT coalesce(e.title, e.sport), e.event_date, e.event_time
    INTO v_tytul, v_data, v_godzina
    FROM events e
   WHERE e.id = NEW.event_id;

  SELECT p.display_name INTO v_kto FROM profiles p WHERE p.id = NEW.invited_by;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    NEW.user_id,
    'zaproszenie_na_mecz',
    coalesce(v_kto || ' zaprasza Cię na mecz', 'Zaproszenie na mecz'),
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM')
      || ', godz. ' || to_char(v_godzina, 'HH24:MI') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zaproszeniu ON event_player_invites;
CREATE TRIGGER trg_powiadom_o_zaproszeniu
  AFTER INSERT ON event_player_invites
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zaproszeniu();

-- ---------------------------------------------------------------------------
-- Uzupełnienie zaległych zaproszeń
-- ---------------------------------------------------------------------------
-- Tylko te, które wciąż na coś czekają: nieodrzucone i dotyczące meczu, który
-- się jeszcze nie odbył. Powiadomienie o zaproszeniu na mecz sprzed tygodnia
-- byłoby hałasem, nie informacją.
--
-- `NOT EXISTS` chroni przed powtórką, gdyby migracja poszła drugi raz.
INSERT INTO notifications (user_id, type, title, body, event_id, created_at)
SELECT i.user_id,
       'zaproszenie_na_mecz',
       coalesce(p.display_name || ' zaprasza Cię na mecz', 'Zaproszenie na mecz'),
       coalesce(e.title, e.sport) || ' — ' || to_char(e.event_date, 'DD.MM')
         || ', godz. ' || to_char(e.event_time, 'HH24:MI') || '.',
       i.event_id,
       i.created_at
  FROM event_player_invites i
  JOIN events e ON e.id = i.event_id
  LEFT JOIN profiles p ON p.id = i.invited_by
 WHERE i.dismissed_at IS NULL
   AND e.status = 'active'
   AND (e.event_date + e.event_time)::timestamp > now()
   AND NOT EXISTS (
     SELECT 1 FROM notifications n
      WHERE n.user_id = i.user_id
        AND n.event_id = i.event_id
        AND n.type = 'zaproszenie_na_mecz'
   );


-- ─────────────────────────────────────────────────────────────────────────
-- 068_osm_tagi_i_otoczenie.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 068_osm_tagi_i_otoczenie.sql
--
-- Surowe tagi OpenStreetMap, metadane wpisu i otoczenie obiektu.
--
-- Dlaczego jedna kolumna JSON zamiast dwudziestu kolumn. Importer czytał
-- kilkanaście tagów i resztę wyrzucał. Każde późniejsze „dorzućmy jeszcze X"
-- oznaczało nową kolumnę, nową migrację i PONOWNY IMPORT CAŁEGO KRAJU: pobranie
-- kilkunastu plików po 100–200 MB i godziny przetwarzania, żeby odzyskać dane,
-- które już raz mieliśmy w pamięci. `osm_tags` zapisuje komplet raz; decyzję,
-- co z tego pokazać, podejmujemy potem zwykłym SQL-em.
--
-- Kolumny osobne dostają tylko te rzeczy, po których chcemy FILTROWAĆ na mapie
-- — filtr po polu JSON nie skorzysta z indeksu tak dobrze jak kolumna, a lista
-- boisk ma być szybka przy dziesiątkach tysięcy wierszy.

ALTER TABLE fields
  -- Komplet tagów obiektu z OSM, bez interpretacji. Źródło prawdy dla wszystkiego,
  -- czego jeszcze nie wyciągnęliśmy do osobnej kolumny.
  ADD COLUMN IF NOT EXISTS osm_tags        JSONB,
  -- Kiedy ktokolwiek edytował ten obiekt w OSM. UWAGA przy interpretacji: brak
  -- edycji nie znaczy „nieaktualne". Boisko zmapowane w 2014 i od tego czasu
  -- nietknięte najczęściej dalej tam jest — po prostu nikt nie miał czego
  -- poprawiać. Ta data mówi o AKTYWNOŚCI MAPERÓW, nie o stanie boiska.
  ADD COLUMN IF NOT EXISTS osm_updated_at  TIMESTAMPTZ,
  -- Ile razy obiekt był edytowany. Wysoka liczba = ktoś go pilnuje.
  ADD COLUMN IF NOT EXISTS osm_version     INT,
  -- `check_date` / `survey:date` — jedyny tag, który znaczy „ktoś to sprawdził
  -- w terenie tego dnia". Rzadki, ale gdy jest, wart więcej niż cała reszta.
  ADD COLUMN IF NOT EXISTS osm_checked_at  DATE,

  -- --- cechy, po których filtrujemy ---
  ADD COLUMN IF NOT EXISTS is_covered      BOOLEAN,   -- zadaszone (covered/indoor)
  ADD COLUMN IF NOT EXISTS reservation     TEXT,      -- required | recommended | no
  ADD COLUMN IF NOT EXISTS operator_kind   TEXT,      -- public | private | government | community…
  ADD COLUMN IF NOT EXISTS hoops           INT,       -- liczba koszy
  ADD COLUMN IF NOT EXISTS seasonal        TEXT,      -- np. winter — lodowiska, plażówki
  ADD COLUMN IF NOT EXISTS surveillance    BOOLEAN,   -- monitoring
  ADD COLUMN IF NOT EXISTS wheelchair      TEXT,      -- yes | limited | no

  -- --- otoczenie: liczone złączeniem przestrzennym przy imporcie ---
  -- Odpowiada na pytania, których gracz nie zada wprost, a które decydują
  -- o wyborze boiska: gdzie zaparkuję, jak dojadę bez auta.
  ADD COLUMN IF NOT EXISTS parking_m       INT,       -- odległość do parkingu w metrach
  ADD COLUMN IF NOT EXISTS transit_m       INT,       -- odległość do przystanku
  ADD COLUMN IF NOT EXISTS toilets_m       INT,       -- odległość do toalety publicznej

  -- Ile boisk leży w tym samym obiekcie nadrzędnym (szkoła, ośrodek). Pozwala
  -- powiedzieć „kompleks 3 boisk" zamiast pokazywać trzy osobne pinezki bez
  -- związku.
  ADD COLUMN IF NOT EXISTS siblings        INT,

  -- Alternatywne nazwy z OSM. Ludzie szukają „Orlik na Górczynie", a nie nazwy
  -- z tabliczki przy wejściu.
  ADD COLUMN IF NOT EXISTS alt_names       TEXT[];

COMMENT ON COLUMN fields.osm_tags       IS 'Surowe tagi OSM. Źródło prawdy dla pól jeszcze nie wyciągniętych do kolumn.';
COMMENT ON COLUMN fields.osm_updated_at IS 'Ostatnia edycja w OSM. Mówi o aktywności maperów, NIE o aktualności boiska.';
COMMENT ON COLUMN fields.osm_checked_at IS 'check_date/survey:date — ktoś zweryfikował obiekt w terenie tego dnia.';
COMMENT ON COLUMN fields.siblings       IS 'Ile boisk w tym samym obiekcie nadrzędnym (kompleks).';

-- Indeksy tylko tam, gdzie filtruje mapa. Częściowe, bo większość obiektów
-- będzie miała NULL i nie ma sensu ich indeksować.
CREATE INDEX IF NOT EXISTS idx_fields_covered   ON fields (is_covered)   WHERE is_covered = true;
CREATE INDEX IF NOT EXISTS idx_fields_operator  ON fields (operator_kind) WHERE operator_kind IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_osm_dates ON fields (osm_updated_at) WHERE osm_updated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_osm_tags  ON fields USING GIN (osm_tags);


-- ─────────────────────────────────────────────────────────────────────────
-- 069_skupiska_na_mapie.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 069_skupiska_na_mapie.sql
--
-- Agregacja obiektów dla oddalonych widoków mapy.
--
-- Problem, który to rozwiązuje. Mapa pobiera dziś wszystkie publiczne obiekty
-- naraz. Przy Poznaniu i lubelskiem to ~2 tys. wierszy i da się z tym żyć.
-- Po imporcie całego kraju będzie ich kilkadziesiąt tysięcy, a wtedy bolą dwie
-- rzeczy naraz: transfer oraz to, że Leaflet musi utworzyć w przeglądarce
-- tyleż obiektów markerów, żeby zaraz zwinąć je w klastry.
--
-- Rozwiązanie: przy oddaleniu nie wysyłamy obiektów, tylko LICZBY W SIATCE.
-- Baza grupuje po komórce, zwraca środek ciężkości i liczność. Zamiast
-- 40 tysięcy wierszy przychodzi kilkaset, a przeglądarka rysuje z nich kółka
-- z liczbami — czyli dokładnie to, co i tak zobaczyłby użytkownik.
--
-- Dlaczego siatka na szerokości i długości, a nie PostGIS. Nie mamy rozszerzenia
-- PostGIS, a do zliczania w kwadratach nie jest potrzebne: `floor(lat / krok)`
-- wystarczy. Zniekształcenie przy dużych szerokościach geograficznych nie ma
-- znaczenia — Polska mieści się w wąskim pasie, a to i tak tylko wizualne
-- skupisko, nie pomiar.

CREATE OR REPLACE FUNCTION mapa_skupiska(
  p_lat_min DOUBLE PRECISION,
  p_lat_max DOUBLE PRECISION,
  p_lng_min DOUBLE PRECISION,
  p_lng_max DOUBLE PRECISION,
  p_krok    DOUBLE PRECISION,
  p_sporty  TEXT[] DEFAULT NULL,
  p_typy    TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  lat    DOUBLE PRECISION,
  lng    DOUBLE PRECISION,
  ile    BIGINT,
  sporty TEXT[]
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT avg(f.lat)::DOUBLE PRECISION,
         avg(f.lng)::DOUBLE PRECISION,
         count(*),
         -- Sporty w komórce — kolor kółka bierze się z tego, co w niej jest.
         -- Ograniczone do pięciu, bo ikona i tak pokazuje najwyżej kilka.
         (array_agg(DISTINCT s))[1:5]
    FROM fields f
    CROSS JOIN LATERAL unnest(f.sport) AS s
   WHERE f.map_visibility = 'public'
     AND f.lat IS NOT NULL AND f.lng IS NOT NULL
     AND f.lat BETWEEN p_lat_min AND p_lat_max
     AND f.lng BETWEEN p_lng_min AND p_lng_max
     AND (p_sporty IS NULL OR f.sport && p_sporty)
     AND (p_typy   IS NULL OR f.venue_type = ANY(p_typy))
   GROUP BY floor(f.lat / p_krok), floor(f.lng / p_krok)
$$;

COMMENT ON FUNCTION mapa_skupiska IS
  'Liczby obiektów w komórkach siatki dla oddalonych widoków mapy — zamiast tysięcy wierszy.';

-- Indeks pod zapytanie po prostokącie. Częściowy, bo mapa pyta wyłącznie
-- o obiekty publiczne, a te są mniejszością całego katalogu.
CREATE INDEX IF NOT EXISTS idx_fields_mapa_bbox
  ON fields (lat, lng)
  WHERE map_visibility = 'public';

REVOKE ALL ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                     DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[]) FROM public;
GRANT EXECUTE ON FUNCTION mapa_skupiska(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION,
                                        DOUBLE PRECISION, DOUBLE PRECISION, TEXT[], TEXT[])
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 070_powiadomienia_odwolanie_i_profil.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 070_powiadomienia_odwolanie_i_profil.sql
--
-- Dwa zdarzenia, o których użytkownik dotąd nie miał jak się dowiedzieć.
--
-- 1. ODWOŁANIE MECZU BYŁO CICHE. `cancelEvent()` (lib/events.ts) zmieniało
--    `status` i logowało aktywność — i tyle. Uczestnik dowiadywał się o tym
--    WYŁĄCZNIE wchodząc na stronę meczu i widząc czerwony baner. Kto nie wszedł,
--    przyjeżdżał na boisko. To jedyne miejsce, w którym Bojo było obiektywnie
--    gorsze od zwykłej wiadomości na czacie — i najgorsze możliwe, bo dotyczy
--    zaufania do narzędzia („czy oni w ogóle będą wiedzieć?").
--
-- 2. KONTO BEZ NAZWY publikuje mecz pod nazwą wyprowadzoną z adresu e-mail.
--    Rejestracja e-mailem wymaga już imienia i nazwiska (walidacja w AuthForm),
--    ale konto z Google, którego profil nie niesie `full_name`, wciąż wpada
--    w ten przypadek. Powiadomienie kieruje takiego człowieka do /profil.
--
-- Dlaczego wyzwalacze, a nie kod aplikacji — powód identyczny jak w migracji
-- `065`: tabela `notifications` (migracja `025`) ma politykę SELECT i UPDATE dla
-- własnych wierszy i NIE MA ŻADNEJ polityki INSERT. Przeglądarka nie może więc
-- wpisać powiadomienia nikomu, nawet sobie. Funkcja `SECURITY DEFINER` jest
-- jedynym miejscem, w którym da się to zrobić bez otwierania tabeli na oścież.
-- Przy okazji działa niezależnie od tego, którędy przyszła zmiana — z aplikacji,
-- z panelu Supabase czy ze skryptu.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065` i `067`.

-- ---------------------------------------------------------------------------
-- 1. Organizator odwołał mecz
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_odwolaniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  -- Wyłącznie przejście „cokolwiek innego" → „odwołany". Przywrócenie meczu
  -- (`cancelled` → `active`) nie wysyła nic: to nie jest zła wiadomość, a przy
  -- okazji ratuje przed dublem, gdyby organizator odwołał i przywrócił dwa razy.
  IF NEW.status <> 'cancelled' OR OLD.status IS NOT DISTINCT FROM 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  -- Dostają wszyscy związani z meczem, także rezerwowi i obserwujący —
  -- odwołanie unieważnia ich plany dokładnie tak samo jak plany grających.
  -- Organizator nie, bo to on je wprowadził. Goście bez konta odpadają sami
  -- (`user_id IS NULL`); ich powiadomi ten, kto ich dopisał.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'mecz_odwolany',
         'Mecz odwołany',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI')
           || '. Organizator odwołał ten mecz.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_odwolaniu ON events;
CREATE TRIGGER trg_powiadom_o_odwolaniu
  AFTER UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_odwolaniu();

-- ---------------------------------------------------------------------------
-- 2. Nowe konto bez imienia i nazwiska
-- ---------------------------------------------------------------------------
-- Kolejność względem `on_auth_user_created` (migracja `022`, zakłada wiersz
-- w `profiles`): PostgreSQL odpala wyzwalacze tego samego zdarzenia w kolejności
-- alfabetycznej nazw, a `on_auth_user_created` < `trg_powiadom_o_braku_nazwy`,
-- więc profil powstaje pierwszy. Nie zależymy od tego — piszemy tylko do
-- `notifications` — ale zapisujemy, żeby nikt nie musiał tego wyprowadzać.
--
-- Klucz obcy `notifications.user_id → auth.users` jest spełniony, bo wyzwalacz
-- jest AFTER INSERT na tym samym wierszu.
CREATE OR REPLACE FUNCTION powiadom_o_braku_nazwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(coalesce(
       NEW.raw_user_meta_data ->> 'display_name',
       NEW.raw_user_meta_data ->> 'full_name',
       NEW.raw_user_meta_data ->> 'name',
       '')) <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_braku_nazwy ON auth.users;
CREATE TRIGGER trg_powiadom_o_braku_nazwy
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_braku_nazwy();

-- ŚWIADOMIE BEZ UZUPEŁNIANIA WSTECZ. Konta, które już istnieją, obsługuje baner
-- na pulpicie (`components/home/dashboard/UzupelnijProfilBanner.tsx`) — pokazuje
-- się każdemu bez nazwy, nie tylko nowym. Wysłanie powiadomienia wszystkim
-- zaległym kontom naraz byłoby hałasem w skrzynce, nie informacją.


-- ─────────────────────────────────────────────────────────────────────────
-- 071_wymagaj_pelnej_nazwy_w_powiadomieniu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 071_wymagaj_pelnej_nazwy_w_powiadomieniu.sql
--
-- `powiadom_o_braku_nazwy()` (migracja 070) sprawdzał, czy KTÓREKOLWIEK z pól
-- display_name/full_name/name jest niepuste. Google OAuth zawsze wypełnia
-- full_name/name danymi z profilu Google, więc ten check praktycznie nigdy nie
-- wykrywał braku — powiadomienie „Uzupełnij swoje imię” nie odpalało się dla
-- kont z Google. Front-end ma już dokładnie ten sam problem naprawiony w
-- `profileName.ts` (`isPelneImie()` zamiast usuniętego `brakNazwy()`) — to jest
-- odpowiednik tej naprawy po stronie wyzwalacza, żeby oba mechanizmy (baner na
-- pulpicie i powiadomienie w dzwonku) mierzyły tym samym miernikiem: co
-- najmniej dwa człony nazwy, każdy ≥2 znaki. Bez pełnej parzystości z regexem
-- TS (klasy liter Unicode) — to wystarczające przybliżenie dla jednorazowego
-- powiadomienia przy rejestracji.
CREATE OR REPLACE FUNCTION powiadom_o_braku_nazwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nazwa TEXT;
  v_czlony TEXT[];
BEGIN
  v_nazwa := btrim(coalesce(
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    ''
  ));
  v_czlony := array_remove(regexp_split_to_array(v_nazwa, '\s+'), '');

  IF array_length(v_czlony, 1) >= 2
     AND (SELECT bool_and(char_length(c) >= 2) FROM unnest(v_czlony) c) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    NEW.id,
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );

  RETURN NEW;
END;
$$;

-- Wyzwalacz już istnieje z migracji 070 i wskazuje na tę samą nazwę funkcji —
-- CREATE OR REPLACE wystarczy, nie trzeba go przetwarzać ponownie.


-- ─────────────────────────────────────────────────────────────────────────
-- 072_brakujace_powiadomienia.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 072_brakujace_powiadomienia.sql
--
-- Dwie luki potwierdzone czytaniem kodu, nie tylko zgłoszeniem: zdarzenia,
-- o których zainteresowany dotąd nie miał jak się dowiedzieć bez wejścia na
-- stronę meczu/grupy na chybił trafił.
--
-- 1. ORGANIZATOR NIE WIDZIAŁ, ŻE KTOŚ CZEKA NA AKCEPTACJĘ. Włączenie
--    "Wymagaj akceptacji" (`events.require_approval`) sprawia, że zapis
--    (`event_participants.pending_approval = true`) nie wchodzi do składu
--    automatycznie — ale nic nie mówiło organizatorowi, że w ogóle ktoś
--    czeka. Jedyny sposób, żeby się dowiedzieć: wejść na stronę meczu i
--    sprawdzić panel "Prośby o dołączenie".
--
-- 2. CZŁONKOWIE GRUPY NIE WIDZIELI NOWEGO MECZU W GRUPIE. Dodanie meczu do
--    grupy (`events.group_id`) nie powiadamiało nikogo poza samym faktem,
--    że mecz pojawi się na stronie grupy — trzeba było na nią wejść, żeby
--    się dowiedzieć.
--
-- Wyzwalacze, nie kod aplikacji — ten sam powód co w migracjach `065`/`070`:
-- `notifications` nie ma polityki INSERT dla użytkownika, bo powiadomienie
-- zawsze pisze się KOMU INNEMU niż ten, kto wywołał akcję. Funkcja
-- `SECURITY DEFINER` jest jedynym miejscem, w którym da się to zrobić bez
-- otwierania tabeli na oścież.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065`, `067`, `070`.

-- ---------------------------------------------------------------------------
-- 1. Organizator: ktoś prosi o dołączenie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_prosbie_o_dolaczenie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organizer_id UUID;
  v_tytul        TEXT;
BEGIN
  IF NEW.pending_approval IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  SELECT organizer_id, coalesce(title, sport)
    INTO v_organizer_id, v_tytul
    FROM events
   WHERE id = NEW.event_id;

  -- Organizator prosi sam siebie o dołączenie? Nie zdarza się w praktyce
  -- (własny zapis organizatora nigdy nie ma pending_approval), ale strzeżemy
  -- się dubla ze zdrowym rozsądkiem, jak w `065`/`070`.
  IF v_organizer_id IS NULL OR v_organizer_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    v_organizer_id,
    'prosba_o_dolaczenie',
    'Nowa prośba o dołączenie',
    coalesce(NEW.name, 'Gracz') || ' chce dołączyć do meczu: ' || coalesce(v_tytul, 'mecz') || '.',
    NEW.event_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_prosbie_o_dolaczenie ON event_participants;
CREATE TRIGGER trg_powiadom_o_prosbie_o_dolaczenie
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_prosbie_o_dolaczenie();

-- ---------------------------------------------------------------------------
-- 2. Członkowie grupy: nowy mecz w grupie
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         'Nowy mecz w grupie',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_meczu_w_grupie ON events;
CREATE TRIGGER trg_powiadom_o_nowym_meczu_w_grupie
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_nowym_meczu_w_grupie();


-- ─────────────────────────────────────────────────────────────────────────
-- 073_serie_wydarzen_cyklicznych.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 073_serie_wydarzen_cyklicznych.sql
--
-- Wydarzenia cykliczne przestają być zbiorem niepowiązanych kopii i stają się
-- SERIĄ: kolejne terminy tworzą się same, dziedziczą pełne ustawienia i dają
-- się edytować zbiorczo.
--
-- 1. BRAKUJĄCA KOLUMNA, KTÓREJ KOD JUŻ SZUKAŁ. `getNextEventsForRecurring()`
--    (`lib/recurring.ts`) odpytuje `events.recurring_event_id` od dawna, ale
--    kolumna nigdy nie powstała. Zapytanie połyka błąd (`if (error) return {}`),
--    więc `/cykliczne` pokazywało „Brak terminu" ZAWSZE, niezależnie od stanu
--    faktycznego. To nie był brak funkcji, tylko cicha awaria.
--
-- 2. KOLEJNY TERMIN TRZEBA BYŁO KLIKAĆ RĘCZNIE. Szablon istniał, ale nikt nie
--    tworzył z niego wydarzeń — organizator musiał wejść na `/cykliczne/[id]`
--    i nacisnąć „Utwórz nową edycję". Gierka co tydzień oznaczała klikanie co
--    tydzień, czyli dokładnie tę pracę, którą Bojo miało zdjąć z głowy.
--
-- 3. SPAWN GUBIŁ USTAWIENIA. Szablon `recurring_events` niesie tylko sport,
--    miejsce, dzień, godzinę, limit i widoczność. Reszta szła z domyślnych:
--    cena 0, brak metod płatności, bramkarze wyłączeni, brak akceptacji zapisów.
--    PŁATNA GIERKA ODRADZAŁA SIĘ JAKO DARMOWA — realny błąd, nie brak funkcji.
--
-- PODZIAŁ RÓL, żeby nie duplikować schematu `events` w `recurring_events`:
--   szablon             = reguła powtarzania (dzień, godzina, miejsce, limit,
--                         widoczność, wyprzedzenie, aktywność),
--   ostatni termin serii = żywy wzorzec reszty ustawień (cena, płatności,
--                         bramkarze, grupa, akceptacja, czas na decyzję…).
-- Dzięki temu „popraw ten i przyszłe" działa bez osobnego magazynu ustawień:
-- poprawiasz jeden termin, kolejny się tym żywi.
--
-- WYPRZEDZENIE reużywa `notify_days_before` zamiast nowej kolumny — utworzenie
-- terminu JEST momentem powiadomienia (wyzwalacz na końcu tego pliku), więc dwa
-- osobne ustawienia byłyby tym samym pytaniem zadanym dwa razy.

-- ---------------------------------------------------------------------------
-- 1. Tożsamość serii
-- ---------------------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS recurring_event_id UUID
    REFERENCES recurring_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_recurring ON events (recurring_event_id);

-- SET NULL, nie CASCADE: skasowanie szablonu nie może zabrać ze sobą rozegranych
-- meczów razem ze składami, wynikami i rozliczeniami. Mecz traci przynależność
-- do serii, ale zostaje.

-- Twarda gwarancja przeciw dublom. Funkcja niżej i tak sprawdza istnienie
-- terminu, ale przy cronie co godzinę dwa przebiegi mogą się nałożyć —
-- wtedy sprawdzenie w jednej transakcji nie widzi wstawki z drugiej.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_events_seria_termin
  ON events (recurring_event_id, event_date)
  WHERE recurring_event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2a. Jeden termin serii — wspólne źródło prawdy
-- ---------------------------------------------------------------------------
-- Tę samą funkcję wołają OBA wejścia: cron (niżej) i przycisk „Utwórz nową
-- edycję" na `/cykliczne/[id]` (przez `supabase.rpc`). Dzięki temu termin
-- utworzony ręcznie i automatycznie jest identyczny — gdyby logika kopiowania
-- ustawień żyła osobno w TypeScripcie, obie ścieżki rozjechałyby się przy
-- pierwszej zmianie.
--
-- SECURITY DEFINER, bo RLS na `events` przepuszcza INSERT wyłącznie jako
-- `auth.uid() = organizer_id` — cron nie działa w niczyim imieniu. Stąd jawna
-- kontrola uprawnień w środku: wywołanie z przeglądarki (auth.uid() nie-NULL)
-- musi pochodzić od organizatora serii.
--
-- Zwraca id nowego wydarzenia albo NULL, gdy termin już istniał.
CREATE OR REPLACE FUNCTION utworz_termin_serii(p_szablon_id UUID, p_data DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_szablon  recurring_events%ROWTYPE;
  v_wzor     events%ROWTYPE;
  v_wzor_id  UUID;
  v_ma_wzor  BOOLEAN;
  v_nowy_id  UUID;
  v_bramkarz BOOLEAN;
  v_gra      BOOLEAN;
BEGIN
  SELECT * INTO v_szablon FROM recurring_events WHERE id = p_szablon_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiej serii: %', p_szablon_id;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() <> v_szablon.organizer_id THEN
    RAISE EXCEPTION 'Tylko organizator może tworzyć terminy tej serii';
  END IF;

  -- Termin już istnieje (ręcznie albo z poprzedniego przebiegu crona).
  IF EXISTS (
    SELECT 1 FROM events
     WHERE recurring_event_id = p_szablon_id AND event_date = p_data
  ) THEN
    RETURN NULL;
  END IF;

  -- Ostatni termin serii jako wzorzec ustawień.
  SELECT * INTO v_wzor
    FROM events
   WHERE recurring_event_id = p_szablon_id
   ORDER BY event_date DESC
   LIMIT 1;
  v_ma_wzor := FOUND;
  v_wzor_id := v_wzor.id;  -- id POPRZEDNIEGO terminu; niżej v_wzor.id nadpisujemy

  IF v_ma_wzor THEN
    -- Kopia całego wiersza: każda kolumna `events` — także te dodane przyszłymi
    -- migracjami — jedzie automatycznie. Niżej zerujemy tylko to, co jest
    -- własnością POJEDYNCZEGO terminu, nie serii.
    v_wzor.id                 := gen_random_uuid();
    v_wzor.event_date         := p_data;
    v_wzor.created_at         := now();
    v_wzor.status             := 'active';
    v_wzor.join_code          := generate_join_code();  -- kolumna UNIQUE
    v_wzor.teams_published    := false;                 -- składy są per termin
    v_wzor.recurring_event_id := p_szablon_id;

    -- Pola, których właścicielem jest szablon (reguła powtarzania). Nadpisują
    -- wzorzec, żeby edycja szablonu realnie wpływała na kolejne terminy.
    v_wzor.sport        := v_szablon.sport;
    v_wzor.field_id     := v_szablon.field_id;
    v_wzor.field_name   := v_szablon.field_name;
    v_wzor.lat          := v_szablon.lat;
    v_wzor.lng          := v_szablon.lng;
    v_wzor.title        := v_szablon.title;
    v_wzor.description  := v_szablon.description;
    v_wzor.event_time   := v_szablon.event_time;
    v_wzor.end_time     := v_szablon.end_time;
    v_wzor.max_players  := v_szablon.max_players;
    v_wzor.visibility   := v_szablon.visibility;

    INSERT INTO events VALUES (v_wzor.*) RETURNING id INTO v_nowy_id;
  ELSE
    -- Pierwszy termin serii — nie ma z czego dziedziczyć, biorą domyślne bazy.
    INSERT INTO events (
      organizer_id, organizer_name, sport, field_id, field_name, lat, lng,
      title, description, event_date, event_time, end_time, max_players,
      visibility, recurring_event_id
    ) VALUES (
      v_szablon.organizer_id, v_szablon.organizer_name, v_szablon.sport,
      v_szablon.field_id, v_szablon.field_name, v_szablon.lat, v_szablon.lng,
      v_szablon.title, v_szablon.description, p_data, v_szablon.event_time,
      v_szablon.end_time, v_szablon.max_players, v_szablon.visibility,
      p_szablon_id
    ) RETURNING id INTO v_nowy_id;
  END IF;

  -- Czy organizator gra? Idzie za poprzednim terminem — organizator, który
  -- tylko prowadzi gierkę i sam nie wchodzi na boisko, nie ma powodu co
  -- tydzień wypisywać się ze składu. Bez wzorca: gra (domyślne `createEvent`).
  IF v_ma_wzor THEN
    SELECT coalesce(p.is_goalkeeper, false)
      INTO v_bramkarz
      FROM event_participants p
     WHERE p.event_id = v_wzor_id
       AND p.user_id = v_szablon.organizer_id
       AND p.is_guest = false
     LIMIT 1;
    v_gra := FOUND;
  ELSE
    v_gra := true;
    v_bramkarz := false;
  END IF;

  IF v_gra THEN
    INSERT INTO event_participants (event_id, user_id, name, is_guest, is_goalkeeper)
    VALUES (v_nowy_id, v_szablon.organizer_id, v_szablon.organizer_name,
            false, coalesce(v_bramkarz, false));
  END IF;

  RETURN v_nowy_id;
END;
$$;

-- Przeglądarka woła to przez `supabase.rpc('utworz_termin_serii', …)`;
-- kontrola „tylko organizator" siedzi w środku funkcji.
GRANT EXECUTE ON FUNCTION utworz_termin_serii(UUID, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2b. Które terminy są już należne — pętla dla crona
-- ---------------------------------------------------------------------------
-- Czas liczony w strefie 'Europe/Warsaw', nie w UTC bazy: przy meczu o 20:00
-- i bazie w UTC różnica 1–2 h potrafi przesunąć „dzisiaj" na sąsiedni dzień
-- i wyliczyć zły termin.
CREATE OR REPLACE FUNCTION utworz_nalezne_terminy_serii()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teraz     TIMESTAMP := now() AT TIME ZONE 'Europe/Warsaw';
  v_dzis      DATE      := (now() AT TIME ZONE 'Europe/Warsaw')::date;
  v_szablon   RECORD;
  v_termin    DATE;
  v_odstep    INT;
  v_utworzone INTEGER := 0;
BEGIN
  FOR v_szablon IN SELECT * FROM recurring_events WHERE is_active LOOP
    -- Najbliższe wystąpienie dnia tygodnia (1=Pon…7=Niedz, ISO).
    v_odstep := (v_szablon.day_of_week - EXTRACT(ISODOW FROM v_dzis)::INT + 7) % 7;
    v_termin := v_dzis + v_odstep;

    -- Dzisiaj, ale godzina już minęła → termin był, następny za tydzień.
    -- Bez tego cron tworzyłby mecz kilka godzin po jego zakończeniu.
    IF v_odstep = 0 AND v_szablon.event_time <= v_teraz::time THEN
      v_termin := v_termin + 7;
    END IF;

    -- Jeszcze za wcześnie, żeby otwierać zapisy.
    CONTINUE WHEN (v_termin - v_dzis) > v_szablon.notify_days_before;

    IF utworz_termin_serii(v_szablon.id, v_termin) IS NOT NULL THEN
      v_utworzone := v_utworzone + 1;
    END IF;
  END LOOP;

  RETURN v_utworzone;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Harmonogram — co godzinę
-- ---------------------------------------------------------------------------
-- Owinięte w DO, bo `pg_cron` bywa niewłączony, a wtedy samo `cron.schedule`
-- wywróciłoby CAŁĄ migrację — łącznie z kolumną i funkcją wyżej, które są
-- wartościowe niezależnie od harmonogramu. Bez crona funkcja działa z ręki:
--   SELECT utworz_nalezne_terminy_serii();
-- Włączenie: Supabase → Database → Extensions → pg_cron, potem ponownie ten blok.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'bojo-terminy-serii';
    -- Minuta 7, nie 0: pełna godzina to najbardziej zatłoczony moment na
    -- współdzielonej instancji.
    PERFORM cron.schedule(
      'bojo-terminy-serii', '7 * * * *',
      $cron$SELECT utworz_nalezne_terminy_serii()$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron niewłączony — terminy serii nie będą powstawać automatycznie. Włącz rozszerzenie i uruchom ten blok ponownie.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Powiadomienie o nowym terminie serii
-- ---------------------------------------------------------------------------
-- Termin, który powstaje po cichu, nie rozwiązuje niczego — gracze i tak muszą
-- wejść i sprawdzić, czyli dokładnie to, co miało zniknąć. Dostają go uczestnicy
-- POPRZEDNIEGO terminu tej serii: to oni grają w tę gierkę.
--
-- Bez organizatora (sam ją prowadzi), bez gości bez konta (`user_id IS NULL`)
-- i bez członków grupy meczu — tym `powiadom_o_nowym_meczu_w_grupie` (migracja
-- `072`) wysyła już własne powiadomienie o tym samym meczu.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_terminie_serii()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul     TEXT;
  v_poprzedni UUID;
BEGIN
  IF NEW.recurring_event_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_poprzedni
    FROM events
   WHERE recurring_event_id = NEW.recurring_event_id
     AND event_date < NEW.event_date
   ORDER BY event_date DESC
   LIMIT 1;

  -- Pierwszy termin serii — nie ma jeszcze komu powiedzieć.
  IF v_poprzedni IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id,
         'nowy_termin_serii',
         'Nowy termin stałej gierki',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '. Zapisy otwarte.',
         NEW.id
    FROM event_participants p
   WHERE p.event_id = v_poprzedni
     AND p.user_id IS NOT NULL
     AND p.user_id <> NEW.organizer_id
     AND (
       NEW.group_id IS NULL
       OR NOT EXISTS (
         SELECT 1 FROM group_members gm
          WHERE gm.group_id = NEW.group_id AND gm.user_id = p.user_id
       )
     );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_terminie_serii ON events;
CREATE TRIGGER trg_powiadom_o_nowym_terminie_serii
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_nowym_terminie_serii();


-- ─────────────────────────────────────────────────────────────────────────
-- 074_statystyki_bez_usunietego_statusu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 074_statystyki_bez_usunietego_statusu.sql
--
-- NAPRAWA REGRESJI. Migracja `064` skasowała `event_participants.status` razem
-- ze śledzeniem obecności, ale nie ruszyła funkcji `get_player_stats()`, która
-- tej kolumny używała (`ep.status = 'potwierdzony'`, migracja `055`).
--
-- Skutek na produkcji: funkcja przestała się wykonywać, a strona gracza łapie
-- każdy wyjątek jednym `catch` i pokazuje „Nie znaleziono gracza". Czyli awaria
-- jednej statystyki udawała nieistniejące konto — także własne, wejściem
-- „Moje statystyki" z profilu.
--
-- Pole `attended` znika z wyniku, a nie dostaje zastępczej definicji. Liczyło
-- potwierdzenia obecności, a obecności w Bojo już nie ma; utrzymywanie kolumny
-- zwracającej zawsze zero to obietnica funkcji, której nie ma. Aplikacja nigdzie
-- tej wartości nie pokazywała — mapowanie w `lib/players.ts` było jedynym
-- miejscem, w którym w ogóle występowała.
--
-- Zmiana kształtu wyniku wymaga DROP przed CREATE: `CREATE OR REPLACE` nie
-- pozwala zmienić listy zwracanych kolumn.

DROP FUNCTION IF EXISTS get_player_stats(UUID);

CREATE FUNCTION get_player_stats(p_user_id UUID)
RETURNS TABLE (
  events_joined     INT,
  events_organized  INT,
  matches_played    INT,
  goals_total       INT,
  no_shows          INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- Mecze, na które gracz się realnie zapisał. „Obserwuję" (rsvp = 'maybe')
    -- nie zajmuje miejsca, więc nie jest udziałem.
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
      WHERE ep.user_id = p_user_id
        AND ep.is_guest = false
        AND ep.rsvp <> 'maybe'),

    (SELECT count(*)::int
       FROM events e
      WHERE e.organizer_id = p_user_id),

    -- Rozegrane: w składzie (nie na rezerwie), mecz się odbył i nie został odwołany.
    (SELECT count(DISTINCT ep.event_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE ep.user_id    = p_user_id
        AND ep.is_guest   = false
        AND ep.is_reserve = false
        AND ep.rsvp      <> 'maybe'
        AND e.status      != 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    (SELECT COALESCE(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN event_participants ep ON ep.id = pg.participant_id
      WHERE ep.user_id = p_user_id),

    (SELECT count(*)::int
       FROM player_reports pr
       JOIN event_participants ep ON ep.id = pr.reported_participant_id
      WHERE ep.user_id = p_user_id AND pr.report_type = 'nie_przyszedl')
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 075_rezerwa_per_rola.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Rezerwa: limit pola i bramkarzy osobno
--
-- sync_reserve_claim liczyło jedną, wspólną pulę `taken vs max_players` — to samo
-- uproszczenie, które w TypeScripcie (joinEvent i inne) pozwalało zawodnikom z pola
-- wchodzić do składu mimo wyczerpanego limitu pola. Naprawa jest symetryczna: bramkarze
-- i zawodnicy z pola mają teraz OSOBNE pule i osobne kolejki rezerwy, a funkcja może
-- w jednym przebiegu zaproponować miejsce w obu rolach naraz.
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean;
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_field_confirmed int; v_gk_confirmed int;
  v_field_offered int; v_gk_offered int;
  v_field_cap int; v_gk_cap int;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_max, v_max_gk, v_gk_enabled, v_hours, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN RETURN; END IF;

  -- Mark expired claims as passed
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Count confirmed (non-reserve, not pending, not maybe) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_confirmed, v_gk_confirmed
    FROM event_participants
   WHERE event_id = p_event_id AND is_reserve = false AND pending_approval = false AND rsvp <> 'maybe';

  -- Count offered spots (held by active claims) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_offered, v_gk_offered
    FROM event_participants
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL;

  -- Capacity per role
  v_gk_cap := CASE WHEN v_gk_enabled THEN v_max_gk ELSE 0 END;
  v_field_cap := CASE WHEN v_gk_enabled THEN GREATEST(0, v_max - v_max_gk) ELSE v_max END;

  -- Field players
  IF v_field_confirmed + v_field_offered < v_field_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Goalkeepers — the same pattern, separate queue
  IF v_gk_enabled AND v_gk_confirmed + v_gk_offered < v_gk_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 076_pelniejsze_tresci_powiadomien.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Powiadomienia: daty/godziny + odrzucenie prośby
--
-- Powiadomienia `zapis_zaakceptowany` i `prosba_o_dolaczenie` miały treść bez
-- daty/godziny meczu, co zmuszało odbiorce do wejścia do aplikacji, aby znaleźć
-- datę. Dodatkowo brakuje powiadomienia o odrzuceniu prośby.

CREATE OR REPLACE FUNCTION powiadom_o_akceptacji()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.user_id IS NULL OR OLD.pending_approval IS NOT TRUE OR NEW.pending_approval IS NOT FALSE THEN
    RETURN NEW;
  END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = NEW.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (NEW.user_id, 'zapis_zaakceptowany', 'Jesteś w składzie',
    'Organizator przyjął Twój zapis na mecz: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_prosbie_o_dolaczenie()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_organizer_id UUID; v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF NEW.pending_approval IS NOT TRUE THEN RETURN NEW; END IF;
  SELECT organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_organizer_id, v_tytul, v_data, v_godz FROM events WHERE id = NEW.event_id;
  IF v_organizer_id IS NULL OR v_organizer_id = NEW.user_id THEN RETURN NEW; END IF;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (v_organizer_id, 'prosba_o_dolaczenie', 'Nowa prośba o dołączenie',
    coalesce(NEW.name,'Gracz') || ' chce dołączyć do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    NEW.event_id);
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_odrzuceniu_prosby ON event_participants;
CREATE TRIGGER trg_powiadom_o_odrzuceniu_prosby
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_odrzuceniu_prosby();


-- ─────────────────────────────────────────────────────────────────────────
-- 077_tryb_miejsc_bramkarzy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Tryb miejsc dla bramkarzy: rezerwacja albo sam limit
--
-- DLACZEGO
-- Przy 14 miejscach i 2 bramkarzach zawodnicy z pola walczyli o 12 miejsc
-- (`max_players - max_goalkeepers`), więc trzynasty chętny lądował na rezerwie,
-- podczas gdy dwa miejsca dla bramkarzy stały puste — także wtedy, gdy żaden
-- bramkarz się nie zapisał i już nie miał zamiaru. Liczba wpisana przez
-- organizatora jako „liczba miejsc" nie była liczbą osób, które mogą dołączyć,
-- a nic o tym nie mówiło.
--
-- Rezerwacja bywa jednak dokładnie tym, czego organizator chce: bez niej można
-- skończyć z kompletem zawodników z pola i zerem bramkarzy. Zamiast wybierać
-- za wszystkich, dajemy wybór.
--
-- SEMANTYKA
--   goalkeeper_slots_reserved = true  (dotychczasowe zachowanie)
--     pole:      max_players - max_goalkeepers
--     bramkarze: max_goalkeepers
--     Miejsca bramkarzy czekają, choćby do końca.
--
--   goalkeeper_slots_reserved = false
--     wspólna pula max_players dla wszystkich,
--     bramkarze dodatkowo ograniczeni do max_goalkeepers.
--     Kto pierwszy, ten w składzie; bramkarza może zabraknąć.
--
-- Domyślnie `true`, bo tak działały wszystkie mecze istniejące w chwili tej
-- migracji — zmiana domyślnej wartości przestawiłaby im zasady w trakcie.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS goalkeeper_slots_reserved BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.goalkeeper_slots_reserved IS
  'true = miejsca dla bramkarzy są zarezerwowane (pole ma max_players - max_goalkeepers); '
  'false = wspólna pula max_players, bramkarze tylko ograniczeni do max_goalkeepers.';

-- ---------------------------------------------------------------------------
-- sync_reserve_claim respektuje tryb
-- ---------------------------------------------------------------------------
-- Bez tego kolejka rezerwowa liczyłaby pojemność inaczej niż aplikacja przy
-- zapisie: gracz wchodziłby do składu, a funkcja i tak trzymałaby go w kolejce
-- (albo odwrotnie — proponowałaby miejsce, którego nie ma).
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean; v_gk_reserved boolean;
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_field_confirmed int; v_gk_confirmed int;
  v_field_offered int; v_gk_offered int;
  v_field_cap int; v_gk_cap int;
  v_zajete int;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, goalkeeper_slots_reserved,
         reserve_claim_hours,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_max, v_max_gk, v_gk_enabled, v_gk_reserved, v_hours, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_max IS NULL OR v_started THEN RETURN; END IF;

  -- Mark expired claims as passed
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Count confirmed (non-reserve, not pending, not maybe) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_confirmed, v_gk_confirmed
    FROM event_participants
   WHERE event_id = p_event_id AND is_reserve = false AND pending_approval = false AND rsvp <> 'maybe';

  -- Count offered spots (held by active claims) per role
  SELECT count(*) FILTER (WHERE NOT is_goalkeeper), count(*) FILTER (WHERE is_goalkeeper)
    INTO v_field_offered, v_gk_offered
    FROM event_participants
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL;

  v_zajete := v_field_confirmed + v_field_offered + v_gk_confirmed + v_gk_offered;

  -- Pojemność per rola.
  IF NOT v_gk_enabled THEN
    v_gk_cap := 0;
    v_field_cap := v_max;
  ELSIF v_gk_reserved THEN
    v_gk_cap := v_max_gk;
    v_field_cap := GREATEST(0, v_max - v_max_gk);
  ELSE
    -- Wspólna pula: limit dla roli to tyle, ile zostało w całości — a dla
    -- bramkarzy dodatkowo nie więcej, niż mówi ich własny limit. Liczone jako
    -- „ile jeszcze wejdzie" i przeliczane na pułap dla tej roli, żeby dalsza
    -- część funkcji mogła zostać bez zmian.
    v_field_cap := v_field_confirmed + v_field_offered + GREATEST(0, v_max - v_zajete);
    v_gk_cap := v_gk_confirmed + v_gk_offered
                + LEAST(GREATEST(0, v_max - v_zajete), GREATEST(0, v_max_gk - v_gk_confirmed - v_gk_offered));
  END IF;

  -- Field players
  IF v_field_confirmed + v_field_offered < v_field_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
      -- Zajęliśmy miejsce ze wspólnej puli — bramkarz nie może dostać tego samego.
      IF v_gk_enabled AND NOT v_gk_reserved THEN
        v_gk_cap := v_gk_cap - 1;
      END IF;
    END IF;
  END IF;

  -- Goalkeepers — the same pattern, separate queue
  IF v_gk_enabled AND v_gk_confirmed + v_gk_offered < v_gk_cap THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 078_dolaczanie_w_bazie.sql
-- ─────────────────────────────────────────────────────────────────────────
-- Jedno źródło prawdy dla reguły „skład czy rezerwa"
--
-- DLACZEGO
-- Ta sama reguła istniała w dwóch implementacjach: `decydujCzyRezerwa()`
-- w TypeScripcie (wołane przy zapisie, akceptacji prośby i dopisaniu gościa)
-- oraz `sync_reserve_claim()` w SQL (wołane, gdy zwolni się miejsce). Rozjazd
-- między nimi NIE daje błędu — daje niespójność: gracz wchodzi do składu,
-- a kolejka i tak trzyma go w rezerwie, albo odwrotnie: kolejka proponuje
-- miejsce, którego zapis nie uzna za wolne.
--
-- Przy każdej zmianie reguł (limit bramkarzy w `075`, tryb rezerwacji w `077`)
-- trzeba było pamiętać o obu miejscach i ręcznie pilnować, żeby liczyły tak
-- samo. To działało dopóki działało.
--
-- Po tej migracji regułę zna wyłącznie `czy_na_rezerwe()`. TypeScript nie
-- decyduje o niczym — pyta albo woła `dolacz_do_meczu()`.

-- ---------------------------------------------------------------------------
-- 1. Reguła: czy zapis w danej roli trafia na rezerwę
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION czy_na_rezerwe(p_event_id UUID, p_bramkarz BOOLEAN)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max int; v_max_gk int; v_gk_enabled boolean; v_gk_reserved boolean;
  v_pole int; v_bramkarze int; v_zajete int;
BEGIN
  SELECT max_players, max_goalkeepers, goalkeepers_enabled, goalkeeper_slots_reserved
    INTO v_max, v_max_gk, v_gk_enabled, v_gk_reserved
    FROM events WHERE id = p_event_id;

  IF v_max IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Liczymy tak samo jak `sync_reserve_claim`: bez rezerwowych, bez próśb
  -- czekających na akceptację i bez obserwujących. Wpisy z aktywną ofertą
  -- miejsca (`claim_offered_at`) TRZYMAJĄ miejsce, więc liczą się do zajętych —
  -- inaczej dwie osoby dostałyby to samo miejsce.
  SELECT
    count(*) FILTER (WHERE NOT is_goalkeeper),
    count(*) FILTER (WHERE is_goalkeeper)
    INTO v_pole, v_bramkarze
    FROM event_participants
   WHERE event_id = p_event_id
     AND pending_approval = false
     AND rsvp <> 'maybe'
     AND (is_reserve = false OR claim_offered_at IS NOT NULL);

  v_zajete := v_pole + v_bramkarze;

  IF NOT v_gk_enabled THEN
    RETURN v_zajete >= v_max;
  END IF;

  IF v_gk_reserved THEN
    IF p_bramkarz THEN
      RETURN v_bramkarze >= v_max_gk;
    END IF;
    RETURN v_pole >= GREATEST(0, v_max - v_max_gk);
  END IF;

  -- Wspólna pula: o miejsce konkurują wszyscy, bramkarze mają dodatkowo
  -- własny sufit.
  IF v_zajete >= v_max THEN
    RETURN true;
  END IF;
  RETURN p_bramkarz AND v_bramkarze >= v_max_gk;
END;
$$;

GRANT EXECUTE ON FUNCTION czy_na_rezerwe(UUID, BOOLEAN) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dołączanie do meczu jako jedna operacja
-- ---------------------------------------------------------------------------
-- Wcześniej zapis był sekwencją czterech kroków po stronie przeglądarki:
-- odśwież kolejkę → wczytaj ustawienia meczu → policz pojemność → wstaw wiersz.
-- Między krokiem trzecim a czwartym mogło wejść dwóch graczy naraz i obaj
-- dostawali to samo ostatnie miejsce. Tutaj to jedna transakcja.
--
-- SECURITY DEFINER, bo funkcja czyta ustawienia meczu i cudze wpisy, żeby
-- policzyć pojemność. Tożsamość bierzemy z `auth.uid()` — nie z argumentu —
-- więc nikt nie zapisze na mecz kogoś innego.
CREATE OR REPLACE FUNCTION dolacz_do_meczu(
  p_event_id UUID,
  p_nazwa TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false,
  p_dostawca_karty TEXT DEFAULT NULL
)
RETURNS TABLE (is_reserve BOOLEAN, pending BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_organizator uuid;
  v_wymaga_akceptacji boolean;
  v_odwolany boolean;
  v_rezerwa boolean;
  v_pending boolean;
  v_nazwa text := btrim(p_nazwa);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby dołączyć';
  END IF;
  IF v_nazwa = '' OR length(v_nazwa) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  SELECT organizer_id, require_approval, status = 'cancelled'
    INTO v_organizator, v_wymaga_akceptacji, v_odwolany
    FROM events WHERE id = p_event_id;

  IF v_organizator IS NULL THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF v_odwolany THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;
  IF EXISTS (SELECT 1 FROM event_participants
              WHERE event_id = p_event_id AND user_id = v_user) THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz';
  END IF;

  -- Wygasłe oferty muszą przepaść ZANIM policzymy pojemność, inaczej martwa
  -- oferta blokowałaby miejsce nowemu chętnemu.
  PERFORM sync_reserve_claim(p_event_id);

  -- Organizator nie akceptuje sam siebie.
  v_pending := v_wymaga_akceptacji AND v_user <> v_organizator;
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

  INSERT INTO event_participants (
    event_id, user_id, name, is_guest, is_reserve, is_goalkeeper,
    pending_approval, payment_method, has_sports_card, sports_card_provider
  ) VALUES (
    p_event_id, v_user, v_nazwa, false, v_rezerwa, p_bramkarz,
    v_pending, p_metoda_platnosci, p_karta_sportowa,
    CASE WHEN p_karta_sportowa THEN p_dostawca_karty ELSE NULL END
  );

  RETURN QUERY SELECT v_rezerwa, v_pending;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_meczu(UUID, TEXT, BOOLEAN, TEXT, BOOLEAN, TEXT)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. sync_reserve_claim korzysta z tej samej reguły
-- ---------------------------------------------------------------------------
-- Funkcja rozdaje zwolnione miejsca, więc pyta odwrotnie niż zapis: „czy jest
-- miejsce dla kogoś w tej roli", czyli `NOT czy_na_rezerwe(...)`. Dzięki temu
-- reguła istnieje fizycznie w jednym miejscu — poprzednia wersja liczyła pułapy
-- własnym kodem, równoległym do TypeScriptu.
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_hours, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_hours, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_hours IS NULL OR v_started THEN RETURN; END IF;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Zawodnicy z pola
  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Bramkarze — osobna kolejka. Pytanie zadajemy PONOWNIE, bo powyższa oferta
  -- mogła właśnie zająć ostatnie miejsce ze wspólnej puli (tryb `077`).
  IF v_gk_enabled AND NOT czy_na_rezerwe(p_event_id, true) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY created_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 079_powiadom_o_zmianie_kompletu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 079_powiadom_o_zmianie_kompletu.sql
--
-- Organizator nie dowiadywał się o dwóch zdarzeniach, które są dla niego
-- najważniejsze w całym cyklu życia meczu:
--
--   1. ZEBRAŁ SIĘ KOMPLET — moment, w którym przestaje szukać ludzi.
--   2. KTOŚ SIĘ WYPISAŁ Z KOMPLETNEGO SKŁADU — moment, w którym musi szukać od
--      nowa. Na czacie WhatsApp to widoczna wiadomość; w Bojo była cisza aż do
--      chwili, gdy organizator sam z siebie otworzył stronę meczu. Kto nie
--      wszedł, przyjeżdżał na boisko w dziesiątkę.
--
-- Powiadamiamy o ZMIANIE STANU „komplet / niekomplet", w obie strony — nie
-- o pojedynczym zapisie. Przy domyślnym składzie 14 osób ping przy każdym
-- zapisie dałby kilkanaście wpisów pod dzwonkiem na jeden mecz i zagłuszył te
-- dwa, które naprawdę wymagają reakcji.
--
-- Licznik celowo NIE zna trybu miejsc dla bramkarzy (`077`,
-- goalkeeper_slots_reserved) ani wspólnej reguły rezerwy (`078`,
-- czy_na_rezerwe). Liczy dokładnie to, co liczy interfejs organizatora —
-- `regulars.length` na stronie meczu (potwierdzone i nierezerwowe wpisy) —
-- bo to jest liczba, którą organizator ma na ekranie i z którą porównuje
-- powiadomienie. Osobna, dokładniejsza reguła dla ról dałaby powiadomienie
-- niespójne z tym, co widać na stronie.
--
-- Wyzwalacz, nie kod aplikacji — powód identyczny jak w `065`, `070` i `072`:
-- `notifications` (`025`) nie ma polityki INSERT, bo powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję. Jeden wyzwalacz na
-- INSERT/UPDATE/DELETE łapie wszystkie drogi do zmiany składu naraz — zwykły
-- zapis (`dolacz_do_meczu`, `078`), akceptację prośby (`approveParticipant`),
-- przyjęcie zwolnionego miejsca (`acceptReserveClaim`), usunięcie gracza
-- i rezygnację — zamiast wołania z każdego miejsca osobno.
--
-- Kanał: skrzynka w aplikacji (dzwonek), ta sama co `025`, `062`, `065`, `067`,
-- `070`, `072`, `076`.

CREATE OR REPLACE FUNCTION powiadom_o_zmianie_kompletu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_status       TEXT;
  v_max          INT;
  v_po           INT;
  v_przed        INT;
  v_rezerwa      INT;
  v_imie         TEXT;
BEGIN
  -- W wyzwalaczu DELETE zmienna NEW nie jest przypisana — nie wolno jej dotknąć.
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; ELSE v_event_id := NEW.event_id; END IF;

  SELECT organizer_id, coalesce(title, sport), event_date, event_time, status, max_players
    INTO v_organizer_id, v_tytul, v_data, v_godz, v_status, v_max
    FROM events WHERE id = v_event_id;

  -- Brak wiersza meczu = kaskada z `DELETE FROM events`; poza tym mecz odwołany
  -- albo miniony — zmiana składu nikogo już nie obchodzi.
  IF v_organizer_id IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  -- Organizator sam zmienił skład (usunął gracza, przyjął prośbę, dopisał
  -- gościa) — wie o tym, bo właśnie to zrobił.
  IF auth.uid() IS NOT NULL AND auth.uid() = v_organizer_id THEN
    RETURN NULL;
  END IF;

  -- Liczymy dokładnie to, co liczy interfejs (`regulars`): wpisy potwierdzone
  -- i nierezerwowe. „Obserwuję" (`rsvp = 'maybe'`) jest zapisywane jako rezerwa,
  -- więc odpada samo.
  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id
     AND pending_approval IS NOT TRUE
     AND is_reserve IS NOT TRUE;

  -- Stan sprzed operacji: wyzwalacz AFTER widzi już nowy stan tabeli, więc
  -- wystarczy cofnąć wkład tego jednego wiersza, którego operacja dotyczyła.
  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  -- ── Niekomplet → komplet ─────────────────────────────────────────────────
  IF v_przed < v_max AND v_po >= v_max THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'komplet_skladu', 'Masz komplet',
      coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM')
        || ', godz. ' || to_char(v_godz, 'HH24:MI') || '. Skład jest pełny: '
        || v_po || ' z ' || v_max || '.',
      v_event_id);
    RETURN NULL;
  END IF;

  -- ── Komplet → niekomplet ─────────────────────────────────────────────────
  IF v_przed >= v_max AND v_po < v_max THEN
    -- Kto realnie czeka w kolejce: bez „obserwuję", bez czekających na
    -- akceptację i bez tych, którzy już raz miejsce przepuścili.
    SELECT count(*) INTO v_rezerwa
      FROM event_participants
     WHERE event_id = v_event_id
       AND is_reserve IS TRUE
       AND pending_approval IS NOT TRUE
       AND rsvp <> 'maybe'
       AND claim_passed IS NOT TRUE;

    v_imie := coalesce(CASE WHEN TG_OP = 'DELETE' THEN OLD.name ELSE NEW.name END, 'Ktoś');

    INSERT INTO notifications (user_id, type, title, body, event_id)
    VALUES (v_organizer_id, 'zwolnilo_sie_miejsce', 'Zwolniło się miejsce',
      v_imie || ' wypisał(a) się z meczu: ' || coalesce(v_tytul, 'Mecz') || ' — '
        || to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
        || '. Skład: ' || v_po || ' z ' || v_max || '. '
        || CASE WHEN v_rezerwa > 0
                THEN 'Miejsce trafia do pierwszej osoby z rezerwy (czeka ich ' || v_rezerwa || ').'
                ELSE 'Nie ma nikogo na rezerwie — trzeba znaleźć zmiennika.' END,
      v_event_id);
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_kompletu ON event_participants;
CREATE TRIGGER trg_powiadom_o_zmianie_kompletu
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_zmianie_kompletu();


-- ─────────────────────────────────────────────────────────────────────────
-- 082_guest_self_signup.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 082: Self-service guest signup without account
--
-- Pozwala niezalogowanemu graczowi zapisać się na mecz bez konta, podając imię
-- i e-mail. Tworzy wpis gościa z `claim_token`, który pozwoli mu później
-- przejąć ten wpis po założeniu konta.
--
-- Model: gość mówi "zapisz mnie jako [imię] pod [email]", system tworzy
-- `event_participants` z `user_id = NULL`, `is_guest = true`, `guest_email`,
-- i losowym `claim_token` generowanym triggerem `nadaj_token_gosciowi()` (066).
--
-- Reguły pojemności są identyczne jak przy normalnym zapisie (`czy_na_rezerwe`).
-- RLS nie pozwala bezpośredniego INSERT-u dla anon — potrzebna funkcja
-- `SECURITY DEFINER`.

-- ============================================================================
-- Dodaj kolumny do `event_participants` dla danych gościa
-- ============================================================================

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS guest_email TEXT,
  ADD COLUMN IF NOT EXISTS guest_phone TEXT;

COMMENT ON COLUMN event_participants.guest_email IS
  'E-mail gościa zapisanego bez konta (self-service signup)';

COMMENT ON COLUMN event_participants.guest_phone IS
  'Numer telefonu gościa (opcjonalnie)';

-- ============================================================================
-- Funkcja: dołączenie do meczu jako gość bez konta
-- ============================================================================
--
-- Przyjmuje: event_id, imię, e-mail, opcjonalnie rolę i płatność.
-- Robi to samo co `dolacz_do_meczu()`, ale dla auth.uid() = NULL.
--
-- Zwraca: `claim_token` (do przejęcia wpisu linkiem) i `event_id` (do powrotu).

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_nowy_token uuid;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa
  INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  );

  -- Pobierz `claim_token` z wiersza, który właśnie wstawiliśmy
  -- (został wygenerowany triggerem `nadaj_token_gosciowi`)
  SELECT claim_token INTO v_nowy_token
    FROM event_participants
   WHERE event_id = p_event_id
     AND user_id IS NULL
     AND is_guest = true
     AND name = v_imie_clean
     AND guest_email = v_email_clean
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN QUERY SELECT v_nowy_token, p_event_id;
END;
$$;

-- Zezwol anonimom na wywołanie
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;

-- ============================================================================
-- Weryfikacja: trigger `nadaj_token_gosciowi` istnieje (z migracji 066)
-- ============================================================================
-- Trigger generuje `claim_token` dla każdego nowego wiersza gościa.
-- Jeśli go nie ma, funkcja wyżej nie będzie działać — ale to powinno być
-- niemożliwe, bo migracja 066 jest dawna (lipiec 2024+).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
     WHERE trigger_name = 'trg_nadaj_token_gosciowi'
  ) THEN
    RAISE WARNING 'Trigger nadaj_token_gosciowi nie istnieje — migracjajest niekompletna?';
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 083_fix_guest_signup_claim_token.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 083: Fix ambiguous claim_token in guest signup function
--
-- Migracja 082 ma błąd SQL: SELECT claim_token bez prefiksu tabeli powoduje
-- "column reference 'claim_token' is ambiguous" w niektórych kontekstach.
--
-- Rozwiązanie: zmienić INSERT + SELECT na INSERT...RETURNING z jawnym prefixem.
-- To jest bardziej efektywne (jedna operacja zamiast dwóch) i unika dwuznaczności.

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  )
  RETURNING event_participants.claim_token, p_event_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 084_powiadomienie_o_koncie_z_wpisem_goscia.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 084: Powiadom istniejące/nowe konto o niepotwierdzonym wpisie gościa
--
-- Problem. Ktoś zapisuje się na mecz jako gość (imię + e-mail, bez logowania),
-- a pod tym e-mailem od dawna istnieje konto — albo dopiero za chwilę je
-- założy, osobno, bez związku z tym meczem. W obu przypadkach wpis gościa
-- czeka na przejęcie linkiem (`claim_token`, migracja `066`), ale nikt mu o tym
-- nie mówi — trzeba trafić na link ręcznie.
--
-- Rozwiązanie. Dwa triggery po obu stronach tego samego skojarzenia po
-- e-mailu:
--   A) nowy wpis gościa -> jeśli e-mail pasuje do JUŻ ISTNIEJĄCEGO konta,
--      powiadomienie trafia do tego konta od razu.
--   B) nowe konto -> jeśli e-mail pasuje do JUŻ ISTNIEJĄCYCH nieprzejętych
--      wpisów gościa, powiadomienie(a) trafiają do świeżo założonego konta.
--
-- Świadomie BEZ automatycznego przejęcia. Przejęcie nadal wymaga kliknięcia
-- w link i `auth.uid()` (funkcja `przejmij_wpis_goscia`, migracja `066`) —
-- inaczej ktokolwiek wpisujący cudzy e-mail w formularzu gościa mógłby
-- podpiąć dowolny mecz pod nieswoje konto bez żadnej weryfikacji. To tylko
-- powiadomienie z gotowym linkiem; przejęcie jest osobną, świadomą decyzją
-- właściciela konta.

-- ============================================================================
-- Kolumna z tokenem, żeby powiadomienie mogło zbudować link przejęcia
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS claim_token uuid;

COMMENT ON COLUMN notifications.claim_token IS
  'Dla typu niepotwierdzony_wpis_goscia — token do /gracz/przejmij/[token]';

-- Trigger B (poniżej) przeszukuje po e-mailu wszystkie nieprzejęte wpisy
-- gościa — bez indeksu byłby to skan całej tabeli przy każdej rejestracji.
CREATE INDEX IF NOT EXISTS idx_participants_guest_email_unclaimed
  ON event_participants (lower(guest_email))
  WHERE is_guest = true AND user_id IS NULL AND claim_token IS NOT NULL;

-- ============================================================================
-- A) Nowy wpis gościa -> istniejące konto z tym samym e-mailem
-- ============================================================================

CREATE OR REPLACE FUNCTION powiadom_istniejace_konto_o_wpisie_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tytul   text;
BEGIN
  IF NOT (NEW.is_guest AND NEW.guest_email IS NOT NULL AND NEW.claim_token IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_user_id
    FROM auth.users
   WHERE lower(email) = lower(NEW.guest_email)
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT coalesce(title, sport) INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
  VALUES (
    v_user_id,
    'niepotwierdzony_wpis_goscia',
    'Masz niepotwierdzony zapis na mecz',
    coalesce(v_tytul, 'mecz') || ' — to Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
    NEW.event_id,
    NEW.claim_token
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_istniejace_konto ON event_participants;
CREATE TRIGGER trg_powiadom_istniejace_konto
  AFTER INSERT ON event_participants
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_istniejace_konto_o_wpisie_goscia();

-- ============================================================================
-- B) Nowe konto -> istniejące nieprzejęte wpisy gościa z tym samym e-mailem
-- ============================================================================

CREATE OR REPLACE FUNCTION powiadom_o_niepotwierdzonych_wpisach_goscia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT ep.event_id, ep.claim_token, coalesce(e.title, e.sport) AS tytul
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
     WHERE ep.is_guest = true
       AND ep.user_id IS NULL
       AND ep.claim_token IS NOT NULL
       AND ep.guest_email IS NOT NULL
       AND lower(ep.guest_email) = lower(NEW.email)
  LOOP
    INSERT INTO notifications (user_id, type, title, body, event_id, claim_token)
    VALUES (
      NEW.id,
      'niepotwierdzony_wpis_goscia',
      'Masz niepotwierdzony zapis na mecz',
      coalesce(r.tytul, 'mecz') || ' — to Ty? Potwierdź, żeby dołączyć do składu na swoim koncie.',
      r.event_id,
      r.claim_token
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_niepotwierdzonych_wpisach ON auth.users;
CREATE TRIGGER trg_powiadom_o_niepotwierdzonych_wpisach
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION powiadom_o_niepotwierdzonych_wpisach_goscia();


-- ─────────────────────────────────────────────────────────────────────────
-- 085_zapobiegaj_duplikatom_wpisu_goscia.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 085: Zapobiegaj duplikatom wpisu gościa na ten sam mecz
--
-- Problem znaleziony na produkcji: `dolacz_do_meczu_jako_goscie()` (082/083) w ogóle
-- nie sprawdzała, czy podany e-mail już jest uczestnikiem TEGO meczu. Ten sam e-mail
-- mógł zapisać się jako gość dwa, trzy razy na jeden mecz — zaburzało to licznik
-- miejsc i skład. Przypadek realny: konto już miało przejęty wpis w meczu X,
-- a self-service zapis z tym samym mailem i tak wstawiał kolejne wiersze-gościa.
--
-- Rozwiązanie: dwa sprawdzenia na starcie funkcji, PRZED sync_reserve_claim()
-- (który ma efekty uboczne w kolejce rezerwowych — nie powinien się uruchamiać
-- dla żądania, które i tak zostanie odrzucone albo obsłużone idempotentnie).
--
-- 1. Ten sam e-mail już ma wpis w tym meczu (dowolny — gość albo przejęty):
--    - nieprzejęty gość -> zwróć jego istniejący claim_token zamiast tworzyć
--      duplikat (idempotentnie; pokrywa też podwójny klik "Zapisz się" przy
--      słabym połączeniu, nie tylko świadomy powtórny zapis),
--    - już przejęty (prawdziwe konto) -> odrzuć.
-- 2. E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
--    normalne (zalogowane) dołączenie — niezależnie od tego, czy guest_email
--    było kiedykolwiek ustawione na tamtym wierszu.

CREATE OR REPLACE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Ten sam e-mail już ma wpis w tym meczu?
  SELECT ep.claim_token INTO v_istniejacy_token
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   LIMIT 1;

  IF FOUND THEN
    IF v_istniejacy_token IS NULL THEN
      RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  )
  RETURNING event_participants.claim_token, p_event_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 086_rpc_powiadomienie_braku_nazwy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 086_rpc_powiadomienie_braku_nazwy.sql
--
-- Trigger `powiadom_o_braku_nazwy` (070, poprawiony w 071) jest poprawnie
-- zdefiniowany i włączony na `auth.users`, ale w produkcyjnej bazie NIGDY nie
-- wstawił ani jednego powiadomienia `uzupelnij_profil` — mimo dziesiątek kont
-- z niepełną nazwą założonych po migracji 071 (zweryfikowane zapytaniem po
-- danych produkcyjnych, 2026-08-12). Trigger `on_auth_user_created` na tej
-- samej tabeli, z tym samym zdarzeniem (AFTER INSERT), działa niezawodnie
-- (profile powstają) — przyczyna rozjazdu nie jest znana z analizy statycznej
-- ani z ręcznej symulacji przez SQL Editor (który sam nie odtwarza kontekstu
-- wykonania GoTrue, więc dalsza diagnoza stamtąd nie ma sensu).
--
-- Zamiast dalej diagnozować GoTrue z zewnątrz, przenosimy decyzję na
-- front-end: dokładnie ten sam warunek (`isPelneImie` z profileName.ts),
-- który już steruje banerem na pulpicie, steruje teraz też wywołaniem tej
-- funkcji (`lib/auth.tsx`, `onAuthStateChange`). Jedno źródło prawdy zamiast
-- dwóch niezależnych implementacji tego samego testu.
--
-- Trigger z 070/071 ZOSTAJE — jeśli kiedyś zacznie działać, warunek
-- NOT EXISTS niżej zapobiega duplikatowi niezależnie od tego, kto wstawi
-- pierwszy.
CREATE OR REPLACE FUNCTION zglos_brak_pelnej_nazwy()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id = auth.uid() AND type = 'uzupelnij_profil'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO notifications (user_id, type, title, body)
  VALUES (
    auth.uid(),
    'uzupelnij_profil',
    'Uzupełnij swoje imię',
    'Gracze zobaczą Cię pod nazwą wyprowadzoną z adresu e-mail. Wpisz imię i nazwisko w profilu.'
  );
END;
$$;

REVOKE ALL ON FUNCTION zglos_brak_pelnej_nazwy() FROM public;
GRANT EXECUTE ON FUNCTION zglos_brak_pelnej_nazwy() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 087_juz_dolaczony_flaga.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 087: Dodaj flagę already_joined do dolacz_do_meczu_jako_goscie()
--
-- Problem: `085` poprawnie blokuje duplikat zapisu (rzuca wyjątek, gdy e-mail już ma
-- konto uczestniczące w tym meczu; zwraca istniejący `claim_token` idempotentnie, gdy
-- to nieprzejęty gość), ale frontend nie potrafił odróżnić świeżego zapisu od zwrotu
-- istniejącego tokenu — obie ścieżki zwracały identyczny kształt `{claim_token, event_id}`.
-- Bez tego ekran po zapisie zawsze pokazywał „Zapisano!", nawet gdy to był drugi klik
-- tym samym mailem.
--
-- Rozwiązanie: trzecia kolumna zwracana przez RPC, `already_joined` — true, gdy funkcja
-- zwróciła istniejący token zamiast wstawiać nowy wiersz; false przy świeżym zapisie.
--
-- Zmiana sygnatury zwrotnej (RETURNS TABLE) wymaga DROP + CREATE — CREATE OR REPLACE nie
-- pozwala zmienić typ zwracany istniejącej funkcji. GRANT znika razem z DROP, więc trzeba
-- go nadać ponownie na końcu.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Ten sam e-mail już ma wpis w tym meczu?
  SELECT ep.claim_token INTO v_istniejacy_token
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   LIMIT 1;

  IF FOUND THEN
    IF v_istniejacy_token IS NULL THEN
      RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat, oznaczając already_joined = true.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RAISE EXCEPTION 'Jesteś już zapisany na ten mecz.';
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  )
  RETURNING event_participants.claim_token, p_event_id, false;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 088_konto_i_zamek_na_duplikaty.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 088: Wykrywanie istniejącego konta przy zapisie gościa + twardy zamek na duplikaty
--
-- Problem 1 — „mam konto, a apka i tak namawia na zakładanie konta". Po zapisie bez
-- logowania ekran zawsze proponował „Utwórz profil gracza", bo nic w bazie nie mówiło
-- frontendowi, czy podany e-mail ma już konto. Użytkownik dowiadywał się o tym dopiero
-- po wpisaniu hasła i nieudanej rejestracji (`signUpWithEmail` → identities.length === 0).
-- Rozwiązanie: czwarta kolumna zwracana przez RPC, `has_account`.
--
-- Problem 2 — wybór wariantu ekranu był losowy. `087` szukało istniejącego wpisu przez
-- `SELECT … LIMIT 1` BEZ `ORDER BY`. Dla e-maili, które zdążyły nazbierać duplikaty przed
-- migracją `085`, Postgres zwracał raz wiersz przejęty (→ wyjątek, ekran logowania), raz
-- nieprzejętego gościa (→ `already_joined`, ekran zachęty do konta). Rozwiązanie: sprzątamy
-- duplikaty, zakładamy UNIQUE INDEX (duplikat nie ma jak powstać nawet przy wyścigu), a
-- zapytanie dostaje deterministyczne `ORDER BY`.
--
-- Problem 3 — „już zapisany" wracało jako wyjątek, więc frontend rozpoznawał tę sytuację
-- po TREŚCI komunikatu (`msg.includes('już zapisany na ten mecz')`). Ten sam tekst rzucają
-- `066` i `078` dla ścieżki zalogowanej, a każda zmiana copy w SQL po cichu psuła UI.
-- Rozwiązanie: to nie jest błąd, tylko wynik — RPC zwraca wiersz z `claim_token = NULL`
-- i `already_joined = true`. Wyjątki zostają wyłącznie dla realnych błędów.
--
-- UWAGA: krok 1 KASUJE DANE (nadmiarowe wpisy gościa). Bez tego UNIQUE INDEX z kroku 2
-- się nie założy. W chwili pisania migracji dotyczy to 4 wierszy na 2 meczach.


-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Deduplikacja istniejących wpisów gościa
-- ──────────────────────────────────────────────────────────────────────────────
-- Zostaje jeden wiersz na parę (mecz, e-mail): najpierw ten przejęty przez konto
-- (`claim_token IS NULL` — ma właściciela, jego usunięcie odcięłoby kogoś od meczu),
-- w drugiej kolejności najstarszy, bo to on trzyma pozycję w kolejce rezerwowych.
--
-- Podgląd tego, co zniknie (odpal przed migracją, jeśli chcesz zobaczyć listę):
--   SELECT ep.id, ep.event_id, ep.name, ep.guest_email, ep.created_at
--     FROM event_participants ep
--     JOIN (SELECT event_id, lower(guest_email) AS email FROM event_participants
--            WHERE guest_email IS NOT NULL
--            GROUP BY 1, 2 HAVING count(*) > 1) d
--       ON d.event_id = ep.event_id AND d.email = lower(ep.guest_email);

WITH ranking AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY event_id, lower(guest_email)
      ORDER BY (claim_token IS NULL) DESC, created_at
    ) AS pozycja
  FROM event_participants
  WHERE guest_email IS NOT NULL
)
DELETE FROM event_participants
 WHERE id IN (SELECT id FROM ranking WHERE pozycja > 1);


-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Zamek: jeden e-mail = jeden wpis w meczu
-- ──────────────────────────────────────────────────────────────────────────────
-- Warunek `guest_email IS NOT NULL` zostawia poza indeksem gości dopisanych ręcznie przez
-- organizatora (`addGuest` nie zbiera e-maila) — ci mogą się powtarzać do woli.
CREATE UNIQUE INDEX IF NOT EXISTS idx_participants_unique_guest_email
  ON event_participants (event_id, lower(guest_email))
  WHERE guest_email IS NOT NULL;


-- ──────────────────────────────────────────────────────────────────────────────
-- 3. RPC z kolumną has_account i wynikiem zamiast wyjątku
-- ──────────────────────────────────────────────────────────────────────────────
-- Zmiana kształtu RETURNS TABLE wymaga DROP + CREATE (CREATE OR REPLACE nie pozwala
-- zmienić typu zwracanego). GRANT znika razem z DROP — jest nadany ponownie na końcu.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN, has_account BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
  v_ma_wpis boolean;
  v_ma_konto boolean;
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje?
  IF NOT EXISTS (SELECT 1 FROM events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;

  -- Czy mecz nie został odwołany?
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Czy ten e-mail ma konto w Bojo? Pytanie GLOBALNE (nie „czy jest w tym meczu"), bo
  -- decyduje o tym, czy ekran po zapisie zachęca do REJESTRACJI czy do LOGOWANIA.
  -- auth.users jest niedostępne dla anona — stąd SECURITY DEFINER.
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

  -- Ten sam e-mail już ma wpis w tym meczu? ORDER BY, bo przy danych sprzed kroku 1
  -- wybór wiersza decydował o wariancie ekranu — wiersz przejęty (z właścicielem)
  -- ma pierwszeństwo nad nieprzejętym gościem.
  SELECT ep.claim_token, true
    INTO v_istniejacy_token, v_ma_wpis
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   ORDER BY (ep.claim_token IS NULL) DESC, ep.created_at
   LIMIT 1;

  IF v_ma_wpis THEN
    IF v_istniejacy_token IS NULL THEN
      -- Wpis ma już właściciela (konto przejęło zapis). Nie ma czego przejmować —
      -- frontend rozpozna to po pustym tokenie i pokaże ekran „zaloguj się".
      RETURN QUERY SELECT NULL::uuid, p_event_id, true, v_ma_konto;
      RETURN;
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat, oznaczając already_joined = true.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true, v_ma_konto;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie — też nie ma czego przejmować.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RETURN QUERY SELECT NULL::uuid, p_event_id, true, true;
    RETURN;
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Sprawdź pojemność i zdecyduj czy rezerwa
  v_rezerwa := czy_na_rezerwe(p_event_id, p_bramkarz);

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    false
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 089_delegaci_wydarzenia.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 089: Delegowanie uprawnień organizatora — dla meczów, gdzie organizator nie
-- gra albo dzieli się obowiązkami z kimś zaufanym z ekipy.
--
-- Delegatem może zostać wyłącznie osoba już powiązana z meczem: uczestnik
-- (regularny, z kontem) albo — jeśli mecz jest przypięty do grupy — członek
-- tej grupy. Bez nowego mechanizmu zaproszeń: to zawsze ktoś, kogo organizator
-- już zna z kontekstu meczu/grupy (patrz frontend/src/lib/eventDelegates.ts).
--
-- Trzy niezależne przełączniki, bo różni ludzie dostają różny zakres zaufania:
--   can_edit             — jak organizator: termin, miejsce, ustawienia,
--                          odwołanie meczu. Fizyczne USUNIĘCIE zostaje tylko
--                          dla prawdziwego organizatora/admina.
--   can_manage_squad     — dzieli drużyny, wpisuje wynik, dodaje/usuwa
--                          uczestników, akceptuje prośby o dołączenie,
--                          zaprasza gości, oznacza nieobecność.
--   can_manage_payments  — oznacza kto zapłacił, zmienia zaakceptowane metody
--                          płatności i numer BLIK, wysyła rozliczenie.
--
-- Samą listę delegatów zarządza WYŁĄCZNIE prawdziwy organizator (nie inny
-- delegat, nawet z can_edit) — inaczej powstałby łańcuch przekazywania
-- uprawnień, którego nikt by nie kontrolował.

CREATE TABLE IF NOT EXISTS event_delegates (
  event_id             UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit             BOOLEAN NOT NULL DEFAULT false,
  can_manage_squad     BOOLEAN NOT NULL DEFAULT false,
  can_manage_payments  BOOLEAN NOT NULL DEFAULT false,
  granted_by           UUID NOT NULL REFERENCES auth.users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  -- Wiersz bez żadnego uprawnienia nie ma sensu — UI usuwa go zamiast
  -- zapisywać same "false", ale to zabezpieczenie na wypadek błędu w kliencie.
  CONSTRAINT at_least_one_permission CHECK (can_edit OR can_manage_squad OR can_manage_payments)
);

CREATE INDEX IF NOT EXISTS idx_event_delegates_user ON event_delegates (user_id);

ALTER TABLE event_delegates ENABLE ROW LEVEL SECURITY;

-- Widzi organizator (żeby zarządzać listą), sam zainteresowany (żeby UI
-- wiedziało, co może) i admin.
DROP POLICY IF EXISTS "Organizer, self and admin read delegates" ON event_delegates;
CREATE POLICY "Organizer, self and admin read delegates"
  ON event_delegates FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  );

-- Pisze WYŁĄCZNIE prawdziwy organizator (+ admin, spójnie z resztą admin-owych
-- wyjątków w bazie, np. 040_admin_delete_events.sql).
DROP POLICY IF EXISTS "Only organizer or admin manages delegates" ON event_delegates;
CREATE POLICY "Only organizer or admin manages delegates"
  ON event_delegates FOR ALL
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin)
  );

-- ---- Trzy pomocnicze funkcje do użycia w politykach innych tabel ----
-- Osobne funkcje (nie jedna z parametrem tekstowym) celowo: literówka w
-- nazwie kolumny przy tworzeniu polityki da błąd składni SQL od razu, a nie
-- ciche "zawsze false" przy literówce w stringu. SECURITY DEFINER + search_path,
-- bo wywołanie z wnętrza polityki RLS innej tabeli inaczej mogłoby się nie
-- powieść przez brak uprawnień do odczytu event_delegates/events w kontekście
-- wywołującego (wzorzec jak w istniejących funkcjach SECURITY DEFINER, np.
-- zglos_brak_pelnej_nazwy z migracji 086).

CREATE OR REPLACE FUNCTION can_edit_event(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND can_edit);
$$;

CREATE OR REPLACE FUNCTION can_manage_squad(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND (can_edit OR can_manage_squad));
$$;

CREATE OR REPLACE FUNCTION can_manage_payments(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND organizer_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_delegates WHERE event_id = p_event_id AND user_id = auth.uid() AND (can_edit OR can_manage_payments));
$$;

GRANT EXECUTE ON FUNCTION can_edit_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_squad(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_payments(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 090_rozszerzenie_rls_o_delegatow.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 090: Rozszerzenie istniejących polityk RLS o delegatów z migracji 089.
--
-- `events` UPDATE dostaje can_edit_event() — pełna edycja, włącznie z
-- odwołaniem meczu (UPDATE status='cancelled'). Fizyczne USUNIĘCIE (DELETE)
-- zostaje bez zmian: tylko prawdziwy organizator/admin.
--
-- `event_participants` UPDATE/INSERT/DELETE dostają can_manage_squad() —
-- świadomy kompromis: RLS w Postgresie jest na poziomie wiersza, nie kolumny,
-- więc UPDATE tej tabeli pokrywa zarówno pola składowe (is_reserve, team,
-- pending_approval) jak i has_paid. Rozdzielenie tego czysto między
-- can_manage_squad a can_manage_payments wymagałoby przepisania wszystkich
-- zapisów na dedykowane RPC — nieproporcjonalny refaktor względem ryzyka (to
-- wciąż tylko wiersz uczestnictwa W TYM meczu, nie cała tabela events).
-- Polityka dostaje więc OBA warunki, a precyzyjny podział "kto klika co"
-- pilnuje UI — dokładnie jak dziś robi to MatchResultForm z parametrem
-- organizerId, świadomie nieużywanym poza samym gate'em w komponencie.
--
-- Płatności na `events` (accepted_payment_methods, blik_phone) NIE dostają
-- rozszerzenia ogólnej polityki UPDATE — ta tabela ma ~30 kolumn niezwiązanych
-- z płatnościami, więc delegat od płatności dostałby możliwość zmiany
-- dowolnego pola wydarzenia. Zamiast tego: dedykowana funkcja RPC
-- event_set_payment_settings(), która modyfikuje WYŁĄCZNIE te dwie kolumny.

-- ---- events: pełna edycja + odwołanie ----
DROP POLICY IF EXISTS "Organizer updates own events" ON events;
CREATE POLICY "Organizer or edit-delegate updates events"
  ON events FOR UPDATE
  USING (auth.uid() = organizer_id OR can_edit_event(id))
  WITH CHECK (auth.uid() = organizer_id OR can_edit_event(id));

-- ---- event_participants: skład + płatności (patrz uzasadnienie wyżej) ----
DROP POLICY IF EXISTS "Organizer updates participants" ON event_participants;
DROP POLICY IF EXISTS "Organiser updates participant" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  );

DROP POLICY IF EXISTS "Join or organiser adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Leave or organiser removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

-- ---- team_proposals: zatwierdzanie i moderacja ----
DROP POLICY IF EXISTS "Author or organizer deletes proposal" ON team_proposals;
CREATE POLICY "Author or organizer or delegate deletes proposal" ON team_proposals FOR DELETE
  USING (
    auth.uid() = proposed_by
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  );

DROP POLICY IF EXISTS "Organizer accepts proposal" ON team_proposals;
CREATE POLICY "Organizer or delegate accepts proposal" ON team_proposals FOR UPDATE
  USING     (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  )
  WITH CHECK(
    auth.uid() = (SELECT organizer_id FROM events WHERE id = team_proposals.event_id)
    OR can_manage_squad(team_proposals.event_id)
  );

-- accept_team_proposal() pisze na cudzych wierszach event_participants (stąd
-- SECURITY DEFINER) — sprawdzenie uprawnień jest wewnątrz funkcji, nie w RLS.
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

  IF auth.uid() <> (SELECT organizer_id FROM events WHERE id = v_event_id)
     AND NOT can_manage_squad(v_event_id) THEN
    RAISE EXCEPTION 'Tylko organizator może zatwierdzić składy';
  END IF;

  UPDATE event_participants SET team = NULL WHERE event_id = v_event_id;

  UPDATE event_participants ep
     SET team = pick.team
    FROM team_proposal_picks pick
   WHERE pick.proposal_id = p_proposal_id
     AND pick.participant_id = ep.id;

  UPDATE team_proposals SET status = 'accepted' WHERE id = p_proposal_id;
END;
$$;

-- set_event_teams_published() był SECURITY INVOKER z warunkiem organizer_id
-- wpisanym wprost w WHERE — zamiana na SECURITY DEFINER + can_manage_squad(),
-- bo ogólna polityka UPDATE na `events` (wyżej) celowo NIE obejmuje
-- can_manage_squad (żeby delegat od składów nie mógł zmieniać dowolnych pól
-- wydarzenia) — bez tej zmiany delegat od składów przechodziłby RLS, ale
-- funkcja i tak filtrowałaby jego update do zera wierszy.
CREATE OR REPLACE FUNCTION set_event_teams_published(
  p_event_id  UUID,
  p_published BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT can_manage_squad(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do publikowania składów tego wydarzenia';
  END IF;
  UPDATE events SET teams_published = p_published WHERE id = p_event_id;
END;
$$;

-- ---- match_results, player_goals: wynik meczu ----
DROP POLICY IF EXISTS "Organizer manages match results" ON match_results;
CREATE POLICY "Organizer or delegate manages match results"
  ON match_results FOR ALL
  USING  (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Organizer manages player goals" ON player_goals;
CREATE POLICY "Organizer or delegate manages player goals"
  ON player_goals FOR ALL
  USING  (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- ---- event_player_invites: zapraszanie graczy do meczu ----
DROP POLICY IF EXISTS "Invitee and organizer read invites" ON event_player_invites;
CREATE POLICY "Invitee, organizer, delegate and admin read invites" ON event_player_invites FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

DROP POLICY IF EXISTS "Organizer and participants invite" ON event_player_invites;
CREATE POLICY "Organizer, delegate, admin or participant invite" ON event_player_invites FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_player_invites.event_id
        AND ep.user_id = auth.uid()
        AND ep.pending_approval = false
    )
  );

DROP POLICY IF EXISTS "Organizer or invitee removes invite" ON event_player_invites;
CREATE POLICY "Organizer, delegate, invitee or admin removes invite" ON event_player_invites FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_squad(event_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ---- Płatności: RPC dedykowana, nie rozszerzenie ogólnej polityki `events` ----
CREATE OR REPLACE FUNCTION event_set_payment_settings(
  p_event_id UUID,
  p_accepted_payment_methods TEXT[],
  p_blik_phone TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_manage_payments(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany ustawień płatności tego wydarzenia';
  END IF;
  UPDATE events
    SET accepted_payment_methods = p_accepted_payment_methods,
        blik_phone = p_blik_phone
    WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION event_set_payment_settings(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION set_event_teams_published(UUID, BOOLEAN) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 091_oznaczanie_nieobecnosci.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 091: Oznaczanie nieobecności przez organizatora + zaostrzenie RLS player_reports.
--
-- Infrastruktura istnieje od migracji 011 (tabela player_reports,
-- get_player_stats() z migracji 074 już liczy no_shows z report_type =
-- 'nie_przyszedl'), ale nic w kliencie do niej nie pisało. Polityka INSERT
-- była też za szeroka: DOWOLNY zalogowany użytkownik mógł zgłosić
-- "nie przyszedł" o dowolnym uczestniku dowolnego meczu (auth.uid() IS NOT
-- NULL) — furtka do fałszywych zgłoszeń psujących cudzą odznakę "Niezawodny"
-- na /gracz/[id]. Zawężamy do organizatora i delegatów z uprawnieniem do
-- składu (can_manage_squad, migracja 089/090).

-- Bez unikalności powtórne kliknięcie "nie przyszedł" dokładałoby kolejne
-- wiersze i sztucznie zawyżało licznik no_shows w get_player_stats().
ALTER TABLE player_reports
  ADD CONSTRAINT player_reports_unique_per_event UNIQUE (event_id, reported_participant_id, report_type);

DROP POLICY IF EXISTS "Authenticated can submit reports" ON player_reports;
CREATE POLICY "Organizer or squad delegate submits reports"
  ON player_reports FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- Brakowało w ogóle możliwości cofnięcia błędnego oznaczenia.
DROP POLICY IF EXISTS "Organizer or squad delegate deletes own event reports" ON player_reports;
CREATE POLICY "Organizer or squad delegate deletes own event reports"
  ON player_reports FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );

-- SELECT też ma widzieć delegat, nie tylko organizator — inaczej modal
-- "Kto nie przyszedł" nie potrafiłby pokazać aktualnego stanu.
DROP POLICY IF EXISTS "Organizer reads reports for their events" ON player_reports;
CREATE POLICY "Organizer or squad delegate reads reports"
  ON player_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid())
    OR can_manage_squad(event_id)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 092_uprawnienia_w_grupie.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 092: Uprawnienia w grupie — założyciel dzieli się obowiązkami z ekipą.
--
-- Dziś w grupie są dokładnie dwie władze: założyciel (`groups.created_by`)
-- może wszystko, każdy inny nie może nic poza wyjściem z grupy. Kolumna
-- `role` z migracji `044` obiecuje więcej, ale nie ma polityki UPDATE na
-- `group_members`, więc z przeglądarki NIE DA SIĘ jej zmienić — 'admin'
-- dostaje wyłącznie twórca, z wyzwalacza. Efekt: ekipa, w której organizuje
-- trzech ludzi, ma jedno konto z kluczami i dwa proszące o przysługę.
--
-- Trzy niezależne przełączniki, wzorem `event_delegates` z migracji `089` —
-- różni ludzie dostają różny zakres zaufania:
--   can_manage_members — dopisuje i usuwa graczy z grupy,
--   can_create_events  — zakłada mecze przypięte do grupy,
--   can_moderate_wall  — kasuje cudze wpisy z tablicy grupy (migracja `093`).
--
-- DLACZEGO PRZEŁĄCZNIKI, A NIE ROZSZERZENIE `role` O TRZECIĄ WARTOŚĆ.
-- "Kasuje spam z tablicy" i "wyrzuca ludzi z ekipy" to dwa różne poziomy
-- zaufania; jedna wartość enuma skleja je na stałe. Do tego zmiana wartości
-- CHECK-a ('admin'/'member') wywróciłaby żywy kod: `lib/groups.ts` wstawia
-- role='member' przy dołączeniu, `GroupDetailClient` czyta role==='admin',
-- a `seed_test_groups.sql` wstawia obie.
--
-- `role` ZOSTAJE, ale przestaje być źródłem prawdy: wyzwalacz
-- `ustaw_role_czlonka()` wylicza ją z przełączników przy każdym zapisie
-- i nadpisuje to, co przysłał klient. Dzięki temu stary czytelnik (odznaka
-- "admin" na liście członków) działa dalej, a rozjazd między dwoma zapisami
-- tej samej informacji jest fizycznie niemożliwy.
--
-- ZAŁOŻYCIELA NIE DA SIĘ ZDEGRADOWAĆ. Jego moc nie siedzi w przełącznikach,
-- tylko w `groups.created_by` — funkcje pomocnicze pytają najpierw o to.
-- Wyzwalacz dodatkowo wymusza mu wszystkie trzy `true`, więc nawet UPDATE
-- wycelowany w jego wiersz niczego nie odbiera.
--
-- LISTĄ UPRAWNIEŃ ZARZĄDZA WYŁĄCZNIE ZAŁOŻYCIEL — nie współorganizator
-- z can_manage_members. Ten sam powód co w `089`: inaczej powstaje łańcuch
-- przekazywania uprawnień, którego nikt nie kontroluje. can_manage_members
-- pozwala dodać i usunąć CZŁONKA, nie nadać komuś praw.

-- ---------------------------------------------------------------------------
-- 1. Kolumny + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS can_manage_members BOOLEAN NOT NULL DEFAULT false,
  -- true, NIE false: dziś KAŻDY członek może założyć mecz i przypiąć go do
  -- grupy (WybierzGrupeDialog). Domyślne false odebrałoby to w dniu wgrania
  -- migracji wszystkim poza założycielem — to nie jest ta zmiana. Flaga
  -- istnieje po to, żeby dało się ją ODEBRAĆ.
  ADD COLUMN IF NOT EXISTS can_create_events  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_moderate_wall  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS granted_by         UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill: dotychczasowy 'admin' (tylko twórca, wpisywany triggerem) dostaje komplet.
UPDATE group_members SET can_manage_members = true, can_create_events = true,
                         can_moderate_wall = true
 WHERE role = 'admin';

-- ---------------------------------------------------------------------------
-- 2. `role` jako etykieta wyliczana z przełączników
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ustaw_role_czlonka()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_zalozyciel UUID;
BEGIN
  SELECT created_by INTO v_zalozyciel FROM groups WHERE id = NEW.group_id;

  IF v_zalozyciel IS NOT NULL AND NEW.user_id = v_zalozyciel THEN
    -- Założyciela nie da się zdegradować nawet celowym UPDATE-em.
    NEW.can_manage_members := true;
    NEW.can_create_events  := true;
    NEW.can_moderate_wall  := true;
    NEW.role := 'admin';
  ELSIF NEW.can_manage_members OR NEW.can_moderate_wall THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'member';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ustaw_role_czlonka ON group_members;
CREATE TRIGGER trg_ustaw_role_czlonka
  BEFORE INSERT OR UPDATE ON group_members
  FOR EACH ROW EXECUTE FUNCTION ustaw_role_czlonka();

-- Wyrównanie wierszy, które istniały przed wyzwalaczem.
UPDATE group_members SET role = role;

COMMENT ON COLUMN group_members.role IS
  'Etykieta WYLICZANA z can_* przez trigger ustaw_role_czlonka (092). Zapis wprost jest nadpisywany.';

-- ---------------------------------------------------------------------------
-- 3. Funkcje pomocnicze do polityk RLS INNYCH tabel
-- ---------------------------------------------------------------------------
-- PUŁAPKA, KTÓREJ TE FUNKCJE UNIKAJĄ: polityka na `group_members`, która
-- w warunku robi `EXISTS (SELECT 1 FROM group_members …)`, wywraca się przy
-- pierwszym odczycie — Postgres zgłasza "infinite recursion detected in
-- policy for relation group_members". Nie widać tego przy CREATE POLICY,
-- tylko na produkcji.
--
-- Wyjście: SECURITY DEFINER. Funkcja wykonuje się z prawami właściciela
-- tabeli (roli, która puściła migrację w SQL Editorze), do którego RLS się
-- nie stosuje (nie włączono FORCE ROW LEVEL SECURITY) — wewnętrzny SELECT
-- widzi więc wszystkie wiersze i żadna polityka nie jest wywoływana ponownie.
-- Ten sam manewr, co `can_edit_event()` w `089`.
--
-- Osobne funkcje, nie jedna z parametrem tekstowym — literówka w nazwie
-- kolumny wywali się błędem składni od razu, a nie cichym "zawsze false".
--
-- GRANT dla `anon` I `authenticated` — inaczej niż w `089`, gdzie wystarczył
-- `authenticated`. Strona grupy renderuje się kluczem anonimowym
-- (`app/grupy/[id]/page.tsx`), a wylogowany odwiedzający jest rolą `anon`.
-- Bez grantu dla `anon` polityka SELECT na `group_posts` (`093`) zwróci
-- `permission denied for function`, a nie pustą listę.

CREATE OR REPLACE FUNCTION czy_zalozyciel_grupy(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid());
$$;

CREATE OR REPLACE FUNCTION czy_czlonek_grupy(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION czy_moze_zarzadzac_grupa(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_manage_members);
$$;

CREATE OR REPLACE FUNCTION czy_moze_tworzyc_wydarzenia_w_grupie(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_create_events);
$$;

CREATE OR REPLACE FUNCTION czy_moze_moderowac_tablice(p_group_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM groups g WHERE g.id = p_group_id AND g.created_by = auth.uid())
      OR EXISTS (SELECT 1 FROM group_members m
                  WHERE m.group_id = p_group_id AND m.user_id = auth.uid()
                    AND m.can_moderate_wall);
$$;

GRANT EXECUTE ON FUNCTION czy_zalozyciel_grupy(UUID)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_czlonek_grupy(UUID)                    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_zarzadzac_grupa(UUID)             TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_tworzyc_wydarzenia_w_grupie(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION czy_moze_moderowac_tablice(UUID)           TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Polityki na group_members i groups
-- ---------------------------------------------------------------------------
-- SELECT na obu tabelach zostaje `USING (true)` z `044` — listy członków są
-- pokazywane na publicznej stronie grupy, a `getDelegateCandidates()` (`089`)
-- czyta je dla meczu przypiętego do grupy.

-- Nowość: uprawnienia da się w ogóle zmienić. Tylko założyciel (+ admin
-- platformy, spójnie z `040`/`063`/`089`).
DROP POLICY IF EXISTS "Zalozyciel zmienia uprawnienia czlonka" ON group_members;
CREATE POLICY "Zalozyciel zmienia uprawnienia czlonka" ON group_members FOR UPDATE
  USING (
    czy_zalozyciel_grupy(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    czy_zalozyciel_grupy(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- Wyrzucić może zarządzający; założyciela nie wyrzuci NIKT poza nim samym.
DROP POLICY IF EXISTS "Leave or be removed by creator" ON group_members;
DROP POLICY IF EXISTS "Wyjscie albo usuniecie przez zarzadzajacego" ON group_members;
CREATE POLICY "Wyjscie albo usuniecie przez zarzadzajacego" ON group_members FOR DELETE
  USING (
    auth.uid() = user_id
    OR (
      czy_moze_zarzadzac_grupa(group_id)
      AND user_id IS DISTINCT FROM (SELECT g.created_by FROM groups g WHERE g.id = group_id)
    )
  );

-- Ustawienia grupy edytuje założyciel albo zarządzający. USUNIĘCIE grupy
-- zostaje wyłącznie przy założycielu (polityka "Creator deletes group" bez zmian).
DROP POLICY IF EXISTS "Creator updates group" ON groups;
CREATE POLICY "Zalozyciel lub zarzadzajacy edytuje grupe" ON groups FOR UPDATE
  USING (czy_moze_zarzadzac_grupa(id)) WITH CHECK (czy_moze_zarzadzac_grupa(id));

-- ---------------------------------------------------------------------------
-- 5. Przypięcie meczu do grupy wymaga can_create_events
-- ---------------------------------------------------------------------------
-- WYZWALACZ, NIE POLITYKA RLS — świadomie. `WITH CHECK` przy UPDATE nie widzi
-- wiersza SPRZED zmiany, więc warunek "group_id musi być dozwolony" blokowałby
-- KAŻDĄ edycję meczu przypiętego do grupy, także zmianę godziny przez
-- organizatora, który tymczasem wyszedł z grupy. Wyzwalacz porównuje OLD
-- z NEW i pilnuje wyłącznie MOMENTU przypięcia. Dodatkowo rzuca czytelny
-- wyjątek zamiast po cichu zaktualizować zero wierszy (patrz AGENTS.md).
CREATE OR REPLACE FUNCTION pilnuj_uprawnien_do_grupy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id THEN
    RETURN NEW;  -- grupa się nie zmienia — nie nasza sprawa
  END IF;
  -- auth.uid() IS NULL = wywołanie spoza sesji przeglądarki (seedy z SQL
  -- Editora, admin, przyszłe zadania w tle) — ten sam warunek co w
  -- utworz_termin_serii() (073): „cron nie działa w niczyim imieniu", więc
  -- kontrolę uprawnień egzekwujemy tylko wtedy, gdy REALNIE jest czyjaś
  -- sesja do sprawdzenia. Bez tego seed_test_groups.sql (INSERT jako
  -- właściciel tabeli, auth.uid() = NULL) wywalał się na każdym meczu
  -- przypiętym do grupy — złapane przez ./scripts/baza-testowa.sh.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  -- Termin serii cyklicznej dziedziczy grupę po poprzednim terminie, który był
  -- sprawdzony przy tworzeniu. `utworz_termin_serii()` (073) robi
  -- `INSERT INTO events VALUES (v_wzor.*)`, kopiując group_id, i bywa wołana
  -- w kontekście, w którym auth.uid() nie należy do grupy — bez tego wyjątku
  -- generowanie serii przestałoby działać.
  IF TG_OP = 'INSERT' AND NEW.recurring_event_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NOT czy_moze_tworzyc_wydarzenia_w_grupie(NEW.group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby dodać mecz do tej grupy';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_uprawnien_do_grupy ON events;
CREATE TRIGGER trg_pilnuj_uprawnien_do_grupy
  BEFORE INSERT OR UPDATE OF group_id ON events
  FOR EACH ROW EXECUTE FUNCTION pilnuj_uprawnien_do_grupy();


-- ─────────────────────────────────────────────────────────────────────────
-- 093_tablica_grupy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 093: Tablica grupy — miejsce, gdzie ekipa gada między meczami.
--
-- Dziś jedyne miejsce na słowo pisane w grupie to komentarze POD KONKRETNYM
-- meczem (`event_comments`, migracja `026`). Znikają razem z meczem
-- (ON DELETE CASCADE) i nie mają jak przenieść informacji, która meczu nie
-- dotyczy: "składka na siatki", "Kuba wraca po kontuzji", "w czwartek boisko
-- zajęte". Taka wiadomość albo szła na Messengera, albo nie szła nigdzie.
--
-- Kształt celowo bliźniaczy do `event_comments`/`field_comments`: ta sama
-- długość (1..1000), to samo miękkie kasowanie, to samo `user_name` zapisane
-- na sztywno przy wpisie. Trzecia kopia tego samego kształtu jest tańsza niż
-- wspólna tabela z kolumną "na co wskazuje" — patrz uzasadnienie w `063`.
--
-- PŁASKA LISTA, BEZ ODPOWIEDZI. Wątki wymagają parent_id, rekurencyjnego
-- odczytu, limitu zagnieżdżenia i reguły, co zrobić z odpowiedziami pod
-- skasowanym wpisem. Dwunastoosobowa ekipa tego nie potrzebuje — odpowiedzią
-- jest nowy wpis. Zamiast tego `pinned_at`: jedna rzecz naprawdę ważna
-- zostaje na górze (sortowanie potrzebuje daty, "przypięte 2 dni temu"
-- dostajemy za darmo).
--
-- CZYTAJĄ WYŁĄCZNIE CZŁONKOWIE — inaczej niż `event_comments`, które są
-- czytelne dla świata. Sama grupa (`groups`) zostaje publiczna, bo jej
-- strona jest celem linku zaproszenia i musi wyrenderować nazwę w
-- metadanych. Tablica jest o klasę bardziej prywatna: "składka 20 zł od
-- osoby" i "Kuba znowu nie przyszedł" nie mają być w wynikach Google.
-- Bramkę stawia `czy_czlonek_grupy()` z migracji `092`.
--
-- POWIADOMIENIE TYLKO O PRZYPIĘTYM WPISIE. Powiadamianie o każdym wpisie
-- zamienia dzwonek — dziś noszący prawie wyłącznie rzeczy WYMAGAJĄCE
-- DZIAŁANIA (patrz WYMAGA_AKCJI w lib/notifications.ts) — w kanał czatu.
-- Przypięcie robi świadomie ktoś z can_moderate_wall, więc jest dobrym
-- przybliżeniem "to jest ważne".

CREATE TABLE IF NOT EXISTS group_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name   TEXT NOT NULL,
  -- Ta sama długość co event_comments i field_comments — trzecia kopia tego
  -- samego kształtu jest tańsza niż wspólna tabela z kolumną "na co wskazuje".
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  -- pinned_at, nie is_pinned: sortowanie potrzebuje daty za darmo.
  pinned_at   TIMESTAMPTZ,
  -- Zapora przed powtórnym powiadomieniem przy odpięciu i ponownym przypięciu
  -- tego samego wpisu.
  notified_at TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_posts_group
  ON group_posts (group_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_group_posts_pinned
  ON group_posts (group_id, pinned_at DESC) WHERE deleted_at IS NULL AND pinned_at IS NOT NULL;

ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_posts_select" ON group_posts;
CREATE POLICY "group_posts_select" ON group_posts FOR SELECT
  USING (deleted_at IS NULL AND czy_czlonek_grupy(group_id));

DROP POLICY IF EXISTS "group_posts_insert" ON group_posts;
CREATE POLICY "group_posts_insert" ON group_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_czlonek_grupy(group_id));

-- UPDATE obsługuje DWIE rzeczy: miękkie kasowanie i przypinanie. RLS w
-- Postgresie działa na WIERSZ, nie na kolumnę, więc autor technicznie może
-- też przypiąć własny wpis. Świadomie na to pozwalamy (to jego ekipa i jego
-- wpis), ale POWIADOMIENIE i tak nie pójdzie — wyzwalacz niżej sprawdza
-- osobno, czy przypinający ma can_moderate_wall. Bez tego przypięcie byłoby
-- przyciskiem "wyślij powiadomienie do całej grupy" dla każdego.
DROP POLICY IF EXISTS "group_posts_update" ON group_posts;
CREATE POLICY "group_posts_update" ON group_posts FOR UPDATE
  USING (
    auth.uid() = user_id
    OR czy_moze_moderowac_tablice(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR czy_moze_moderowac_tablice(group_id)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );

-- Brak polityki DELETE: kasowanie jest wyłącznie miękkie, tak jak
-- w `event_comments` i `field_comments`.

-- ---------------------------------------------------------------------------
-- notifications.group_id — powiadomienie, które nie dotyczy meczu
-- ---------------------------------------------------------------------------
-- Dzwonek kieruje dziś wyłącznie na `/wydarzenia/{event_id}` albo na trasę
-- zaszytą w mapie TYP_NA_TRASE (`NotificationBell.tsx`). Powiadomienie
-- o ogłoszeniu w grupie nie ma meczu, więc bez tej kolumny renderowałoby się
-- jako martwy, nieklikalny wiersz.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;

COMMENT ON COLUMN notifications.group_id IS
  'Grupa, której dotyczy powiadomienie. Gdy jest też event_id, pierwszeństwo w kierowaniu ma mecz.';

-- Powiadomienie o nowym meczu w grupie (`072`) też niesie odtąd grupę.
-- `event_id` zostaje, więc kierowanie w dzwonku nie zmienia się ani o piksel.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         'Nowy mecz w grupie',
         coalesce(v_tytul, 'Mecz') || ' — ' || to_char(NEW.event_date, 'DD.MM')
           || ', godz. ' || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Powiadomienie o przypiętym ogłoszeniu
-- ---------------------------------------------------------------------------
-- BEFORE, nie AFTER: `notified_at` ustawiamy prosto na NEW, bez UPDATE-u tego
-- samego wiersza z wnętrza wyzwalacza (który odpaliłby wyzwalacz ponownie).
-- SECURITY DEFINER z tego samego powodu co w `072`: `notifications` nie ma
-- polityki INSERT dla użytkownika, bo powiadomienie zawsze pisze się KOMU
-- INNEMU niż ten, kto wywołał akcję.
CREATE OR REPLACE FUNCTION powiadom_o_ogloszeniu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nazwa TEXT;
BEGIN
  IF NEW.pinned_at IS NULL OR NEW.notified_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.pinned_at IS NOT NULL THEN
    RETURN NEW;  -- było już przypięte, nic nowego się nie stało
  END IF;
  -- Przypiąć własny wpis może autor (RLS jest wierszowe), ale rozesłać
  -- powiadomienie do całej ekipy — tylko ktoś z can_moderate_wall.
  IF NOT czy_moze_moderowac_tablice(NEW.group_id) THEN
    RETURN NEW;
  END IF;

  SELECT g.name INTO v_nazwa FROM groups g WHERE g.id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'ogloszenie_w_grupie',
         'Ogłoszenie w grupie ' || coalesce(v_nazwa, ''),
         left(NEW.body, 140),
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id;

  NEW.notified_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_ogloszeniu_w_grupie ON group_posts;
CREATE TRIGGER trg_powiadom_o_ogloszeniu_w_grupie
  BEFORE INSERT OR UPDATE ON group_posts
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_ogloszeniu_w_grupie();


-- ─────────────────────────────────────────────────────────────────────────
-- 094_zaproszenia_do_grupy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 094: Zaproszenia do grupy — kto kogo przyprowadził i czy w ogóle miał prawo.
--
-- DWIE DZIURY NARAZ.
--
-- 1. KOD DOŁĄCZENIA BYŁ DEKORACJĄ. Polityka INSERT na `group_members`
--    z migracji `044` brzmi `auth.uid() = user_id` — czyli wystarczy ZNAĆ
--    UUID grupy, żeby się do niej dopisać. A UUID nie jest tajny: tabela
--    `groups` jest publicznie czytelna, strona `/grupy/{id}` publiczna,
--    a link do niej ląduje w Messengerze. `join_code` sprawdzał wyłącznie
--    interfejs (`GroupsClient.handleJoin`), więc baza wpuszczała każdego,
--    kto ominął formularz.
--
-- 2. ZAPROSZENIE NIE MIAŁO NADAWCY. Link `/g/{kod}` prowadził na stronę
--    grupy i tyle. Nie dało się powiedzieć "Marek zaprasza Cię do Ekipy
--    Rataje", nie dało się później sprawdzić, kto kogo przyprowadził,
--    i nie dało się kodu unieważnić.
--
-- DLACZEGO BEZ TABELI `group_invites`. Osobna tabela z tokenem, wygaśnięciem
-- i licznikiem użyć daje unieważnianie POJEDYNCZEGO linku — funkcja klubu
-- na dwieście osób, nie ekipy na dwanaście. Kosztuje drugą przestrzeń
-- kodów (którą `/g/[code]` musi odtąd przeszukiwać w dwóch tabelach),
-- odporny na wyścig licznik użyć i sprzątanie wygasłych. To samo (a)+(b)+(c)
-- da się dostać za jedną kolumnę i dwie funkcje:
--   (a) `group_members.invited_by` — zapisywane przez RPC, weryfikowane
--       po stronie bazy (zapraszający musi sam być w grupie),
--   (b) parametr `?od=<uuid>` w linku + publicznie czytelne `profiles`,
--   (c) `odswiez_kod_grupy()` — nowy kod unieważnia wszystkie stare linki.
-- Gdy pojawi się potrzeba wygaszania pojedynczych zaproszeń, `invited_by`
-- zostaje i tak — to jedyna z tych trzech rzeczy, której URL nie zapisze.

ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS join_code_rotated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_group_members_invited_by
  ON group_members (invited_by) WHERE invited_by IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 1. Dołączenie kodem — jedyna droga samodzielnego wejścia do grupy
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, bo po zdjęciu polityki INSERT (niżej) nikt nie ma prawa
-- pisać do `group_members` z przeglądarki. Tożsamość bierzemy z auth.uid(),
-- nie z argumentu — wzorem `dolacz_do_meczu()` z migracji `078` — więc nikt
-- nie dopisze do grupy kogoś innego.
CREATE OR REPLACE FUNCTION dolacz_do_grupy_kodem(p_code TEXT, p_od UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user  uuid := auth.uid();
  v_group uuid;
  v_od    uuid := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Musisz być zalogowany, żeby dołączyć do grupy';
  END IF;

  SELECT g.id INTO v_group
    FROM groups g
   WHERE g.join_code = upper(btrim(coalesce(p_code, '')));

  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Nie ma grupy o tym kodzie';
  END IF;

  -- Zapraszający liczy się TYLKO wtedy, gdy sam należy do grupy. Parametr
  -- `od` przychodzi z adresu URL, więc każdy może wpisać tam co chce —
  -- bez tego sprawdzenia obcy człowiek zapisałby się "z polecenia
  -- założyciela".
  IF p_od IS NOT NULL AND EXISTS (
       SELECT 1 FROM group_members m WHERE m.group_id = v_group AND m.user_id = p_od
     ) THEN
    v_od := p_od;
  END IF;

  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (v_group, v_user, 'member', v_od)
  ON CONFLICT (group_id, user_id) DO NOTHING;   -- „już członek" to wynik, nie błąd

  RETURN v_group;
END;
$$;

GRANT EXECUTE ON FUNCTION dolacz_do_grupy_kodem(TEXT, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Dopisanie kogoś przez zarządzającego (bez kodu)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dodaj_czlonka_do_grupy(p_group_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT czy_moze_zarzadzac_grupa(p_group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby dodawać graczy do tej grupy';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id) THEN
    RAISE EXCEPTION 'Nie ma takiego użytkownika';
  END IF;

  INSERT INTO group_members (group_id, user_id, role, invited_by)
  VALUES (p_group_id, p_user_id, 'member', auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION dodaj_czlonka_do_grupy(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Unieważnienie linku = nowy kod
-- ---------------------------------------------------------------------------
-- Politykę UPDATE na `groups` ma dziś zarządzający (`092`), więc technicznie
-- dałoby się to zrobić zwykłym UPDATE-em z klienta. Osobna funkcja, bo klient
-- nie zna `generate_join_code()`, a losowanie kodu w JavaScripcie oznaczałoby
-- drugą implementację tego samego alfabetu (bez I, L, O, 0, 1 — patrz `041`).
CREATE OR REPLACE FUNCTION odswiez_kod_grupy(p_group_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kod TEXT;
  i INT;
BEGIN
  IF NOT czy_zalozyciel_grupy(p_group_id) THEN
    RAISE EXCEPTION 'Tylko założyciel może odświeżyć kod grupy';
  END IF;

  -- Pętla na wypadek kolizji z UNIQUE — 31^6 kombinacji, ale kolizja jest
  -- możliwa, a wyjątek w tym miejscu wyglądałby dla użytkownika jak awaria.
  FOR i IN 1..10 LOOP
    BEGIN
      v_kod := generate_join_code();
      UPDATE groups
         SET join_code = v_kod, join_code_rotated_at = now()
       WHERE id = p_group_id;
      RETURN v_kod;
    EXCEPTION WHEN unique_violation THEN
      -- kolejna próba
    END;
  END LOOP;

  RAISE EXCEPTION 'Nie udało się wylosować nowego kodu — spróbuj ponownie';
END;
$$;

GRANT EXECUTE ON FUNCTION odswiez_kod_grupy(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Zamknięcie dziury: koniec samodzielnego INSERT-a
-- ---------------------------------------------------------------------------
-- Po zdjęciu tej polityki `group_members` NIE MA ŻADNEJ polityki INSERT, więc
-- z przeglądarki nie da się dopisać nikogo — także siebie. Wszystkie realne
-- drogi wejścia idą przez SECURITY DEFINER i tam sprawdzają warunek:
--   * dolacz_do_grupy_kodem()      — trzeba znać kod,
--   * dodaj_czlonka_do_grupy()     — trzeba mieć can_manage_members,
--   * add_group_creator_as_member() (`044`) — wyzwalacz przy tworzeniu grupy,
--   * seedy z SQL Editora           — działają jako właściciel tabeli, RLS ich
--                                     nie dotyczy.
DROP POLICY IF EXISTS "Users join groups" ON group_members;


-- ─────────────────────────────────────────────────────────────────────────
-- 095_statystyki_grupy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 095: Statystyki grupy — to, po co ekipa w ogóle trzyma się razem.
--
-- `get_player_stats()` (`043`/`045`/`055`/`074`) liczy wszystko, czego gracz
-- dotknął w całej aplikacji. Nie ma wymiaru grupy, więc strona ekipy nie
-- potrafi odpowiedzieć na jedyne pytanie, które w ekipie pada: "kto strzela,
-- kto przychodzi, ile już rozegraliśmy".
--
-- Dwie funkcje, nie jedna: nagłówek grupy potrzebuje pięciu liczb i jest
-- publiczny, tabela graczy potrzebuje wiersza na osobę i jest wyłącznie dla
-- członków. Skleić się tego nie da, bo różnią się i kształtem, i dostępem.
--
-- UCZCIWOŚĆ CO DO DANYCH — trzy rzeczy, których ta funkcja NIE udaje:
--
--  * ZWYCIĘSTWA liczą się wyłącznie tam, gdzie mecz miał podział na drużyny
--    (`event_participants.team`, migracja `011`) ORAZ zapisany wynik
--    (`match_results.winner`, migracja `014`). Domyślny `team_mode` to 'brak',
--    więc dla większości meczów `team` jest NULL i zwycięstwa nie ma jak
--    przypisać. Dlatego funkcja zwraca też `matches_with_teams` — mianownik.
--    Bez niego "0 zwycięstw" znaczy naraz "przegrywa wszystko" i "nigdy nie
--    dzieliliśmy drużyn", a to są dwie różne informacje.
--
--  * NIEZAWODNOŚĆ to nie frekwencja. Śledzenie obecności zniknęło z Bojo
--    w migracji `064`, a `074` wyrzuciło `attended` z get_player_stats
--    właśnie dlatego, że kolumna zwracająca zawsze zero jest obietnicą
--    funkcji, której nie ma. `niezawodnosc_pct` = ile procent meczów,
--    na które gracz był zapisany do składu, rozegrał BEZ zgłoszenia
--    "nie przyszedł" (`player_reports`, migracja `091`).
--
--  * GOLE istnieją tylko tam, gdzie ktoś je wpisał. Brak wpisu to brak
--    danych, nie zero.
--
-- SECURITY DEFINER w tabeli graczy, bo `player_reports` czyta wyłącznie
-- organizator i delegat od składu (`091`). Zwykły członek grupy dostałby
-- z SECURITY INVOKER same zera w kolumnie nieobecności i nie miałby jak się
-- dowiedzieć, że to nie zera tylko brak dostępu. Zamiast tego funkcja
-- sprawdza członkostwo sama i odmawia wprost, pierwszą instrukcją.
--
-- DROP przed CREATE — `CREATE OR REPLACE` nie pozwala zmienić listy kolumn
-- zwracanych przez funkcję tabelaryczną (lekcja z `074`).

-- ---------------------------------------------------------------------------
-- 1. Nagłówek grupy — publiczny, pięć liczb
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_group_stats(UUID);

CREATE FUNCTION get_group_stats(p_group_id UUID)
RETURNS TABLE (
  matches_played    INT,
  matches_upcoming  INT,
  goals_total       INT,
  members_count     INT,
  distinct_players  INT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    -- Rozegrane: mecz się odbył i nie został odwołany. Ten sam warunek co
    -- w get_player_stats (`074`), żeby liczby na stronie gracza i na stronie
    -- grupy nie kłóciły się ze sobą.
    (SELECT count(*)::int
       FROM events e
      WHERE e.group_id = p_group_id
        AND e.status <> 'cancelled'
        AND (e.event_date + e.event_time)::timestamp <= now()),

    (SELECT count(*)::int
       FROM events e
      WHERE e.group_id = p_group_id
        AND e.status <> 'cancelled'
        AND (e.event_date + e.event_time)::timestamp > now()),

    (SELECT coalesce(sum(pg.goals), 0)::int
       FROM player_goals pg
       JOIN events e ON e.id = pg.event_id
      WHERE e.group_id = p_group_id),

    (SELECT count(*)::int
       FROM group_members gm
      WHERE gm.group_id = p_group_id),

    -- Ilu RÓŻNYCH ludzi z kontem grało w meczach tej grupy. To nie to samo co
    -- members_count: w meczu ekipy gra się też z kimś, kto do grupy nie należy.
    (SELECT count(DISTINCT ep.user_id)::int
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
      WHERE e.group_id = p_group_id
        AND ep.is_guest = false
        AND ep.user_id IS NOT NULL
        AND ep.rsvp <> 'maybe')
$$;

GRANT EXECUTE ON FUNCTION get_group_stats(UUID) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Tabela graczy — wyłącznie dla członków
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_group_leaderboard(UUID);

CREATE FUNCTION get_group_leaderboard(p_group_id UUID)
RETURNS TABLE (
  user_id             UUID,
  matches_played      INT,
  goals               INT,
  wins                INT,
  matches_with_teams  INT,
  no_shows            INT,
  niezawodnosc_pct    INT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT czy_czlonek_grupy(p_group_id) THEN
    RAISE EXCEPTION 'Statystyki grupy widzą wyłącznie jej członkowie';
  END IF;

  RETURN QUERY
  WITH sklad AS (
    -- Wiersz na (gracz, mecz): był w składzie rozegranego meczu tej grupy.
    -- Rezerwa, obserwujący i prośba czekająca na akceptację nie grają.
    SELECT ep.id AS participant_id, ep.user_id, ep.event_id, ep.team
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
     WHERE e.group_id          = p_group_id
       AND e.status           <> 'cancelled'
       AND (e.event_date + e.event_time)::timestamp <= now()
       AND ep.is_guest         = false
       AND ep.user_id IS NOT NULL
       AND ep.is_reserve       = false
       AND ep.pending_approval = false
       AND ep.rsvp            <> 'maybe'
  )
  SELECT
    s.user_id,
    count(DISTINCT s.event_id)::int,
    coalesce(sum(pg.goals), 0)::int,
    count(*) FILTER (
      WHERE s.team IS NOT NULL AND mr.winner IS NOT NULL AND mr.winner = s.team
    )::int,
    count(*) FILTER (
      WHERE s.team IS NOT NULL AND mr.winner IS NOT NULL
    )::int,
    count(*) FILTER (WHERE pr.id IS NOT NULL)::int,
    CASE
      WHEN count(DISTINCT s.event_id) = 0 THEN 100
      ELSE round(
        100.0 * (count(DISTINCT s.event_id) - count(*) FILTER (WHERE pr.id IS NOT NULL))
        / count(DISTINCT s.event_id)
      )::int
    END
  FROM sklad s
  LEFT JOIN player_goals pg
         ON pg.participant_id = s.participant_id
  LEFT JOIN match_results mr
         ON mr.event_id = s.event_id
  LEFT JOIN player_reports pr
         ON pr.reported_participant_id = s.participant_id
        AND pr.report_type = 'nie_przyszedl'
  GROUP BY s.user_id
  ORDER BY 3 DESC, 2 DESC;   -- gole, potem rozegrane
END;
$$;

GRANT EXECUTE ON FUNCTION get_group_leaderboard(UUID) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 096_zaproszanie_do_grupy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 096: Czwarty przełącznik uprawnień — kto widzi "Zaproś" i kod dołączenia.
--
-- `can_manage_members` (migracja `092`) miał w opisie "wysyła zaproszenia,
-- zmienia link" razem z dodawaniem/usuwaniem ludzi — dwa różne poziomy
-- zaufania sklejone w jeden. Dziś przycisk "Zaproś" i kod grupy widzi w ogóle
-- KAŻDY członek, bez żadnej bramki (GroupDetailClient renderuje go dla
-- każdego `member`, bez sprawdzania uprawnień). Ta migracja daje founderowi
-- osobną dźwignię: kto może zapraszać nowych, niezależnie od tego, czy może
-- zarządzać składem (dodawać/usuwać ludzi wprost) czy zmieniać link/kod
-- (co zostaje przy `can_manage_members`, patrz `odswiez_kod_grupy` w `094`).
--
-- Świadomie BEZ nowej funkcji SECURITY DEFINER i bez zmiany w RPC
-- `dolacz_do_grupy_kodem` (`094`): ta funkcja nie sprawdza uprawnień osoby,
-- która podała kod — nie sprawdzała ich przed tą migracją i nie zaczyna teraz.
-- `can_invite` jest bramką WIDOCZNOŚCI przycisku w UI (kto w ogóle zobaczy
-- kod, żeby go komuś przekazać), nie nową granicą bezpieczeństwa — każdy, kto
-- zna kod, nadal może dołączyć, dokładnie jak dziś.
ALTER TABLE group_members
  ADD COLUMN IF NOT EXISTS can_invite BOOLEAN NOT NULL DEFAULT true;
  -- true, NIE false: tym samym powodem co can_create_events w 092 — dziś
  -- każdy członek widzi "Zaproś" bez żadnej bramki, default false odebrałby
  -- to wszystkim poza założycielem w dniu wgrania migracji.

UPDATE group_members SET can_invite = true WHERE role = 'admin';

-- Założyciel dostaje can_invite wymuszone na true, tak jak pozostałe trzy
-- przełączniki — trigger z `092` trzeba przedefiniować (ta sama nazwa
-- funkcji, więc wszystkie miejsca, które go wywołują, zostają bez zmian).
CREATE OR REPLACE FUNCTION ustaw_role_czlonka()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_zalozyciel UUID;
BEGIN
  SELECT created_by INTO v_zalozyciel FROM groups WHERE id = NEW.group_id;

  IF v_zalozyciel IS NOT NULL AND NEW.user_id = v_zalozyciel THEN
    -- Założyciela nie da się zdegradować nawet celowym UPDATE-em.
    NEW.can_manage_members := true;
    NEW.can_create_events  := true;
    NEW.can_moderate_wall  := true;
    NEW.can_invite         := true;
    NEW.role := 'admin';
  ELSIF NEW.can_manage_members OR NEW.can_moderate_wall THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'member';
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger sam nie wymaga DROP/CREATE — CREATE OR REPLACE FUNCTION wystarcza,
-- bo trg_ustaw_role_czlonka (092) już wskazuje na tę samą funkcję po nazwie.


-- ─────────────────────────────────────────────────────────────────────────
-- 097_czy_gramy.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 097: „Czy gramy?" — próg minimum graczy i jawna odmowa.
--
-- Dowód z życia: ekipa „Pilka PLEK niedziela" odtworzyła ręcznie w WhatsAppie
-- dokładnie ten model, który Bojo już ma (bramka/gram/pass + rezerwa), a całą
-- resztą wątku jest praca biurowa organizatora: „Czyli brakuje nam 1go?
-- Dobrze liczę?", „10 to minimum żeby zagrać", „Może jeszcze ktoś się
-- decyduje?". Bojo zna skład i zna odpowiedzi — ta migracja daje mu
-- policzenie tego za organizatora i pokazanie werdyktu wprost.
--
-- DLACZEGO OSOBNA TABELA `event_declines`, A NIE NOWA WARTOŚĆ `rsvp`.
-- Kuszące jest dorzucenie `rsvp = 'out'` do istniejącej kolumny, ale `rsvp`
-- jest wplecione w regułę pojemności zduplikowaną w trzech miejscach
-- (joinEvent/addGuest/confirmFromMaybe) oraz w zapytania statystyk
-- (`lib/players.ts` robi `.neq('rsvp', 'maybe')` — nowa wartość wpadłaby tam
-- jako uczestnik). Osobna tabela nie dotyka niczego istniejącego i „odmowa"
-- nie jest tym samym co „nieobecność" (`player_reports`, `091`) — to dwa
-- różne, świadomie nie mylone ze sobą fakty.

-- ---------------------------------------------------------------------------
-- 1. Minimum graczy
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_players INT;
-- NULL = organizator nie ustawił progu — zero zmiany zachowania dla
-- wszystkich istniejących meczów w bazie.
COMMENT ON COLUMN events.min_players IS
  'Ilu graczy musi być, żeby gra się odbyła. NULL = brak progu. Liczone tą
   samą regułą składu co pojemność: pending_approval IS NOT TRUE AND
   is_reserve IS NOT TRUE (ta sama para warunków co w 079).';

-- ---------------------------------------------------------------------------
-- 2. Jawna odmowa — „nie gram"
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_declines (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
COMMENT ON TABLE event_declines IS
  'Jawne "nie gram" członka ekipy przy meczu. NIE jest nieobecnością —
   player_reports (091) karmi statystykę "Niezawodność" wyłącznie ze zgłoszeń
   nie-przyjścia; wcześniejsza, jawna odmowa jest zachowaniem dobrym i nie ma
   z tamtą tabelą żadnego związku.';

ALTER TABLE event_declines ENABLE ROW LEVEL SECURITY;

-- Widoczne dla siebie, organizatora meczu i całej ekipy (gdy mecz jest
-- przypięty do grupy) — panel "kto milczy" pyta o to samo, o co pyta lista
-- uczestników, więc widoczność musi być tej samej szerokości.
CREATE POLICY "event_declines_select" ON event_declines FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM events e
       WHERE e.id = event_id AND e.group_id IS NOT NULL AND czy_czlonek_grupy(e.group_id)
    )
  );

-- Odmawiam wyłącznie za siebie — nikt nie odmawia za kogoś innego.
CREATE POLICY "event_declines_insert" ON event_declines FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "event_declines_delete" ON event_declines FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 3. RPC „zapytaj tych, co milczą"
-- ---------------------------------------------------------------------------
-- `notifications` (025) nie ma polityki INSERT — powiadomienie zawsze pisze
-- się KOMU INNEMU niż ten, kto wywołał akcję, więc SECURITY DEFINER jest
-- jedyną drogą, wzorem 065/070/072/079/086. Działa wyłącznie dla meczów
-- przypiętych do grupy — bez znanego składu ekipy pojęcie "kto milczy" nie
-- ma znaczenia (publiczny mecz nie ma zamkniętej listy oczekiwanych osób).
CREATE OR REPLACE FUNCTION zapytaj_milczacych(p_event_id UUID) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id     UUID;
  v_organizer_id UUID;
  v_tytul        TEXT;
  v_data         DATE;
  v_godz         TIME;
  v_n            INT;
BEGIN
  SELECT group_id, organizer_id, coalesce(title, sport), event_date, event_time
    INTO v_group_id, v_organizer_id, v_tytul, v_data, v_godz
    FROM events WHERE id = p_event_id;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Ta funkcja działa tylko dla meczów przypiętych do ekipy';
  END IF;

  IF auth.uid() IS DISTINCT FROM v_organizer_id
     AND NOT czy_moze_tworzyc_wydarzenia_w_grupie(v_group_id) THEN
    RAISE EXCEPTION 'Nie masz uprawnień, żeby zapytać ekipę o ten mecz';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id, 'pytanie_o_udzial',
         'Grasz w ' || coalesce(v_tytul, 'meczu') || '?',
         to_char(v_data, 'DD.MM') || ', godz. ' || to_char(v_godz, 'HH24:MI')
           || ' — daj znać, czy wchodzisz.',
         p_event_id, v_group_id
    FROM group_members gm
   WHERE gm.group_id = v_group_id
     AND NOT EXISTS (
       SELECT 1 FROM event_participants ep WHERE ep.event_id = p_event_id AND ep.user_id = gm.user_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM event_declines ed WHERE ed.event_id = p_event_id AND ed.user_id = gm.user_id
     )
     -- Zapora przed spamem: kto był zaczepiony w ciągu ostatnich 12 h, czeka.
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id AND n.event_id = p_event_id AND n.type = 'pytanie_o_udzial'
          AND n.created_at > now() - interval '12 hours'
     );

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

GRANT EXECUTE ON FUNCTION zapytaj_milczacych(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Powiadomienie o przekroczeniu progu (w obie strony)
-- ---------------------------------------------------------------------------
-- Wzorem `powiadom_o_zmianie_kompletu` (079): reaguje na ZMIANĘ STANU, nie na
-- każdy zapis — inaczej skład rosnący 1 → 14 dałby kilkanaście powiadomień
-- zamiast jednego, w momencie przekroczenia progu.
CREATE OR REPLACE FUNCTION powiadom_o_progu_gry()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id UUID;
  v_actor    UUID;
  v_min      INT;
  v_status   TEXT;
  v_data     DATE;
  v_tytul    TEXT;
  v_po       INT;
  v_przed    INT;
BEGIN
  IF TG_OP = 'DELETE' THEN v_event_id := OLD.event_id; v_actor := OLD.user_id;
  ELSE v_event_id := NEW.event_id; v_actor := NEW.user_id; END IF;

  SELECT min_players, status, event_date, coalesce(title, sport)
    INTO v_min, v_status, v_data, v_tytul
    FROM events WHERE id = v_event_id;

  IF v_min IS NULL OR v_status <> 'active' OR v_data < current_date THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_po
    FROM event_participants
   WHERE event_id = v_event_id AND pending_approval IS NOT TRUE AND is_reserve IS NOT TRUE;

  v_przed := v_po;
  IF TG_OP <> 'INSERT' AND OLD.pending_approval IS NOT TRUE AND OLD.is_reserve IS NOT TRUE THEN
    v_przed := v_przed + 1;
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.pending_approval IS NOT TRUE AND NEW.is_reserve IS NOT TRUE THEN
    v_przed := v_przed - 1;
  END IF;

  -- ── Poniżej progu → gramy ─────────────────────────────────────────────
  IF v_przed < v_min AND v_po >= v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_potwierdzona', 'Gramy! ✓',
           coalesce(v_tytul, 'Mecz') || ' — skład przekroczył minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
    RETURN NULL;
  END IF;

  -- ── Gramy → poniżej progu ─────────────────────────────────────────────
  IF v_przed >= v_min AND v_po < v_min THEN
    INSERT INTO notifications (user_id, type, title, body, event_id)
    SELECT ep.user_id, 'gra_zagrozona', 'Gra zagrożona',
           coalesce(v_tytul, 'Mecz') || ' — brakuje ' || (v_min - v_po) || ' do minimum (' || v_po || '/' || v_min || ').',
           v_event_id
      FROM event_participants ep
     WHERE ep.event_id = v_event_id AND ep.pending_approval IS NOT TRUE AND ep.is_reserve IS NOT TRUE
       AND ep.user_id IS NOT NULL AND ep.user_id IS DISTINCT FROM v_actor;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_progu_gry ON event_participants;
CREATE TRIGGER trg_powiadom_o_progu_gry
  AFTER INSERT OR UPDATE OR DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_progu_gry();


-- ─────────────────────────────────────────────────────────────────────────
-- 098_admin_bez_rekurencji.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 098: Nadawanie i odbieranie admina przestaje po cichu nie działać.
--
-- OBJAW: przełącznik admin/użytkownik na `/admin/uzytkownicy` „nic nie robi" —
-- przełącza się na ekranie (optymistyczna aktualizacja), a po odświeżeniu
-- wraca do stanu sprzed kliknięcia.
--
-- PRZYCZYNA: polityka z migracji `022` sprawdza uprawnienie zapytaniem
-- o TĘ SAMĄ tabelę, na której siedzi:
--
--     CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
--       USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin));
--
-- Podzapytanie o `profiles` wewnątrz polityki `profiles` samo podlega RLS tej
-- tabeli. Postgres albo zgłasza „infinite recursion detected in policy", albo —
-- gdy rekurencję utnie polityka SELECT — po prostu nie znajduje wiersza
-- i warunek wychodzi FAŁSZ. Wtedy UPDATE aktualizuje ZERO wierszy i zwraca
-- sukces: cisza, żadnego błędu, przycisk „nic nie robi".
--
-- ROZWIĄZANIE: sprawdzenie wyjeżdża do funkcji `SECURITY DEFINER`, która
-- czyta `profiles` z pominięciem RLS. To ten sam wzorzec, którego repo używa
-- już przy powiadomieniach (`065`, `070`) — funkcja działa z uprawnieniami
-- właściciela, więc podzapytanie nie wraca do polityki, z której wyszło.
--
-- `STABLE`, bo wynik nie zmienia się w obrębie jednego zapytania — Postgres
-- może dzięki temu wywołać ją raz na zapytanie, a nie raz na wiersz.

CREATE OR REPLACE FUNCTION public.czy_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
-- Pusty search_path: funkcja SECURITY DEFINER bez tego daje się nabrać na
-- podstawioną tabelę `profiles` w schemacie z wyższym priorytetem.
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.czy_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.czy_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE
  USING      (public.czy_admin())
  WITH CHECK (public.czy_admin());

-- Ta sama rekurencja siedzi w politykach z `005`. `events` i `fields` to inne
-- tabele niż `profiles`, więc pętli tam nie ma — ale podzapytanie i tak
-- odpytuje `profiles` przez RLS, co przy zaostrzeniu polityk na `profiles`
-- wywróciłoby je po cichu w ten sam sposób. Przepinamy na tę samą funkcję,
-- żeby uprawnienie administratora było liczone w JEDNYM miejscu.
DROP POLICY IF EXISTS "Admins can update any event" ON events;
CREATE POLICY "Admins can update any event"
  ON events FOR UPDATE
  USING      (public.czy_admin())
  WITH CHECK (public.czy_admin());


-- ─────────────────────────────────────────────────────────────────────────
-- 099_zgloszenia_bledow.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 099: Zgłoszenia błędów — od użytkownika i automatyczne z awarii.
--
-- WYMAGA MIGRACJI 098 (funkcja `czy_admin()`).
--
-- Po co: dziś awaria u użytkownika nie zostawia po sobie ŻADNEGO śladu.
-- `app/error.tsx` wypisuje błąd do konsoli przeglądarki, której nikt nie ogląda,
-- a zgłoszenie „coś mi wywaliło" przychodzi zrzutem ekranu na WhatsAppie, bez
-- adresu strony, bez wersji, bez treści błędu. Odtworzenie takiego zgłoszenia
-- kosztuje więcej niż sama naprawa.
--
-- JEDNA TABELA NA OBA RODZAJE, i to jest świadome: administrator ma jedno
-- miejsce, w które patrzy. Kolumna `rodzaj` rozróżnia „napisał człowiek" od
-- „złapało się samo", bo obie rzeczy czyta się inaczej.
--
-- GRUPOWANIE PO `odcisk` (fingerprint) zamiast wiersza na każde wystąpienie.
-- Jeden zepsuty widok potrafi wygenerować setki błędów w minutę — bez
-- grupowania panel administratora tonie w kopiach tego samego, a licznik
-- wystąpień, czyli najważniejsza informacja („dotyczy 200 osób czy jednej"),
-- w ogóle nie istnieje. Zgłoszenia od ludzi grupowaniu NIE podlegają: każde
-- jest osobną historią, nawet gdy opis brzmi tak samo.

CREATE TABLE IF NOT EXISTS zgloszenia_bledow (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trzy rodzaje, bo trzy różne rzeczy i trzy różne reakcje:
  --   uzytkownik — „coś nie działa", napisane ręką,
  --   awaria     — złapane samo, z komunikatem i stosem,
  --   obiekt     — błąd w DANYCH boiska („tu już nie ma bramek").
  -- Ten trzeci jest osobny, bo dotyczy danych, których NIE jesteśmy
  -- właścicielem (OSM, licencja ODbL) — poprawka wymaga naszej decyzji,
  -- a nie automatu.
  rodzaj        TEXT NOT NULL CHECK (rodzaj IN ('uzytkownik', 'awaria', 'obiekt')),

  -- Skrót „to jest ten sam błąd": komunikat + pierwsza ramka stosu. NULL dla
  -- zgłoszeń od ludzi (patrz wyżej). Indeks częściowy, bo tylko awarie go mają.
  odcisk        TEXT,

  opis          TEXT NOT NULL,
  slad          TEXT,

  -- Kontekst, bez którego zgłoszenie jest nie do odtworzenia.
  adres         TEXT,
  przegladarka  TEXT,
  wersja        TEXT,

  -- Zgłaszać może też niezalogowany — wtedy NULL. `ON DELETE SET NULL`, żeby
  -- usunięcie konta nie kasowało historii błędów.
  user_id       UUID REFERENCES auth.users ON DELETE SET NULL,

  -- Wypełnione wyłącznie dla `rodzaj = 'obiekt'`. `ON DELETE CASCADE`:
  -- zgłoszenie o nieistniejącym już obiekcie nie ma po co zostawać.
  field_id      UUID REFERENCES fields(id) ON DELETE CASCADE,

  status        TEXT NOT NULL DEFAULT 'nowe'
                CHECK (status IN ('nowe', 'w_toku', 'zamkniete')),
  notatka       TEXT,

  liczba        INT NOT NULL DEFAULT 1,
  pierwszy_raz  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ostatni_raz   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zgloszenia_bledow_odcisk_idx
  ON zgloszenia_bledow (odcisk) WHERE odcisk IS NOT NULL;
CREATE INDEX IF NOT EXISTS zgloszenia_bledow_status_idx
  ON zgloszenia_bledow (status, ostatni_raz DESC);
-- Ile zgłoszeń zebrał jeden obiekt — backlog zakłada, że dopiero kilka
-- niezależnych zgłoszeń uzasadnia zmianę danych bez naszej moderacji.
CREATE INDEX IF NOT EXISTS zgloszenia_bledow_field_idx
  ON zgloszenia_bledow (field_id) WHERE field_id IS NOT NULL;

ALTER TABLE zgloszenia_bledow ENABLE ROW LEVEL SECURITY;

-- CZYTAĆ MOŻE WYŁĄCZNIE ADMIN. To nie jest ostrożność na wyrost: w opisie
-- błędu ląduje adres strony, a ten bywa linkiem do prywatnego meczu. Bez tej
-- polityki dowolny zalogowany user czytałby cudze zgłoszenia razem z nimi.
DROP POLICY IF EXISTS "Admin czyta zgloszenia" ON zgloszenia_bledow;
CREATE POLICY "Admin czyta zgloszenia" ON zgloszenia_bledow
  FOR SELECT USING (public.czy_admin());

DROP POLICY IF EXISTS "Admin zmienia zgloszenia" ON zgloszenia_bledow;
CREATE POLICY "Admin zmienia zgloszenia" ON zgloszenia_bledow
  FOR UPDATE USING (public.czy_admin()) WITH CHECK (public.czy_admin());

-- Zapis idzie WYŁĄCZNIE przez RPC niżej (SECURITY DEFINER), więc bezpośredni
-- INSERT jest zamknięty dla wszystkich. Inaczej dowolny klient mógłby wstawiać
-- wiersze z dowolnym `status`, `liczba` czy cudzym `user_id`.

/**
 * Zapisuje zgłoszenie. Awarie z tym samym odciskiem dokładają się do
 * istniejącego wiersza zamiast tworzyć nowy.
 *
 * SECURITY DEFINER, bo tabela nie ma polityki INSERT — to jedyne wejście.
 * Dzięki temu klient nie decyduje o `status`, `liczba` ani `user_id`:
 * tożsamość bierzemy z `auth.uid()`, nie z tego, co przyszło z przeglądarki.
 */
CREATE OR REPLACE FUNCTION public.zapisz_zgloszenie_bledu(
  p_rodzaj       TEXT,
  p_opis         TEXT,
  p_odcisk       TEXT DEFAULT NULL,
  p_slad         TEXT DEFAULT NULL,
  p_adres        TEXT DEFAULT NULL,
  p_przegladarka TEXT DEFAULT NULL,
  p_wersja       TEXT DEFAULT NULL,
  p_field_id     UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  -- Ucinamy na wejściu, nie przy wyświetlaniu: stos potrafi mieć kilkadziesiąt
  -- kilobajtów, a do rozpoznania błędu wystarczy jego początek. Bez tego jedna
  -- pętla w kodzie klienta potrafi wpompować megabajty do bazy.
  v_opis TEXT := left(coalesce(p_opis, ''), 2000);
  v_slad TEXT := left(p_slad, 4000);
BEGIN
  IF p_rodzaj NOT IN ('uzytkownik', 'awaria', 'obiekt') THEN
    RAISE EXCEPTION 'Nieznany rodzaj zgłoszenia: %', p_rodzaj;
  END IF;

  IF v_opis = '' THEN
    RAISE EXCEPTION 'Puste zgłoszenie';
  END IF;

  -- Awaria z odciskiem: dokładamy do istniejącego wiersza. `ostatni_raz`
  -- i licznik są tym, po czym administrator poznaje, czy błąd żyje.
  IF p_rodzaj = 'awaria' AND p_odcisk IS NOT NULL THEN
    INSERT INTO zgloszenia_bledow
      (rodzaj, odcisk, opis, slad, adres, przegladarka, wersja, user_id)
    VALUES
      ('awaria', p_odcisk, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid())
    ON CONFLICT (odcisk) WHERE odcisk IS NOT NULL DO UPDATE
      SET liczba      = zgloszenia_bledow.liczba + 1,
          ostatni_raz = now(),
          adres       = COALESCE(EXCLUDED.adres, zgloszenia_bledow.adres),
          -- Błąd zamknięty, który wraca, musi znowu trafić na wierzch listy.
          status      = CASE WHEN zgloszenia_bledow.status = 'zamkniete'
                             THEN 'nowe' ELSE zgloszenia_bledow.status END
      RETURNING id INTO v_id;
    RETURN v_id;
  END IF;

  INSERT INTO zgloszenia_bledow
    (rodzaj, opis, slad, adres, przegladarka, wersja, user_id, field_id)
  VALUES
    (p_rodzaj, v_opis, v_slad, p_adres, p_przegladarka, p_wersja, auth.uid(),
     CASE WHEN p_rodzaj = 'obiekt' THEN p_field_id ELSE NULL END)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC;
-- `anon` też: awaria na stronie meczu otwartej z linku, bez logowania, jest
-- dokładnie tym przypadkiem, o którym chcemy wiedzieć.
GRANT EXECUTE ON FUNCTION public.zapisz_zgloszenie_bledu(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID)
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 100_kasowanie_wiadomosci.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 100: Kasowanie wiadomości było niemożliwe — polityka SELECT blokowała UPDATE.
--
-- OBJAW: „Usuń" w rozmowie meczu kończyło się czerwoną chmurką
--   new row violates row-level security policy for table "event_comments"
-- Ta sama pułapka siedziała w tablicy ekipy (`group_posts`, migracja `093`)
-- i w komentarzach do obiektu (`field_comments`).
--
-- DLACZEGO, bo z samych polityk nie widać tego gołym okiem. Kasowanie jest
-- MIĘKKIE: to UPDATE ustawiający `deleted_at`. Polityki na `event_comments`
-- (migracja `026`) wyglądały poprawnie —
--   UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
-- i autor swój własny wiersz przechodzi obiema klauzulami.
--
-- Blokowała trzecia, pozornie niezwiązana:
--   SELECT USING (deleted_at IS NULL)
-- Postgres przy UPDATE sprawdza NOWY wiersz także politykami SELECT — wiersz
-- po zmianie musi zostać widoczny dla tego, kto go zmienił. A miękkie
-- kasowanie robi dokładnie to, czego polityka SELECT zabrania: ustawia
-- `deleted_at`, czyli wypycha wiersz poza własną widoczność. Stąd komunikat
-- o „new row”, mimo że nikt nie wstawiał nowego wiersza.
--
-- Odtworzone na gołym Postgresie ze wszystkimi migracjami
-- (`./scripts/baza-testowa.sh --zostaw`): UPDATE wywala się wyjątkiem,
-- a po samej zmianie polityki SELECT przechodzi. Polityki na produkcji były
-- identyczne z repo — to nie był rozjazd, tylko błąd projektowy w `026`.
--
-- ROZWIĄZANIE: skasowany wiersz widzi ten, kto miał prawo go skasować.
-- Warunek widoczności skasowanych jest LUSTREM polityki UPDATE każdej tabeli
-- — inaczej moderator, który kasuje CUDZY wpis, wpadłby w ten sam wyjątek,
-- co autor przed poprawką.
--
-- Nic nie wycieka do interfejsu: `getComments()`, `getGroupPosts()` i
-- `getFieldComments()` filtrują `deleted_at IS NULL` w samym zapytaniu.
-- Polityka domyka to od strony bazy — skasowanej wiadomości nie odczyta ktoś
-- postronny, nawet omijając aplikację.

-- ---------------------------------------------------------------------------
-- 1. Rozmowa meczu
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "comments_select" ON event_comments;
CREATE POLICY "comments_select" ON event_comments FOR SELECT
  USING (deleted_at IS NULL OR auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Tablica ekipy (093) — kasować może autor, moderator i admin platformy,
--    więc dokładnie ci trzej widzą skasowane.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "group_posts_select" ON group_posts;
CREATE POLICY "group_posts_select" ON group_posts FOR SELECT
  USING (
    czy_czlonek_grupy(group_id)
    AND (
      deleted_at IS NULL
      OR auth.uid() = user_id
      OR czy_moze_moderowac_tablice(group_id)
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Komentarze do obiektu
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "field_comments_select" ON field_comments;
CREATE POLICY "field_comments_select" ON field_comments FOR SELECT
  USING (
    deleted_at IS NULL
    OR auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 101_kto_sie_wypisal.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 101: „kto się wypisał" widoczne dla uczestników meczu, nie tylko organizatora.
--
-- PO CO: wypisanie się jest jedyną zmianą składu, która nie zostawia po sobie
-- żadnego śladu — wiersz w `event_participants` znika i nikt nie odróżnia
-- „odpadł" od „nigdy się nie zapisał". Ktoś patrzy na listę, widzi jedno
-- miejsce wolne i nie wie, czy właśnie się zwolniło.
--
-- Dziennik (`event_activity_log`, migracja `026`) ma już rodzaje
-- `participant_left` i `participant_removed`, ale polityka SELECT z `026`
-- wpuszcza WYŁĄCZNIE organizatora meczu.
--
-- Poszerzamy WĄSKO: dokładamy DRUGĄ politykę (permissive, więc sumuje się
-- z istniejącą) obejmującą tylko te dwa rodzaje wpisów. Reszta dziennika —
-- płatności, zmiany ustawień, publikacja składów — zostaje przy organizatorze.
-- Poszerzenie starej polityki zamiast dołożenia nowej otworzyłoby wszystko.
--
-- Kto zobaczy: każdy, kto widzi sam mecz. Podzapytanie o `events` wykonuje się
-- z uprawnieniami pytającego, więc RLS tabeli `events` załatwia tu całą robotę
-- — mecz prywatny pozostaje prywatny razem ze swoją listą wypisań i nie ma
-- drugiego miejsca, w którym reguła widoczności mogłaby się rozjechać.

DROP POLICY IF EXISTS "activity_log_wypisania" ON event_activity_log;
CREATE POLICY "activity_log_wypisania" ON event_activity_log FOR SELECT
  USING (
    action IN ('participant_left', 'participant_removed')
    AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_id)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 102_push.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 102: Powiadomienia push — subskrypcje przeglądarek i wyzwalacz wysyłki.
--
-- PO CO: dziś każde powiadomienie Bojo (`notifications`, migracje `020`, `072`,
-- `079`, `097`) czeka, aż użytkownik SAM otworzy aplikację. Przy stałej ekipie
-- pętla wygląda tak: organizator zakłada mecz w czwartek, a ludzie dowiadują
-- się o tym w piątek na WhatsAppie — czyli Bojo przegrywa z komunikatorem
-- w jedynej rzeczy, która decyduje o zebraniu składu.
--
-- ARCHITEKTURA, w trzech krokach:
--   1. przeglądarka zapisuje subskrypcję w `push_subscriptions`,
--   2. wyzwalacz na `notifications` woła funkcję brzegową `send-push`
--      (przez `pg_net`, bo Postgres sam nie umie w HTTP),
--   3. `send-push` podpisuje wiadomość kluczem VAPID i wysyła do przeglądarki.
--
-- DLACZEGO WYZWALACZ, A NIE WYSYŁKA Z APLIKACJI: powiadomienia powstają
-- w bazie, z wyzwalaczy (nowy mecz w grupie, komplet składu, prośba
-- o dołączenie). Aplikacja często nawet nie wie, że powstały — zakłada mecz
-- jedna osoba, a powiadomienia dostaje dziesięć. Jedyne miejsce, w którym
-- widać KAŻDE powiadomienie, to sama tabela.

-- ---------------------------------------------------------------------------
-- 1. Subskrypcje
-- ---------------------------------------------------------------------------
-- Jeden wiersz = jedna przeglądarka na jednym urządzeniu. Ta sama osoba ma
-- ich kilka (telefon, laptop, apka z ekranu głównego) i każda ma dostać
-- powiadomienie — dlatego kluczem jest `endpoint`, nie `user_id`.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  -- Do diagnostyki „czemu mi nie przychodzi": bez tego jedyną odpowiedzią jest
  -- zgadywanie, z jakiej przeglądarki pochodzi martwa subskrypcja.
  przegladarka TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ostatni raz, gdy wysyłka się UDAŁA. `send-push` kasuje wiersze odrzucone
  -- przez dostawcę (410 Gone), ale zostawia ślad po tych żywych.
  last_ok_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Każdy zarządza WYŁĄCZNIE swoimi subskrypcjami. Cudzy `endpoint` to adres,
-- pod który da się wysłać powiadomienie w imieniu Bojo — nie może być
-- czytelny dla nikogo poza właścicielem i funkcją brzegową (ta chodzi kluczem
-- serwisowym, więc RLS jej nie dotyczy).
DROP POLICY IF EXISTS "push_wlasne_select" ON push_subscriptions;
CREATE POLICY "push_wlasne_select" ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_insert" ON push_subscriptions;
CREATE POLICY "push_wlasne_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_update" ON push_subscriptions;
CREATE POLICY "push_wlasne_update" ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "push_wlasne_delete" ON push_subscriptions;
CREATE POLICY "push_wlasne_delete" ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 2. Konfiguracja wysyłki
-- ---------------------------------------------------------------------------
-- Adres funkcji brzegowej i sekret, którym wyzwalacz się przy niej
-- przedstawia. RLS WŁĄCZONE I ZERO POLITYK — czyli przez API nie czyta tego
-- nikt, nigdy. Czyta wyłącznie wyzwalacz, bo jest `SECURITY DEFINER`.
--
-- Dlaczego nie `ALTER DATABASE ... SET`: te ustawienia widać w `pg_settings`
-- dla każdego zalogowanego. Dlaczego nie Vault: działa, ale dokłada zależność
-- od rozszerzenia, którego poza tym jednym miejscem tu nie używamy.
CREATE TABLE IF NOT EXISTS konfiguracja_push (
  klucz    TEXT PRIMARY KEY,
  wartosc  TEXT NOT NULL
);

ALTER TABLE konfiguracja_push ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON konfiguracja_push FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Wyzwalacz: nowe powiadomienie → wysyłka
-- ---------------------------------------------------------------------------
-- `pg_net` jest na Supabase, ale NIE ma go na gołym Postgresie, na którym
-- `scripts/baza-testowa.sh` sprawdza, czy migracje aplikują się od zera.
-- Twarde `CREATE EXTENSION` wywracało tam całą migrację — a jej reszta (tabele
-- i polityki) jest przenośna i sprawdzalna. Brak rozszerzenia oznacza tylko
-- tyle, że wyzwalacz nie ma czym zawołać funkcji brzegowej; łapie to jego
-- blok EXCEPTION niżej.
CREATE SCHEMA IF NOT EXISTS extensions;
DO $pgnet$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_net niedostępny (%) — push nie będzie wysyłany z tej bazy', SQLERRM;
END
$pgnet$;

CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';

  -- Brak konfiguracji = push jeszcze niewłączony. Wychodzimy CICHO: wyjątek
  -- tutaj wywróciłby INSERT do `notifications`, czyli zepsułby powiadomienie
  -- w aplikacji przez to, że nie działa jego wysyłka na telefon. Kanał
  -- dodatkowy nie może psuć podstawowego.
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  -- `net.http_post` jest asynchroniczne — wraca od razu, a żądanie leci
  -- w tle. Dzięki temu czas odpowiedzi dostawcy pusha nie wydłuża zapisu
  -- do bazy ani nie blokuje transakcji, w której powstało powiadomienie.
  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'tytul',   NEW.title,
      'tresc',   NEW.body,
      'typ',     NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ta sama zasada co wyżej, ale dla awarii samego `pg_net`.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wyslij_push ON notifications;
CREATE TRIGGER trg_wyslij_push
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION wyslij_push_po_powiadomieniu();

COMMENT ON TABLE push_subscriptions IS
  'Subskrypcje web-push: jeden wiersz = jedna przeglądarka. Wysyłką zajmuje się funkcja brzegowa send-push, wołana wyzwalaczem z notifications (migracja 102).';


-- ─────────────────────────────────────────────────────────────────────────
-- 103_taktyka_druzyny.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 103: Taktyka drużyny — ustawienie na boisku, pozycje graczy i czat drużyny.
--
-- PO CO: po opublikowaniu składów mecz ma dwie drużyny, ale każda z nich jest
-- dziś tylko listą nazwisk. Kto gra w obronie, kto na skrzydle i co robimy
-- z piłką — ustala się przed meczem, ustnie, i połowa składu tego nie słyszy.
-- Osobno: rozmowa meczu (`event_comments`) jest wspólna dla obu drużyn, więc
-- nie da się w niej uzgodnić niczego, czego nie ma przeczytać rywal.
--
-- TRZY TABELE, TRZY RÓŻNE RZECZY:
--   `event_team_setup`    — ustawienie i taktyka drużyny (jeden wiersz na drużynę),
--   `event_team_slots`    — kto stoi na której pozycji,
--   `event_team_messages` — czat WEWNĄTRZ drużyny.
--
-- STATUS: funkcja wchodzi WYŁĄCZNIE dla administratora platformy (bramka
-- w interfejsie). Polityki są jednak pisane docelowo — dla uczestników meczu,
-- nie dla admina — bo polityka „tylko admin", którą potem trzeba przepisać,
-- to drugi zestaw reguł do pomylenia. Zdjęcie bramki w interfejsie ma być
-- jedyną zmianą potrzebną do udostępnienia tego wszystkim.

-- ---------------------------------------------------------------------------
-- 0. Kto należy do drużyny
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER z tego samego powodu co `czy_czlonek_grupy()` w `092`:
-- polityka na `event_team_messages`, która sama odpytuje `event_participants`,
-- działa dobrze, ale robi to przy każdym wierszu. Funkcja `STABLE` liczy się
-- raz na zapytanie.
CREATE OR REPLACE FUNCTION czy_w_druzynie(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = auth.uid()
      AND ep.team = p_team
      AND ep.pending_approval = false
  );
$$;

GRANT EXECUTE ON FUNCTION czy_w_druzynie(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ustawienie i taktyka drużyny
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_setup (
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team       TEXT NOT NULL CHECK (team IN ('A', 'B')),
  -- Schemat jako TEKST (`'1-4-4-2'`), nie zestaw kolumn: pozycje wylicza z niego
  -- `pozycjeZeSchematu()` w `lib/taktyka.ts`, więc dodanie nowego ustawienia
  -- nie wymaga ŻADNEJ zmiany w bazie.
  schemat    TEXT,
  -- Cztery decyzje (krycie, wyjście, pressing, tempo) — jsonb, bo to zbiór
  -- wyborów, który będzie rósł, a każdy jako osobna kolumna oznacza migrację
  -- przy każdym nowym pytaniu.
  taktyka    JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Nazwiska: kto bije rożne, kto karne. Lista wyboru by tego nie objęła.
  notatka    TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (event_id, team)
);

ALTER TABLE event_team_setup ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, kto widzi mecz: ustawienie rywala nie jest tajemnicą (i tak
-- widać je na boisku po pierwszej minucie), a ukrywanie go zmusiłoby do
-- osobnej ścieżki dla „mojej" i „ich" drużyny.
DROP POLICY IF EXISTS "team_setup_select" ON event_team_setup;
CREATE POLICY "team_setup_select" ON event_team_setup FOR SELECT
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id));

-- Zmienia organizator, delegat (`can_edit_event` z `089`) albo ktoś Z TEJ
-- drużyny. Ostatni warunek jest celowy: ustawienie to rzecz drużyny, a nie
-- własność organizatora, który często gra w tej drugiej.
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team))
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team));

-- ---------------------------------------------------------------------------
-- 2. Kto na której pozycji
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_slots (
  event_id       UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team           TEXT NOT NULL CHECK (team IN ('A', 'B')),
  slot           INTEGER NOT NULL CHECK (slot >= 0 AND slot < 20),
  participant_id UUID NOT NULL REFERENCES event_participants(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, team, slot)
);

-- Jedna osoba nie może stać na dwóch pozycjach naraz. Bez tego indeksu
-- przypisanie kogoś na drugą pozycję zostawiało go na obu, a widok pokazywał
-- to samo nazwisko dwa razy — wygląda jak błąd renderowania, a jest błędem
-- danych.
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_slots_uczestnik
  ON event_team_slots (event_id, participant_id);

ALTER TABLE event_team_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_slots_select" ON event_team_slots;
CREATE POLICY "team_slots_select" ON event_team_slots FOR SELECT
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = event_id));

DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team))
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team));

-- ---------------------------------------------------------------------------
-- 3. Czat drużyny
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS event_team_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team       TEXT NOT NULL CHECK (team IN ('A', 'B')),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name  TEXT NOT NULL,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_messages_event
  ON event_team_messages (event_id, team, created_at);

ALTER TABLE event_team_messages ENABLE ROW LEVEL SECURITY;

-- Czyta WYŁĄCZNIE swoja drużyna (plus organizator/delegat) — na tym polega
-- cała różnica wobec rozmowy meczu, która jest wspólna dla obu stron.
--
-- `deleted_at IS NULL OR auth.uid() = user_id` — od razu, nie po fakcie.
-- Migracja `100` naprawiała dokładnie ten błąd w trzech innych tabelach:
-- kasowanie jest miękkie (UPDATE ustawiający `deleted_at`), a Postgres
-- sprawdza nowy wiersz także politykami SELECT, więc warunek „widać tylko
-- nieskasowane" uniemożliwia autorowi skasowanie własnej wiadomości.
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    (czy_w_druzynie(event_id, team) OR can_edit_event(event_id))
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (czy_w_druzynie(event_id, team) OR can_edit_event(event_id))
  );

-- Zmienia (czyli kasuje miękko) wyłącznie autor. Organizator nie kasuje cudzych
-- wiadomości w czacie drużyny — do której zwykle nawet nie należy.
DROP POLICY IF EXISTS "team_messages_update" ON event_team_messages;
CREATE POLICY "team_messages_update" ON event_team_messages FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE event_team_setup IS
  'Ustawienie (schemat tekstem, np. 1-4-4-2) i taktyka drużyny. Pozycje wylicza frontend z samego schematu — patrz lib/taktyka.ts (migracja 103).';
COMMENT ON TABLE event_team_messages IS
  'Czat wewnątrz drużyny, osobny od rozmowy meczu (event_comments), która jest wspólna dla obu drużyn (migracja 103).';


-- ─────────────────────────────────────────────────────────────────────────
-- 104_taktyka_admin.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 104: Administrator platformy może zapisywać taktykę.
--
-- OBJAW: wejście w zakładkę „Taktyka" i kliknięcie czegokolwiek kończyło się
--   new row violates row-level security policy for table "event_team_setup"
--
-- PRZYCZYNA — rozjazd między bramką w interfejsie a polityką w bazie.
-- Zakładka jest dziś widoczna WYŁĄCZNIE dla administratora platformy
-- (`isAdmin` w `EventDetailClient.tsx`), a polityki z migracji `103`
-- wpuszczają do zapisu organizatora, delegata (`can_edit_event`, `089`) albo
-- kogoś z tej drużyny. Administratora nie ma na żadnej z tych list — chyba że
-- przypadkiem organizuje ten mecz. Efekt: jedyna osoba, która może tę zakładkę
-- otworzyć, nie może w niej nic zapisać.
--
-- To ta sama klasa błędu co w `098`: uprawnienie egzekwowane w dwóch miejscach
-- według dwóch różnych reguł. Lekcja na przyszłość jest prosta — jeżeli widok
-- jest za bramką `isAdmin`, to `czy_admin()` musi być w polityce od pierwszego
-- dnia, a nie po pierwszym czerwonym komunikacie.
--
-- Administrator dostaje też ODCZYT czatu drużyny: bez tego zakładka otwiera
-- się z pustą rozmową i wygląda, jakby wiadomości nie było. Świadomie NIE
-- dostaje prawa kasowania cudzych wiadomości — to zostaje przy autorze,
-- dokładnie jak w rozmowie meczu.

-- ---------------------------------------------------------------------------
-- 1. Ustawienie i taktyka
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin())
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin());

-- ---------------------------------------------------------------------------
-- 2. Pozycje na boisku
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin())
  WITH CHECK (can_edit_event(event_id) OR czy_w_druzynie(event_id, team) OR czy_admin());

-- ---------------------------------------------------------------------------
-- 3. Czat drużyny — odczyt i pisanie
-- ---------------------------------------------------------------------------
-- Warunek „widać skasowane własne" zostaje bez zmian: to on sprawia, że autor
-- w ogóle może skasować swoją wiadomość (patrz migracja `100`).
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    (czy_w_druzynie(event_id, team) OR can_edit_event(event_id) OR czy_admin())
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (czy_w_druzynie(event_id, team) OR can_edit_event(event_id) OR czy_admin())
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 105_taktyka_kapitan.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 105: Taktykę ustawia KAPITAN drużyny, nie administrator platformy.
--
-- ZMIANA DECYZJI, nie naprawa błędu. Migracja `104` wpuściła do zapisu
-- administratora, bo zakładka „Taktyka" była wtedy schowana za bramką
-- `isAdmin` — czyli tylko on mógł ją otworzyć. To założenie odpadło:
-- zakładkę widzi teraz każdy, kto GRA w meczu, i widzi wyłącznie SWOJĄ
-- drużynę, a ustawienie zmienia jedna osoba — kapitan.
--
-- DLACZEGO KAPITAN, A NIE „KAŻDY Z DRUŻYNY": ustalenie ustawienia to jedna
-- decyzja, a nie głosowanie. Przy dziesięciu osobach z prawem zapisu skład
-- zmieniałby się pod ręką i nikt nie wiedziałby, która wersja obowiązuje.
--
-- DLACZEGO ADMINISTRATOR TRACI DOSTĘP: nie ma już ekranu, z którego mógłby
-- z tego skorzystać, a uprawnienie bez zastosowania to wyłącznie ryzyko —
-- czat drużyny jest z definicji rozmową, której nie czyta nikt z zewnątrz.
-- Kasowanie własnych wiadomości zostaje bez zmian (autor, migracja `103`).

-- ---------------------------------------------------------------------------
-- 0. Kto jest kapitanem tej drużyny
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER wzorem `czy_w_druzynie()` z `103`: funkcja jest wołana
-- z wnętrza polityki, więc musi widzieć `event_participants` niezależnie od
-- tego, co widzi pytający.
CREATE OR REPLACE FUNCTION czy_kapitan_druzyny(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_participants ep
    WHERE ep.event_id = p_event_id
      AND ep.user_id = auth.uid()
      AND ep.team = p_team
      AND ep.is_captain
      AND ep.pending_approval = false
  );
$$;

GRANT EXECUTE ON FUNCTION czy_kapitan_druzyny(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Ustawienie, taktyka i pozycje — wyłącznie kapitan
-- ---------------------------------------------------------------------------
-- Organizator, który nie gra w tej drużynie, też nie zapisuje. Jeśli chce
-- ustawiać, wskazuje siebie kapitanem w zakładce „Skład" — to jedno kliknięcie
-- i zostawia ślad, kto za to ustawienie odpowiada.
DROP POLICY IF EXISTS "team_setup_write" ON event_team_setup;
CREATE POLICY "team_setup_write" ON event_team_setup FOR ALL
  USING (czy_kapitan_druzyny(event_id, team))
  WITH CHECK (czy_kapitan_druzyny(event_id, team));

DROP POLICY IF EXISTS "team_slots_write" ON event_team_slots;
CREATE POLICY "team_slots_write" ON event_team_slots FOR ALL
  USING (czy_kapitan_druzyny(event_id, team))
  WITH CHECK (czy_kapitan_druzyny(event_id, team));

-- ---------------------------------------------------------------------------
-- 2. Czat drużyny — cała drużyna, bez administratora
-- ---------------------------------------------------------------------------
-- Czat NIE jest ograniczony do kapitana: ustawienie ustala jedna osoba, ale
-- rozmawia cała drużyna. Warunek „widać skasowane własne" zostaje — to on
-- pozwala autorowi skasować swoją wiadomość (patrz migracja `100`).
DROP POLICY IF EXISTS "team_messages_select" ON event_team_messages;
CREATE POLICY "team_messages_select" ON event_team_messages FOR SELECT
  USING (
    czy_w_druzynie(event_id, team)
    AND (deleted_at IS NULL OR auth.uid() = user_id)
  );

DROP POLICY IF EXISTS "team_messages_insert" ON event_team_messages;
CREATE POLICY "team_messages_insert" ON event_team_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_w_druzynie(event_id, team));


-- ─────────────────────────────────────────────────────────────────────────
-- 106_admin_zarzadza_skladem.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 106: Administrator platformy zarządza składem tak, jak pokazuje to interfejs.
--
-- OBJAW: przeciągnięcie gracza między drużynami kończyło się komunikatem
--   „Nie udało się przypisać gracza do drużyny — baza nie zmieniła żadnego
--    wiersza. Najczęstsza przyczyna: brak uprawnień (RLS)…"
-- Ten komunikat zrobił dokładnie to, do czego powstał (`zaktualizujJedenWiersz`
-- w `lib/zapytania.ts`): zamienił ciche „nic się nie stało" w konkretną
-- informację. Diagnoza była w nim od razu.
--
-- PRZYCZYNA — TRZECI RAZ TEN SAM WZORZEC. `isOwner` w `EventDetailClient.tsx`
-- to `user.id === event.organizerId || isAdmin`, więc administrator OGLĄDA
-- pełen panel organizatora: losowanie składu, przypisywanie drużyn, gwiazdkę
-- kapitana. Polityki na `event_participants` (`090`) znają wyłącznie
-- organizatora i delegata. Efekt: kontrolki są, klikają się i nic nie robią.
--
-- Wcześniej to samo naprawiały `098` (przełącznik admin/użytkownik) i `104`
-- (zapis taktyki). Wniosek jest zawsze ten sam i wart zapisania: jeżeli
-- w interfejsie administrator jest traktowany jak organizator, to `czy_admin()`
-- musi siedzieć w polityce — inaczej różnica wychodzi dopiero pod palcem
-- użytkownika, a nie w kodzie.
--
-- ZAKRES: UPDATE (drużyna, kapitan, płatność), INSERT (dopisanie gościa)
-- i DELETE (usunięcie ze składu) — czyli dokładnie te trzy rzeczy, które
-- panel organizatora pokazuje administratorowi.

-- ---------------------------------------------------------------------------
-- UPDATE — przypisanie drużyny, kapitan, oznaczenie płatności
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Organizer or delegate updates participants" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id) OR czy_admin()
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id) OR czy_admin()
  );

-- ---------------------------------------------------------------------------
-- INSERT — dopisanie gościa bez konta
-- ---------------------------------------------------------------------------
-- Warunek „zapisuję siebie" (`auth.uid() = user_id`) zostaje pierwszy: to jest
-- zwykłe dołączenie do meczu i dotyczy wszystkich, nie tylko organizatora.
DROP POLICY IF EXISTS "Join or organiser or delegate adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
    OR czy_admin()
  );

-- ---------------------------------------------------------------------------
-- DELETE — usunięcie ze składu
-- ---------------------------------------------------------------------------
-- Nazwa polityki i jej dotychczasowy warunek pochodzą z `090`; odtwarzamy je
-- w całości, bo `CREATE POLICY` nie umie „dopisać" alternatywy do istniejącej.
DROP POLICY IF EXISTS "Leave or organiser or delegate removes" ON event_participants;
DROP POLICY IF EXISTS "Leave or organiser removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
    OR czy_admin()
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 107_publikacja_taktyki.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 107: Taktykę widać dopiero po opublikowaniu — jak skład.
--
-- PO CO: kapitan układa ustawienie na raty. Przeciąga jednego gracza, zmienia
-- schemat, wraca po godzinie — a drużyna przez cały ten czas widziała każdą
-- pośrednią wersję i nie miała jak odróżnić „tak gramy" od „tak akurat
-- wyszło". Dokładnie ten sam problem rozwiązuje publikacja składu
-- (`events.teams_published`, migracja `031`), więc taktyka dostaje ten sam
-- mechanizm zamiast własnego.
--
-- KAPITAN WIDZI ZAWSZE, także przed publikacją — inaczej nie miałby czego
-- układać. Reszta drużyny widzi dopiero po kliknięciu „Opublikuj taktykę".
--
-- CZAT DRUŻYNY ZOSTAJE NIEZALEŻNY. Rozmowa to nie jest część planu i nie ma
-- powodu, żeby czekała na jego publikację — drużyna gada od razu, także po to,
-- żeby kapitan miał na czym oprzeć decyzję.

ALTER TABLE event_team_setup
  ADD COLUMN IF NOT EXISTS opublikowana BOOLEAN NOT NULL DEFAULT false;

-- Wiersze sprzed tej migracji powstały w świecie, w którym taktykę widzieli
-- wszyscy — zostawiamy to bez zmian, żeby nikomu nie zniknęło coś, co już
-- oglądał.
UPDATE event_team_setup SET opublikowana = true WHERE schemat IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Pomocnicza: czy taktyka tej drużyny jest opublikowana
-- ---------------------------------------------------------------------------
-- Potrzebna przy `event_team_slots`, gdzie flagi nie ma — pozycje i ustawienie
-- to jedna decyzja rozbita na dwie tabele, więc muszą pojawiać się razem.
-- SECURITY DEFINER wzorem `czy_w_druzynie()` (`103`).
CREATE OR REPLACE FUNCTION czy_taktyka_opublikowana(p_event_id UUID, p_team TEXT)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT s.opublikowana FROM event_team_setup s
      WHERE s.event_id = p_event_id AND s.team = p_team),
    false);
$$;

GRANT EXECUTE ON FUNCTION czy_taktyka_opublikowana(UUID, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Odczyt: kapitan zawsze, drużyna po publikacji
-- ---------------------------------------------------------------------------
-- Zawężenie względem `103`, gdzie ustawienie widział każdy, kto widzi mecz.
-- Ustawienie rywala przestaje być publiczne przy okazji — i dobrze: to jest
-- ekran do uzgodnienia gry ze swoimi, nie podgląd cudzej szatni.
DROP POLICY IF EXISTS "team_setup_select" ON event_team_setup;
CREATE POLICY "team_setup_select" ON event_team_setup FOR SELECT
  USING (
    czy_kapitan_druzyny(event_id, team)
    OR (opublikowana AND czy_w_druzynie(event_id, team))
  );

DROP POLICY IF EXISTS "team_slots_select" ON event_team_slots;
CREATE POLICY "team_slots_select" ON event_team_slots FOR SELECT
  USING (
    czy_kapitan_druzyny(event_id, team)
    OR (czy_taktyka_opublikowana(event_id, team) AND czy_w_druzynie(event_id, team))
  );

COMMENT ON COLUMN event_team_setup.opublikowana IS
  'Czy drużyna widzi taktykę. Kapitan widzi zawsze; reszta dopiero po publikacji — wzorem events.teams_published (migracja 107).';


-- ─────────────────────────────────────────────────────────────────────────
-- 108_koniec_admina_w_meczu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 108: Cofnięcie uprawnień administratora do cudzego składu (odwrócenie `106`).
--
-- DLACZEGO ODWRACAMY COŚ SPRZED GODZINY. `106` dokładała `czy_admin()` do
-- polityk na `event_participants`, żeby panel organizatora — pokazywany
-- administratorowi przez `isOwner = organizer || isAdmin` — w ogóle działał.
-- To była naprawa objawu. Przyczyną było samo `|| isAdmin`: administrator
-- dostawał cudzy mecz do zarządzania, choć nigdy nie było takiej potrzeby.
--
-- Łataliśmy to trzy razy z rzędu (`098`, `104`, `106`) i za każdym razem
-- wychodziło kolejne miejsce: przełącznik ról, zapis taktyki, przypisanie
-- drużyny, głos na propozycję składu. Warunek zniknął z interfejsu
-- (`EventDetailClient.tsx`), więc znika też z bazy — uprawnienie, z którego
-- nic nie korzysta, to wyłącznie ryzyko.
--
-- Polityki wracają DOKŁADNIE do brzmienia z `090`. Administrator ma własne
-- ekrany (`/admin/*`); meczem zarządza organizator i jego delegaci.
--
-- ZOSTAJE BEZ ZMIAN: „Admins can update any event" (`005`) — to jest
-- moderacja samego wydarzenia (odwołanie, ukrycie), a nie zarządzanie cudzym
-- składem, i nie ma z nią problemu opisanego wyżej.

DROP POLICY IF EXISTS "Organizer or delegate updates participants" ON event_participants;
CREATE POLICY "Organizer or delegate updates participants"
  ON event_participants FOR UPDATE
  USING (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id) OR can_manage_payments(event_id)
  );

DROP POLICY IF EXISTS "Join or organiser or delegate adds guest" ON event_participants;
CREATE POLICY "Join or organiser or delegate adds guest"
  ON event_participants FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );

DROP POLICY IF EXISTS "Leave or organiser or delegate removes" ON event_participants;
CREATE POLICY "Leave or organiser or delegate removes"
  ON event_participants FOR DELETE
  USING (
    auth.uid() = user_id
    OR auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id)
    OR can_manage_squad(event_id)
  );


-- ─────────────────────────────────────────────────────────────────────────
-- 109_ustawienia_powiadomien.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 109: Ustawienia powiadomień + powiadomienia o wiadomościach.
--
-- DWIE RZECZY, bo bez drugiej pierwsza byłaby pusta w najważniejszym miejscu:
-- „wiadomości w meczu" i „wiadomości w ekipie" NIE MIAŁY dotąd żadnego
-- powiadomienia. Nieprzeczytane liczyła sama przeglądarka (znacznik „ostatnio
-- widziano" w `localStorage`), więc o nowej wiadomości dowiadywał się tylko
-- ten, kto i tak otworzył aplikację. Nie było czego wyłączać ani włączać.
--
-- ---------------------------------------------------------------------------
-- 1. Ustawienia — czego NIE wysyłać
-- ---------------------------------------------------------------------------
-- Lista WYŁĄCZONYCH rodzajów, nie włączonych. Domyślnie pusta, czyli wszystko
-- działa — nowy rodzaj powiadomienia nie wymaga wtedy migracji danych ani
-- „obudzenia" nikomu ustawień. Odwrotnie (lista włączonych) każdy nowy rodzaj
-- byłby domyślnie wyłączony dla wszystkich, którzy kiedykolwiek dotknęli
-- ustawień — czyli funkcja wchodziłaby martwa.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS push_wylaczone TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.push_wylaczone IS
  'Rodzaje powiadomień, których użytkownik NIE chce dostawać na telefon. Pusta tablica = wszystko włączone. Dotyczy wyłącznie pusha — dzwonek w aplikacji pokazuje wszystko (migracja 109).';

-- Wyzwalacz wysyłki respektuje ustawienia. ŚWIADOMIE tylko push: dzwonek
-- w aplikacji zostaje kompletny, bo to jest historia tego, co się wydarzyło,
-- a nie kanał, który przerywa komuś dzień. Wyłączenie rodzaju ma znaczyć
-- „nie zawracaj mi telefonu", a nie „ukryj to przede mną".
CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  -- Ustawienia sprawdzamy PIERWSZE: to najtańszy sposób na niewysłanie.
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = NEW.user_id AND NEW.type = ANY(p.push_wylaczone)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'tytul',   NEW.title,
      'tresc',   NEW.body,
      'typ',     NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Kanał dodatkowy nie może wywrócić zapisu powiadomienia w aplikacji.
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wiadomość w rozmowie meczu → powiadomienie dla składu
-- ---------------------------------------------------------------------------
-- ZAPORA 60 MINUT, per mecz i per odbiorca. Rozmowa przed meczem potrafi mieć
-- trzydzieści wiadomości w kwadrans („będę 10 minut później", „kto bierze
-- piłki"). Bez zapory każdy dostałby trzydzieści powiadomień, czyli wyłączyłby
-- je po drugiej gierce — a razem z nimi te, które naprawdę mają znaczenie.
-- Jedno powiadomienie na godzinę mówi „coś się dzieje, zajrzyj", i to
-- wystarczy: treść i tak jest w aplikacji.
--
-- Ten sam wzorzec co zapora 12 h w `zapytaj_milczacych()` (migracja `097`).
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tytul TEXT;
BEGIN
  SELECT title INTO v_tytul FROM events WHERE id = NEW.event_id;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'wiadomosc_w_meczu',
         'Nowa wiadomość',
         coalesce(v_tytul, 'Mecz') || ' — ' || NEW.user_name || ' napisał w rozmowie.',
         NEW.event_id
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id          -- autor wie, że napisał
     AND ep.pending_approval = false
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ep.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'wiadomosc_w_meczu'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Powiadomienie nie może zablokować wysłania samej wiadomości.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_wiadomosci_w_meczu ON event_comments;
CREATE TRIGGER trg_powiadom_o_wiadomosci_w_meczu
  AFTER INSERT ON event_comments
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_wiadomosci_w_meczu();

-- ---------------------------------------------------------------------------
-- 3. Wpis na tablicy ekipy → powiadomienie dla członków
-- ---------------------------------------------------------------------------
-- Migracja `093` powiadamia WYŁĄCZNIE o wpisie PRZYPIĘTYM przez kogoś
-- z `can_moderate_wall` — czyli o ogłoszeniu. Zwykła rozmowa ekipy nie
-- powiadamiała nikogo. Ta sama zapora 60 minut, ten sam powód.
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa TEXT;
BEGIN
  -- Ogłoszenie (wpis przypięty) ma własne powiadomienie z `093` — nie dublujemy.
  IF NEW.pinned_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_nazwa FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'wiadomosc_w_grupie',
         'Nowa wiadomość w ekipie',
         coalesce(v_nazwa, 'Ekipa') || ' — ' || NEW.user_name || ' napisał na tablicy.',
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id
          AND n.group_id = NEW.group_id
          AND n.type = 'wiadomosc_w_grupie'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_wiadomosci_w_grupie ON group_posts;
CREATE TRIGGER trg_powiadom_o_wiadomosci_w_grupie
  AFTER INSERT ON group_posts
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_wiadomosci_w_grupie();

-- ---------------------------------------------------------------------------
-- 4. Publikacja składów → powiadomienie dla grających
-- ---------------------------------------------------------------------------
-- „Pojawiły się składy" to moment, na który czeka cała drużyna, a dotąd
-- trzeba było zgadywać, kiedy nastąpił.
CREATE OR REPLACE FUNCTION powiadom_o_skladach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Wyłącznie przejście false → true. Bez tego każda edycja meczu
  -- z opublikowanymi składami wysyłałaby powiadomienie od nowa.
  IF NEW.teams_published IS NOT TRUE OR OLD.teams_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'sklady_opublikowane',
         'Są składy',
         coalesce(NEW.title, 'Mecz') || ' — sprawdź, w której drużynie grasz.',
         NEW.id
    FROM event_participants ep
   WHERE ep.event_id = NEW.id
     AND ep.user_id IS NOT NULL
     AND ep.is_reserve = false
     AND ep.pending_approval = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_skladach ON events;
CREATE TRIGGER trg_powiadom_o_skladach
  AFTER UPDATE OF teams_published ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_skladach();


-- ─────────────────────────────────────────────────────────────────────────
-- 110_moment_zapisu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 110: `zapisano_at` — moment, od którego liczy się miejsce w kolejce rezerwowej.
--
-- PO CO. `event_participants.created_at` pełnił dotąd dwie role naraz: znacznik
-- „kiedy powstał wiersz" (do etykiety pod nazwiskiem) i klucz sortowania kolejki
-- rezerwowej (`sync_reserve_claim`, migracja `078`, `ORDER BY created_at`).
--
-- „Obserwuję" nie jest osobną tabelą — to ten sam wiersz w `event_participants`
-- z `rsvp = 'maybe'` (migracja `049`). Kliknięcie „Obserwuj" tworzy wiersz od
-- razu. Późniejsze „Dołącz" nie tworzy nowego wiersza (drugi INSERT tego
-- samego użytkownika na ten sam mecz rzuciłby „Jesteś już zapisany") — tylko
-- aktualizuje `rsvp` z 'maybe' na 'yes' (`confirmFromMaybe`). `created_at`
-- zostaje z chwili kliknięcia „Obserwuj", która mogła paść wiele godzin
-- wcześniej.
--
-- Skutek zgłoszony wprost: gracz zaczął obserwować wczoraj o 00:06, dołączył
-- dziś o 6:35 — a lista uczestników pokazywała „wczoraj 00:06". Gorsze niż
-- sama etykieta: w kolejce rezerwowej taka osoba stała PRZED wszystkimi, którzy
-- zapisali się w międzyczasie, i to ona dostawałaby każde zwolnione miejsce.
--
-- ROZWIĄZANIE. Osobna kolumna o jednej, jasnej roli: moment, od którego liczy
-- się miejsce w kolejce. Nie nadpisujemy `created_at` — ono nadal ma znaczyć
-- „kiedy powstał wiersz" (i to jest właściwa informacja dla „obserwuję od").
-- Trigger ustawia `zapisano_at = now()` WYŁĄCZNIE przy przejściu 'maybe' → 'yes'
-- — zegar serwera, nie telefonu, żeby spieszący się zegar klienta nie dawał
-- przewagi w kolejce.
--
-- Backfill: `zapisano_at = created_at` dla istniejących wierszy. Dla kogoś, kto
-- już dziś ma zafałszowany znacznik (obserwował, potem dołączył), backfill
-- NIE odtwarza prawdziwego momentu potwierdzenia — nigdzie nie był zapisany.
-- Kolejka tych osób zostaje z dotychczasową, niesprawiedliwą datą; naprawia się
-- to wyłącznie dla zapisów od tej migracji w przód.

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS zapisano_at TIMESTAMPTZ;
UPDATE event_participants SET zapisano_at = created_at WHERE zapisano_at IS NULL;
ALTER TABLE event_participants ALTER COLUMN zapisano_at SET DEFAULT now();
ALTER TABLE event_participants ALTER COLUMN zapisano_at SET NOT NULL;

COMMENT ON COLUMN event_participants.zapisano_at IS
  'Moment, od którego liczy się miejsce w kolejce rezerwowej. Przy zwykłym '
  'dołączeniu równy created_at; dla kogoś, kto najpierw obserwował (rsvp maybe) '
  'i potem dołączył, to moment potwierdzenia, nie moment kliknięcia "Obserwuj". '
  'Ustawiany przez trg_moment_zapisu, nigdy z przeglądarki.';

CREATE INDEX IF NOT EXISTS idx_event_participants_kolejka
  ON event_participants (event_id, zapisano_at);

CREATE OR REPLACE FUNCTION ustaw_moment_zapisu()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Obserwujący ma wiersz od chwili kliknięcia "Obserwuj". Prawdziwy zapis to
  -- dopiero przejście na 'yes' — i to on ma ustawiać kolejkę.
  IF OLD.rsvp = 'maybe' AND NEW.rsvp = 'yes' THEN
    NEW.zapisano_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moment_zapisu ON event_participants;
CREATE TRIGGER trg_moment_zapisu
  BEFORE UPDATE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION ustaw_moment_zapisu();

-- ---------------------------------------------------------------------------
-- sync_reserve_claim: kolejka zwolnionych miejsc sortuje się teraz po
-- zapisano_at, nie po created_at. Ciało skopiowane z migracji `078`
-- (ten sam wzorzec, którym `078` zastąpiło `075`/`077`) — zmienione są
-- WYŁĄCZNIE dwie linie ORDER BY, jedna dla kolejki pola, jedna dla bramkarzy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hours smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_hours, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_hours, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_hours IS NULL OR v_started THEN RETURN; END IF;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_hours || ' hours')::interval <= now();

  -- Zawodnicy z pola
  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Bramkarze — osobna kolejka. Pytanie zadajemy PONOWNIE, bo powyższa oferta
  -- mogła właśnie zająć ostatnie miejsce ze wspólnej puli (tryb `077`).
  IF v_gk_enabled AND NOT czy_na_rezerwe(p_event_id, true) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_hours || ' godz. na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 111_tresci_powiadomien.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 111: Treści powiadomień — tytuł mówi CZEGO dotyczy, treść mówi CO się stało.
--
-- PO CO: powiadomienie na telefonie widać przez sekundę, na zablokowanym
-- ekranie, w dwóch linijkach. Musi w tym czasie odpowiedzieć na jedno pytanie:
-- „czy mnie to teraz obchodzi". Dotychczasowe treści odpowiadały wolniej, niż
-- trzeba, a przy wiadomościach nie odpowiadały wcale.
--
-- ZASADA, którą to wprowadza i której warto się trzymać przy nowych typach:
--   TYTUŁ  = konkret, którego dotyczy (nazwa meczu, nazwa ekipy),
--   TREŚĆ  = co się wydarzyło, najlepiej cudzymi słowami (treść wiadomości).
--
-- Odwrotnie było przy wiadomościach: tytuł brzmiał „Nowa wiadomość" (czyli to,
-- co i tak widać po ikonie), a treść mówiła „X napisał w rozmowie" — czyli
-- powtarzała tytuł innymi słowami i NIE pokazywała samej wiadomości. Po takim
-- powiadomieniu trzeba było otworzyć aplikację, żeby dowiedzieć się, czy chodzi
-- o „będę 10 minut później", czy o „nie dam rady, szukajcie kogoś".

-- ---------------------------------------------------------------------------
-- 1. Wiadomość w rozmowie meczu
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tytul TEXT;
  v_tresc TEXT;
BEGIN
  SELECT title INTO v_tytul FROM events WHERE id = NEW.event_id;

  -- 140 znaków: tyle mniej więcej mieści się w powiadomieniu na telefonie,
  -- zanim system i tak utnie resztę. Ucinamy sami, żeby dołożyć wielokropek —
  -- inaczej wiadomość kończy się w pół słowa i wygląda jak błąd.
  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'wiadomosc_w_meczu',
         coalesce(v_tytul, 'Rozmowa meczu'),
         v_tresc,
         NEW.event_id
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id
     AND ep.pending_approval = false
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ep.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'wiadomosc_w_meczu'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wiadomość na tablicy ekipy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa TEXT;
  v_tresc TEXT;
BEGIN
  IF NEW.pinned_at IS NOT NULL THEN
    RETURN NEW;   -- ogłoszenie ma własne powiadomienie (093)
  END IF;

  SELECT name INTO v_nazwa FROM groups WHERE id = NEW.group_id;

  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'wiadomosc_w_grupie',
         coalesce(v_nazwa, 'Twoja ekipa'),
         v_tresc,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id
          AND n.group_id = NEW.group_id
          AND n.type = 'wiadomosc_w_grupie'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Publikacja składów
-- ---------------------------------------------------------------------------
-- „Są składy" jako tytuł mówiło CO, ale nie CZEGO dotyczy — przy dwóch meczach
-- w tygodniu trzeba było wejść, żeby sprawdzić który. Teraz tytuł niesie nazwę
-- meczu, a treść dokłada termin, bo to jest następne pytanie po „który mecz".
CREATE OR REPLACE FUNCTION powiadom_o_skladach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.teams_published IS NOT TRUE OR OLD.teams_published IS TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'sklady_opublikowane',
         coalesce(NEW.title, 'Mecz'),
         'Są składy — sprawdź, w której drużynie grasz. '
           || to_char(NEW.event_date, 'DD.MM') || ', godz. '
           || to_char(NEW.event_time, 'HH24:MI') || '.',
         NEW.id
    FROM event_participants ep
   WHERE ep.event_id = NEW.id
     AND ep.user_id IS NOT NULL
     AND ep.is_reserve = false
     AND ep.pending_approval = false;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Nowy mecz w ekipie
-- ---------------------------------------------------------------------------
-- Tytuł „Nowy mecz w grupie" nie mówił W KTÓREJ, a przy kilku ekipach to jest
-- pierwsze pytanie. Treść dostaje miejsce — bo „czwartek 20:00" bez boiska nie
-- wystarcza do decyzji, gdy ekipa gra w dwóch miejscach.
CREATE OR REPLACE FUNCTION powiadom_o_nowym_meczu_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa_grupy TEXT;
BEGIN
  IF NEW.group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_nazwa_grupy FROM groups WHERE id = NEW.group_id;

  INSERT INTO notifications (user_id, type, title, body, event_id, group_id)
  SELECT gm.user_id,
         'nowy_mecz_w_grupie',
         coalesce(v_nazwa_grupy, 'Twoja ekipa') || ' — nowy mecz',
         coalesce(NEW.title, 'Mecz') || ', '
           || to_char(NEW.event_date, 'DD.MM') || ' godz. '
           || to_char(NEW.event_time, 'HH24:MI')
           || coalesce(' · ' || NEW.field_name, '') || '.',
         NEW.id,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.organizer_id;   -- zakładający wie, że założył

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_powiadom_o_nowym_meczu_w_grupie ON events;
CREATE TRIGGER trg_powiadom_o_nowym_meczu_w_grupie
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_nowym_meczu_w_grupie();


-- ─────────────────────────────────────────────────────────────────────────
-- 112_seo_tier_i_lokalizacja.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 112_seo_tier_i_lokalizacja.sql
--
-- Fundament pod tierowanie indeksacji katalogu boisk w wyszukiwarkach
-- (SEO/GEO). Audyt produkcyjnej bazy (2026-08-20) pokazał, że:
--   - `fields` ma dziś 32 684 wiersze (import całej Polski z OSM już się
--     wydarzył — scraper/import_osm_pbf.py), nie hipotetyczne "35k do
--     zaimportowania". Ryzyko cienkiej treści jest aktualne, nie prewencyjne.
--   - tylko 40 obiektów w całej historii miało kiedykolwiek mecz (events).
--     Kryterium "ma mecz" samo w sobie dałoby Tier 1 rzędu dziesiątek, nie
--     tysięcy rekordów — to sygnał PROMOCJI, nie doboru początkowego.
--   - nie ma kolumn city/voivodeship. Jest tylko district (12% wypełnione),
--     postcode (26%), osm_tags->>'addr:city' (1%). Jedyne pola w 100%:
--     lat/lng i address (wolny tekst, parsowany dziś niespójnie w kilku
--     miejscach frontendu — miejscowoscZAdresu() w boisko/[id]/page.tsx
--     i komentarz w lib/structuredData.ts#eventJsonLd).
--   - baza nie ma PostGIS — dopasowanie punkt→miasto/województwo robi
--     scraper/backfill_lokalizacja.py (Python, Shapely/osmium, reużywa
--     nearest_place() z import_osm_pbf.py), nie SQL w tej migracji.
--
-- Kolejność uruchomienia: ta migracja → scraper/backfill_lokalizacja.py
-- (ręcznie, per województwo) → triggery niżej same przeliczają seo_tier,
-- bo backfill zapisuje city/voivodeship przez UPDATE OF city, co je budzi.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS voivodeship TEXT,
  ADD COLUMN IF NOT EXISTS seo_tier SMALLINT NOT NULL DEFAULT 3;

ALTER TABLE fields
  DROP CONSTRAINT IF EXISTS fields_seo_tier_check;
ALTER TABLE fields
  ADD CONSTRAINT fields_seo_tier_check CHECK (seo_tier IN (1, 2, 3));

COMMENT ON COLUMN fields.city IS
  'Miejscowość, normalizowana w scraper/backfill_lokalizacja.py (nearest_place() z importu OSM). NIE parsować z address w nowym kodzie.';
COMMENT ON COLUMN fields.voivodeship IS
  'Slug województwa jak w scraper/import_osm_pbf.py WOJEWODZTWA (np. "wielkopolskie").';
COMMENT ON COLUMN fields.seo_tier IS
  '1 = pełna indeksacja (index,follow), 2 = index,follow warunkowo (po Fazie 1 — programmatic content), 3 = noindex,follow. Liczone przez oblicz_seo_tier(), patrz triggery niżej — nie ustawiać ręcznie poza backfillem.';

CREATE INDEX IF NOT EXISTS idx_fields_city ON fields (city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_voivodeship ON fields (voivodeship) WHERE voivodeship IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fields_seo_tier ON fields (seo_tier);

-- ---------------------------------------------------------------------------
-- Miasta priorytetowe — "duże i średnie miasto" bez PostGIS i bez tabeli
-- populacji w bazie. Analogiczne do dzisiejszego hardkodowanego MIASTA
-- w frontend/src/content/graj.ts (dziś tylko Poznań), tylko szersze: ~100
-- polskich miast powyżej ok. 15 tys. mieszkańców (dane GUS, publiczne).
-- Rozszerzenie hubów /[sport]/[miasto] poza Poznań to osobna decyzja
-- (Faza 2, BACKLOG.md) — ta tabela służy WYŁĄCZNIE do tieringu indeksacji.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS miasta_priorytetowe (
  nazwa TEXT PRIMARY KEY
);

ALTER TABLE miasta_priorytetowe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "miasta_priorytetowe_select" ON miasta_priorytetowe;
CREATE POLICY "miasta_priorytetowe_select" ON miasta_priorytetowe FOR SELECT
  USING (true);

INSERT INTO miasta_priorytetowe (nazwa) VALUES
  ('Warszawa'), ('Kraków'), ('Łódź'), ('Wrocław'), ('Poznań'),
  ('Gdańsk'), ('Szczecin'), ('Bydgoszcz'), ('Lublin'), ('Białystok'),
  ('Katowice'), ('Gdynia'), ('Częstochowa'), ('Radom'), ('Sosnowiec'),
  ('Toruń'), ('Kielce'), ('Rzeszów'), ('Gliwice'), ('Zabrze'),
  ('Olsztyn'), ('Bielsko-Biała'), ('Bytom'), ('Zielona Góra'), ('Rybnik'),
  ('Ruda Śląska'), ('Opole'), ('Tychy'), ('Gorzów Wielkopolski'), ('Dąbrowa Górnicza'),
  ('Elbląg'), ('Płock'), ('Wałbrzych'), ('Włocławek'), ('Tarnów'),
  ('Chorzów'), ('Koszalin'), ('Kalisz'), ('Legnica'), ('Grudziądz'),
  ('Słupsk'), ('Jaworzno'), ('Jastrzębie-Zdrój'), ('Nowy Sącz'), ('Jelenia Góra'),
  ('Siedlce'), ('Mysłowice'), ('Konin'), ('Piotrków Trybunalski'), ('Inowrocław'),
  ('Lubin'), ('Ostrowiec Świętokrzyski'), ('Suwałki'), ('Stargard'), ('Gniezno'),
  ('Ostrów Wielkopolski'), ('Siemianowice Śląskie'), ('Głogów'), ('Pabianice'), ('Chełm'),
  ('Zamość'), ('Tomaszów Mazowiecki'), ('Łomża'), ('Tarnowskie Góry'), ('Przemyśl'),
  ('Stalowa Wola'), ('Kędzierzyn-Koźle'), ('Piła'), ('Mielec'), ('Świdnica'),
  ('Ostrołęka'), ('Będzin'), ('Racibórz'), ('Legionowo'), ('Leszno'),
  ('Zgierz'), ('Piekary Śląskie'), ('Skierniewice'), ('Świnoujście'), ('Krosno'),
  ('Ełk'), ('Starachowice'), ('Biała Podlaska'), ('Wejherowo'), ('Puławy'),
  ('Bielawa'), ('Żory'), ('Sopot'), ('Iława'), ('Rumia'),
  ('Nysa'), ('Wodzisław Śląski'), ('Otwock'), ('Kutno'), ('Wołomin'),
  ('Sieradz'), ('Piaseczno'), ('Ciechanów'), ('Skarżysko-Kamienna'), ('Świętochłowice'),
  ('Malbork'), ('Jarosław')
ON CONFLICT (nazwa) DO NOTHING;

-- ---------------------------------------------------------------------------
-- oblicz_seo_tier — czysta funkcja, bez side-effectów. Bierze dane obiektu
-- jako parametry (nie SELECT po id z fields) właśnie po to, żeby działała
-- poprawnie w triggerze BEFORE INSERT — w tym momencie NEW.* jeszcze nie
-- jest widoczne przez SELECT z tej samej tabeli.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION oblicz_seo_tier(
  p_id uuid, p_city text, p_is_verified boolean, p_sport text[], p_name text
) RETURNS smallint
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN (p_city IS NOT NULL AND p_city IN (SELECT nazwa FROM miasta_priorytetowe))
      OR p_is_verified IS TRUE
      OR EXISTS (SELECT 1 FROM events e WHERE e.field_id = p_id)
      OR EXISTS (SELECT 1 FROM field_comments fc WHERE fc.field_id = p_id AND fc.deleted_at IS NULL)
    THEN 1
    WHEN p_city IS NOT NULL
      AND p_sport IS NOT NULL AND array_length(p_sport, 1) > 0
      AND coalesce(length(trim(p_name)), 0) > 0
    THEN 2
    ELSE 3
  END
$$;

COMMENT ON FUNCTION oblicz_seo_tier IS
  'Tier 1: miasto priorytetowe, LUB is_verified_venue, LUB ma mecz, LUB ma komentarz. Tier 2: ma miejscowość + sport + nazwę. Tier 3: reszta. Historia meczów/komentarzy jest sygnałem promocji (patrz triggery events/field_comments), nie głównym kryterium doboru — przy 40 obiektach z meczem w całej bazie samo to kryterium dałoby Tier 1 rzędu dziesiątek, nie tysięcy.';

CREATE OR REPLACE FUNCTION trg_fields_przelicz_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.seo_tier := oblicz_seo_tier(NEW.id, NEW.city, NEW.is_verified_venue, NEW.sport, NEW.name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fields_przelicz_tier ON fields;
CREATE TRIGGER fields_przelicz_tier
  BEFORE INSERT OR UPDATE OF city, is_verified_venue, sport, name ON fields
  FOR EACH ROW EXECUTE FUNCTION trg_fields_przelicz_tier();

-- Awans do Tier 1, gdy ktoś zorganizuje mecz na obiekcie — jednokierunkowy
-- (mecz odwołany/usunięty nie degraduje z powrotem, tak jak inne "raz
-- zdobyte" stany w tej aplikacji, np. is_verified_venue).
CREATE OR REPLACE FUNCTION trg_events_promuj_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.field_id IS NOT NULL THEN
    UPDATE fields SET seo_tier = 1 WHERE id = NEW.field_id AND seo_tier <> 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_promuj_tier ON events;
CREATE TRIGGER events_promuj_tier
  AFTER INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION trg_events_promuj_tier();

CREATE OR REPLACE FUNCTION trg_field_comments_promuj_tier() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE fields SET seo_tier = 1 WHERE id = NEW.field_id AND seo_tier <> 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS field_comments_promuj_tier ON field_comments;
CREATE TRIGGER field_comments_promuj_tier
  AFTER INSERT ON field_comments
  FOR EACH ROW EXECUTE FUNCTION trg_field_comments_promuj_tier();


-- ─────────────────────────────────────────────────────────────────────────
-- 113_powiadomienie_o_usunieciu_uczestnika.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 113: Powiadomienie o usunięciu POTWIERDZONEGO gracza ze składu.
--
-- `076_pelniejsze_tresci_powiadomien.sql#powiadom_o_odrzuceniu_prosby`
-- powiadamia wyłącznie o odrzuceniu PROŚBY (`OLD.pending_approval IS TRUE`).
-- Wyrzucenie gracza, który był już w składzie — bo `removeParticipant()`
-- (`lib/events.ts`) robi identyczny DELETE w obu przypadkach — nie generowało
-- żadnego powiadomienia. Gracz dowiadywał się dopiero wchodząc na stronę
-- meczu, albo na boisku. To ta sama klasa błędu, którą `070` naprawiła dla
-- odwołania meczu, jeden poziom niżej.
--
-- Trigger jest BEFORE DELETE, tak jak `076`, żeby oba triggery na tym samym
-- zdarzeniu działały w tym samym momencie cyklu życia wiersza — dzielą
-- wzajemnie wykluczające się warunki (pending vs nie-pending), nie kolidują.
--
-- Rozróżnienie "sam się wypisał" vs "organizator/delegat usunął": jedyna
-- ścieżka DELETE to `removeParticipant`, a polityka RLS (`108`) pozwala na nią
-- właścicielowi wiersza, organizatorowi albo delegatowi z `can_manage_squad` —
-- `auth.uid() IS NOT DISTINCT FROM OLD.user_id` wystarczy, żeby odróżnić
-- samowypisanie (nie ma o czym powiadamiać) od usunięcia przez kogoś innego.
--
-- Gdy usuwany jest CAŁY mecz, `event_participants` kaskaduje (`ON DELETE
-- CASCADE`) i `SELECT ... FROM events WHERE id = OLD.event_id` nie zwróci
-- nic — trigger wtedy milczy, bo o usunięciu meczu mówi osobne powiadomienie
-- (migracja `116`). Bez tego warunku każdy uczestnik usuniętego meczu
-- dostałby mylące "usunięto Cię ze składu" zamiast "mecz został usunięty".

CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_uczestnika()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul  TEXT;
  v_data   DATE;
  v_godz   TIME;
  v_status TEXT;
BEGIN
  IF OLD.user_id IS NULL
     OR OLD.pending_approval IS TRUE               -- pokrywa 076
     OR auth.uid() IS NOT DISTINCT FROM OLD.user_id -- samowypisanie
  THEN
    RETURN OLD;
  END IF;

  SELECT coalesce(title, sport), event_date, event_time, status
    INTO v_tytul, v_data, v_godz, v_status
    FROM events WHERE id = OLD.event_id;

  -- Mecz usunięty (kaskada) → nic do znalezienia; mecz odwołany albo już
  -- rozegrany → nie dorzucamy kolejnego powiadomienia do tego, co już wysłała
  -- `070`, ani nie mieszamy graczowi w głowie datą z przeszłości.
  IF v_status IS NULL OR v_status = 'cancelled' OR v_data < current_date THEN
    RETURN OLD;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (
    OLD.user_id, 'usuniety_ze_skladu', 'Usunięto Cię ze składu',
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(v_data, 'DD.MM') || ', godz. '
      || to_char(v_godz, 'HH24:MI') || '. Organizator usunął Twój zapis.',
    OLD.event_id
  );
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_usunieciu_uczestnika ON event_participants;
CREATE TRIGGER trg_powiadom_o_usunieciu_uczestnika
  BEFORE DELETE ON event_participants
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_usunieciu_uczestnika();


-- ─────────────────────────────────────────────────────────────────────────
-- 114_powiadomienie_o_zmianie_warunkow.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 114: Powiadomienie o zmianie miejsca lub kosztu meczu.
--
-- Jedyne triggery reagujące na edycję meczu to `065` (zmiana daty/godziny)
-- i `070` (odwołanie). Przeniesienie meczu na inne boisko albo zmiana ceny —
-- dwie rzeczy, które organizator faktycznie zmienia w edycji — nie generowały
-- żadnego powiadomienia. Na czacie grupowym taka informacja by padła; Bojo
-- ma być lepsze od czatu, nie gorsze.
--
-- Jeden trigger na oba przypadki (miejsce + koszt), bo `updateEvent()`
-- (`lib/events.ts`) zapisuje ZAWSZE cały wiersz jedną instrukcją UPDATE —
-- rozdzielenie na dwa triggery dawałoby dwa powiadomienia z jednego kliknięcia
-- "Zapisz zmiany", gdy organizator zmienia oba naraz.

CREATE OR REPLACE FUNCTION powiadom_o_zmianie_warunkow()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tytul           TEXT;
  v_miejsce_zmiana  BOOLEAN;
  v_cena_zmiana     BOOLEAN;
  v_body            TEXT;
BEGIN
  v_miejsce_zmiana := NEW.field_id IS DISTINCT FROM OLD.field_id
    OR NEW.field_name IS DISTINCT FROM OLD.field_name
    OR NEW.custom_location_name IS DISTINCT FROM OLD.custom_location_name
    OR NEW.custom_address IS DISTINCT FROM OLD.custom_address
    OR NEW.lat IS DISTINCT FROM OLD.lat
    OR NEW.lng IS DISTINCT FROM OLD.lng;
  v_cena_zmiana := NEW.cost_grosz IS DISTINCT FROM OLD.cost_grosz;

  IF NOT v_miejsce_zmiana AND NOT v_cena_zmiana THEN RETURN NEW; END IF;
  IF NEW.status = 'cancelled' OR NEW.event_date < current_date THEN RETURN NEW; END IF;

  v_tytul := coalesce(NEW.title, NEW.sport);
  v_body := coalesce(v_tytul, 'Mecz') || ' — ';
  IF v_miejsce_zmiana AND v_cena_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce i koszt.';
  ELSIF v_miejsce_zmiana THEN
    v_body := v_body || 'zmieniło się miejsce: '
      || coalesce(NEW.field_name, NEW.custom_location_name, 'nowa lokalizacja') || '.';
  ELSE
    v_body := v_body || 'zmienił się koszt: '
      || to_char(NEW.cost_grosz / 100.0, 'FM999990.00') || ' zł od osoby.';
  END IF;

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'zmiana_warunkow_meczu', 'Zmiana w meczu', v_body, NEW.id
    FROM event_participants p
   WHERE p.event_id = NEW.id AND p.user_id IS NOT NULL AND p.user_id <> NEW.organizer_id;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_zmianie_warunkow ON events;
CREATE TRIGGER trg_powiadom_o_zmianie_warunkow
  AFTER UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_zmianie_warunkow();


-- ─────────────────────────────────────────────────────────────────────────
-- 115_gosc_wymaga_akceptacji.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 115: Zapis gościa respektuje "akceptacja zapisów" (require_approval).
--
-- `dolacz_do_meczu_jako_goscie()` (`088`, wcześniej `082`-`087`) wstawiała
-- `pending_approval = false` na sztywno. Na meczu z włączoną akceptacją
-- zapisów gość z linku wchodził prosto do składu, podczas gdy zalogowany
-- gracz w tej samej sytuacji czeka na zgodę organizatora (`dolacz_do_meczu`,
-- `078`). To łamało obietnicę kontroli składu, którą "akceptacja zapisów"
-- daje organizatorowi — furtka bez zamka obok drzwi z zamkiem.
--
-- Naprawa mirroruje `dolacz_do_meczu` z `078`: `v_pending :=
-- coalesce(v_wymaga_akceptacji, false)`, a `v_rezerwa` liczy się TYLKO gdy
-- NIE jest pending (`czy_na_rezerwe()` i tak już filtruje `pending_approval
-- = false` przy liczeniu pojemności, więc wiersz pending nie zajmuje miejsca
-- ani w składzie, ani na rezerwie).
--
-- Sygnatura i kształt `RETURNS TABLE` zostają IDENTYCZNE — zero zmian po
-- stronie wywołania z frontendu. `pending_approval` nowo wstawionego (albo
-- znalezionego) wiersza frontend dociąga tym samym drugim zapytaniem po
-- `claim_token`, którym już dziś dociąga `is_reserve`
-- (`lib/events.ts#joinEventAsGuest`) — nie ma potrzeby poszerzać zwrotki RPC.
--
-- Organizator i tak dostaje powiadomienie o nowej prośbie: trigger
-- `powiadom_o_prosbie_o_dolaczenie` (`076`) reaguje na `NEW.pending_approval
-- IS TRUE` niezależnie od tego, czy `NEW.user_id` jest NULL (gość) czy nie —
-- `approveParticipant`/`rejectParticipant` operują po `participantId`, bez
-- gałęzi na obecność konta.

DROP FUNCTION IF EXISTS dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN);

CREATE FUNCTION dolacz_do_meczu_jako_goscie(
  p_event_id UUID,
  p_imie TEXT,
  p_email TEXT,
  p_bramkarz BOOLEAN DEFAULT false,
  p_metoda_platnosci TEXT DEFAULT NULL,
  p_karta_sportowa BOOLEAN DEFAULT false
)
RETURNS TABLE (claim_token UUID, event_id UUID, already_joined BOOLEAN, has_account BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rezerwa boolean;
  v_pending boolean;
  v_wymaga_akceptacji boolean;
  v_imie_clean text := TRIM(BOTH ' ' FROM p_imie);
  v_email_clean text := TRIM(BOTH ' ' FROM p_email);
  v_istniejacy_token uuid;
  v_ma_wpis boolean;
  v_ma_konto boolean;
BEGIN
  -- Walidacja imienia
  IF v_imie_clean = '' OR LENGTH(v_imie_clean) > 80 THEN
    RAISE EXCEPTION 'Nieprawidłowe imię';
  END IF;

  -- Walidacja e-maila (prymitywna, bardziej szczegółową weryfikuje Supabase Auth)
  IF v_email_clean IS NULL OR v_email_clean = '' THEN
    RAISE EXCEPTION 'Podaj adres e-mail';
  END IF;
  IF NOT (v_email_clean LIKE '%@%.%') THEN
    RAISE EXCEPTION 'Nieprawidłowy adres e-mail';
  END IF;
  IF LENGTH(v_email_clean) > 100 THEN
    RAISE EXCEPTION 'Adres e-mail jest za długi';
  END IF;

  -- Czy mecz istnieje i czy nie został odwołany? Przy okazji: czy wymaga akceptacji.
  SELECT require_approval INTO v_wymaga_akceptacji FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie ma takiego meczu';
  END IF;
  IF EXISTS (SELECT 1 FROM events WHERE id = p_event_id AND status = 'cancelled') THEN
    RAISE EXCEPTION 'Mecz został odwołany';
  END IF;

  -- Czy ten e-mail ma konto w Bojo? Pytanie GLOBALNE (nie „czy jest w tym meczu"), bo
  -- decyduje o tym, czy ekran po zapisie zachęca do REJESTRACJI czy do LOGOWANIA.
  -- auth.users jest niedostępne dla anona — stąd SECURITY DEFINER.
  SELECT EXISTS (
    SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(v_email_clean)
  ) INTO v_ma_konto;

  -- Ten sam e-mail już ma wpis w tym meczu? ORDER BY, bo przy danych sprzed migracji
  -- `088` wybór wiersza decydował o wariancie ekranu — wiersz przejęty (z właścicielem)
  -- ma pierwszeństwo nad nieprzejętym gościem.
  SELECT ep.claim_token, true
    INTO v_istniejacy_token, v_ma_wpis
    FROM event_participants ep
   WHERE ep.event_id = p_event_id
     AND ep.guest_email IS NOT NULL
     AND lower(ep.guest_email) = lower(v_email_clean)
   ORDER BY (ep.claim_token IS NULL) DESC, ep.created_at
   LIMIT 1;

  IF v_ma_wpis THEN
    IF v_istniejacy_token IS NULL THEN
      -- Wpis ma już właściciela (konto przejęło zapis). Nie ma czego przejmować —
      -- frontend rozpozna to po pustym tokenie i pokaże ekran „zaloguj się".
      RETURN QUERY SELECT NULL::uuid, p_event_id, true, v_ma_konto;
      RETURN;
    END IF;
    -- Nieprzejęty gość z tym samym mailem — zwróć istniejący token zamiast
    -- wstawiać duplikat, oznaczając already_joined = true. Stan pending_approval
    -- tego wiersza dociąga frontend drugim zapytaniem po claim_token.
    RETURN QUERY SELECT v_istniejacy_token, p_event_id, true, v_ma_konto;
    RETURN;
  END IF;

  -- E-mail pasuje do konta, które jest już uczestnikiem tego meczu przez
  -- normalne (zalogowane) dołączenie — też nie ma czego przejmować.
  IF EXISTS (
    SELECT 1
      FROM auth.users u
      JOIN event_participants ep ON ep.user_id = u.id AND ep.event_id = p_event_id
     WHERE lower(u.email) = lower(v_email_clean)
  ) THEN
    RETURN QUERY SELECT NULL::uuid, p_event_id, true, true;
    RETURN;
  END IF;

  -- Odśwież kolejkę rezerwowych (wygasłe oferty przepadają, miejsca przechodzą dalej)
  PERFORM sync_reserve_claim(p_event_id);

  -- Akceptacja zapisów: tak samo jak przy zalogowanym dołączeniu (`078`), wiersz
  -- oczekujący na zgodę NIE zajmuje miejsca ani w składzie, ani na rezerwie —
  -- `czy_na_rezerwe()` liczy pojemność wyłącznie z `pending_approval = false`.
  v_pending := coalesce(v_wymaga_akceptacji, false);
  v_rezerwa := CASE WHEN v_pending THEN false
                    ELSE czy_na_rezerwe(p_event_id, p_bramkarz) END;

  -- Wstaw wiersz gościa i zwróć claim_token
  -- (token generuje trigger nadaj_token_gosciowi automatycznie)
  RETURN QUERY INSERT INTO event_participants (
    event_id,
    user_id,
    name,
    is_guest,
    guest_email,
    is_reserve,
    is_goalkeeper,
    payment_method,
    has_sports_card,
    pending_approval
  ) VALUES (
    p_event_id,
    NULL,
    v_imie_clean,
    true,
    v_email_clean,
    v_rezerwa,
    p_bramkarz,
    p_metoda_platnosci,
    p_karta_sportowa,
    v_pending
  )
  RETURNING event_participants.claim_token, p_event_id, false, v_ma_konto;
END;
$$;

-- Zezwol anonimom na wywołanie (grant znika przy DROP FUNCTION, trzeba nadać ponownie)
GRANT EXECUTE ON FUNCTION dolacz_do_meczu_jako_goscie(UUID, TEXT, TEXT, BOOLEAN, TEXT, BOOLEAN)
  TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 116_powiadomienie_o_usunieciu_meczu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 116: Powiadomienie o twardym usunięciu meczu.
--
-- `deleteEvent()` (`lib/events.ts`) to goły `DELETE FROM events`. Modal
-- potwierdzenia mówi wprost „Wszyscy uczestnicy stracą dostęp do meczu"
-- (`EventDetailClient.tsx`) — a mimo to nikt z nich nic nie dostawał. To
-- jedyne miejsce w produkcie, gdzie usunięcie danych jest całkowicie ciche.
--
-- ⚠️ PUŁAPKA ON DELETE CASCADE — PRZECZYTAJ PRZED ZMIANĄ TEGO PLIKU.
-- `notifications.event_id REFERENCES events(id) ON DELETE CASCADE` (`025`).
-- Gdyby ten trigger wstawiał powiadomienie z `event_id = OLD.id`, kaskada
-- Postgresa skasowałaby WŁASNY wiersz tego powiadomienia razem z resztą
-- danych zależnych od usuwanego meczu — insert by się powiódł, ale nic by nie
-- przetrwało, po cichu, bez błędu. Dlatego insert niżej celowo wstawia
-- `event_id = NULL`. `celPowiadomienia()` (`NotificationBell.tsx`) już dziś
-- obsługuje `eventId = null` — renderuje wiersz jako nieklikalny, zamiast
-- linkować do martwej strony 404. NIE zamieniaj `NULL` na `OLD.id`.
--
-- `BEFORE DELETE`: wiersz meczu (`sport`, `title`, `event_date`, `event_time`)
-- musi jeszcze istnieć, żeby zbudować treść powiadomienia.

CREATE OR REPLACE FUNCTION powiadom_o_usunieciu_meczu()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT;
BEGIN
  -- Mecz z przeszłości i tak nikogo nie zaskoczy na boisku — nie mieszamy
  -- graczowi w głowie powiadomieniem o dawno rozegranym/zapomnianym meczu.
  IF OLD.event_date < current_date THEN RETURN OLD; END IF;

  v_tytul := coalesce(OLD.title, OLD.sport);

  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT p.user_id, 'mecz_usuniety', 'Mecz usunięty',
    coalesce(v_tytul, 'Mecz') || ' — ' || to_char(OLD.event_date, 'DD.MM') || ', godz. '
      || to_char(OLD.event_time, 'HH24:MI') || '. Organizator usunął ten mecz na stałe.',
    NULL::uuid -- CELOWO NULL, nie OLD.id — patrz komentarz na górze pliku (pułapka CASCADE)
    FROM event_participants p
   WHERE p.event_id = OLD.id AND p.user_id IS NOT NULL AND p.user_id <> OLD.organizer_id;

  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_powiadom_o_usunieciu_meczu ON events;
CREATE TRIGGER trg_powiadom_o_usunieciu_meczu
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION powiadom_o_usunieciu_meczu();

-- ---------------------------------------------------------------------------
-- Naprawa odkryta przy ręcznym teście tej migracji na bazie testowej:
-- `powiadom_o_odrzuceniu_prosby()` (`076`) blokowała twarde usunięcie KAŻDEGO
-- meczu z choćby jedną oczekującą prośbą o dołączenie.
-- ---------------------------------------------------------------------------
-- Sekwencja przy `DELETE FROM events`: `BEFORE DELETE` na `events` (ten
-- trigger, wyżej) → wiersz meczu znika z tabeli → `ON DELETE CASCADE` kasuje
-- powiązane `event_participants` → to odpala ICH `BEFORE DELETE`, czyli też
-- `076`. W tym momencie `events` z tym `id` już nie istnieje, a `076` mimo to
-- próbowała wstawić powiadomienie z `event_id = OLD.event_id` — INSERT łamał
-- FK `notifications_event_id_fkey` i cała transakcja `DELETE FROM events`
-- wywracała się z błędem klucza obcego zamiast po prostu usunąć mecz.
-- Odtworzone ręcznie: mecz z jedną oczekującą prośbą, `DELETE FROM events`
-- kończył się `ERROR: insert or update on table "notifications" violates
-- foreign key constraint "notifications_event_id_fkey"`.
--
-- Naprawa: ten sam wzorzec osłony co w `powiadom_o_usunieciu_uczestnika()`
-- wyżej — gdy mecz już nie istnieje (kaskada), trigger milczy. O usunięciu
-- całego meczu i tak mówi powiadomienie `mecz_usuniety` wyżej.
CREATE OR REPLACE FUNCTION powiadom_o_odrzuceniu_prosby()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tytul TEXT; v_data DATE; v_godz TIME;
BEGIN
  IF OLD.pending_approval IS NOT TRUE OR OLD.user_id IS NULL THEN RETURN OLD; END IF;
  SELECT coalesce(title, sport), event_date, event_time INTO v_tytul, v_data, v_godz
    FROM events WHERE id = OLD.event_id;
  -- Mecz już nie istnieje (kaskadowe usunięcie całego meczu, patrz komentarz
  -- wyżej) — nic do odrzucenia, bo nie było decyzji organizatora, tylko
  -- usunięcie wydarzenia. INSERT z NULLami w treści i tak złamałby FK.
  IF NOT FOUND THEN RETURN OLD; END IF;
  INSERT INTO notifications (user_id, type, title, body, event_id)
  VALUES (OLD.user_id, 'prosba_odrzucona', 'Prośba o dołączenie odrzucona',
    'Organizator nie przyjął Twojej prośby o dołączenie do meczu: ' || coalesce(v_tytul,'mecz')
      || ' — ' || to_char(v_data,'DD.MM') || ', godz. ' || to_char(v_godz,'HH24:MI') || '.',
    OLD.event_id);
  RETURN OLD;
END; $$;


-- ─────────────────────────────────────────────────────────────────────────
-- 117_dopiecie_subskrypcji_push.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 117: Dopięcie subskrypcji push do aktualnego konta przy logowaniu.
--
-- BUG: subskrypcja push jest PER PRZEGLĄDARKA, nie per konto (patrz nagłówek
-- `lib/push.ts`) — jeden wiersz w `push_subscriptions` na urządzenie, kluczowany
-- `endpoint`-em. Wiersz dostaje `user_id` WYŁĄCZNIE w `wlaczPush()`, czyli po
-- kliknięciu „Włącz". Na wspólnym urządzeniu (telefon do testów, kilka kont
-- Bojo) `stanPush()` sprawdza WYŁĄCZNIE, czy przeglądarka ma jakąkolwiek
-- subskrypcję (`pushManager.getSubscription()`) — nie sprawdza, czyja. Gdy
-- konto B loguje się na telefonie, na którym konto A wcześniej włączyło push,
-- `stanPush()` od razu pokazuje „Włączone" — więc konto B nigdy nie klika
-- „Włącz" i wiersz zostaje przypisany do konta A NA ZAWSZE.
--
-- SKUTEK ZGŁOSZONY WPROST: powiadomienie push o CUDZEJ wiadomości (adresowane
-- do konta A) przyszło na telefon, na którym w danej chwili zalogowane jest
-- konto B — wyglądające jak „dostałem powiadomienie o własnej wiadomości",
-- bo to ten sam fizyczny telefon. Wyzwalacz `powiadom_o_wiadomosci_w_meczu`
-- (migracja `109`/`111`) POPRAWNIE wyklucza autora z odbiorców — problem nie
-- jest w regule powiadomień, tylko w tym, do kogo jest przypięty telefon.
--
-- FIX: RPC wołane po cichu przy KAŻDYM logowaniu (`lib/auth.tsx`), gdy
-- przeglądarka ma już subskrypcję — bez pytania o zgodę (już udzielona) i bez
-- klikania „Włącz". Musi być SECURITY DEFINER: zwykły UPSERT z klienta
-- (`push_subscriptions.upsert(..., {onConflict:'endpoint'})`, jak w
-- `wlaczPush()`) trafiłby na ten sam problem, który naprawia — polityka
-- UPDATE `USING (auth.uid() = user_id)` sprawdza WŁAŚCICIELA ISTNIEJĄCEGO
-- wiersza (konto A), nie nowego (konto B), więc RLS po cichu odrzuciłby
-- reassignment (ta sama pułapka co w AGENTS.md „RLS po cichu unieważnia
-- UPDATE" — zero błędu, zero zmiany).
--
-- Bezpieczeństwo: RPC zawsze przypisuje wiersz do `auth.uid()` wołającego —
-- nigdy do cudzego konta. Jedyny nowy wektor to przejęcie CUDZEGO `endpoint`
-- (świadome podanie nie swojego), a `endpoint` to nieprzewidywalny adres
-- wydany przez usługę push przeglądarki — porównywalny poziom zaufania co
-- dzisiejsza polityka INSERT, która i tak przyjmuje `endpoint` bez weryfikacji.
CREATE OR REPLACE FUNCTION dopnij_subskrypcje_push(
  p_endpoint TEXT, p_p256dh TEXT, p_auth TEXT, p_przegladarka TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, przegladarka)
  VALUES (auth.uid(), p_endpoint, p_p256dh, p_auth, p_przegladarka)
  ON CONFLICT (endpoint) DO UPDATE
    SET user_id      = excluded.user_id,
        p256dh       = excluded.p256dh,
        auth         = excluded.auth,
        przegladarka = excluded.przegladarka;
END;
$$;

GRANT EXECUTE ON FUNCTION dopnij_subskrypcje_push(TEXT, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION dopnij_subskrypcje_push IS
  'Przypina istniejącą subskrypcję push (per przeglądarka) do aktualnie zalogowanego konta. Wołane po cichu przy logowaniu (lib/auth.tsx) — naprawia sytuację, w której współdzielone urządzenie zostaje na zawsze przypięte do PIERWSZEGO konta, które kiedykolwiek kliknęło „Włącz" (migracja 117).';


-- ─────────────────────────────────────────────────────────────────────────
-- 118_rezerwa_czas_w_minutach.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 118: Czas na decyzję z rezerwy w minutach, nie w godzinach.
--
-- PO CO: `reserve_claim_hours` (migracja `058`) był SMALLINT liczonym w PEŁNYCH
-- godzinach, `CHECK BETWEEN 1 AND 72` — najkrótszy możliwy czas to godzina.
-- Zgłoszone wprost: wybór jest „mocno ograniczony", potrzeba więcej wartości
-- w przedziale 30 minut – 3 godziny (typowy czas reakcji na telefon), a nie
-- tylko pełne godziny w górę. Godzina jako jednostka fizycznie nie mieści
-- „30 minut" — stąd zmiana jednostki, nie tylko dołożenie opcji do listy.
--
-- PRZENUMEROWANIE: kolumna zmienia NAZWĘ i JEDNOSTKĘ w jednej migracji,
-- zamiast dokładać drugą kolumnę obok — dwie kolumny o tym samym znaczeniu
-- (`reserve_claim_hours` i `reserve_claim_minutes`) to gwarantowany rozjazd,
-- który ktoś prędzej czy później przeczyta z niewłaściwej. Istniejące wartości
-- (pełne godziny) mnożymy razy 60 — zero zmiany faktycznego czasu dla już
-- ustawionych meczów.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ — i to nie jest higiena na zapas. Pierwsza wersja
-- tej migracji zaczynała się gołym `ALTER TABLE … RENAME COLUMN`, więc
-- każde kolejne uruchomienie wywracało się na pierwszej linijce i NIE dochodziło
-- do reszty. Kosztowało to prawdziwą bazę w stanie połowicznym: ktoś puszcza
-- seed, dostaje „column reserve_claim_minutes does not exist", puszcza z ręki
-- SAMĄ zmianę nazwy żeby się odblokować — i zostaje z kolumną o nowej nazwie,
-- ale ze STARYM ograniczeniem `CHECK 1..72`, starą wartością domyślną `3`
-- i wartościami nadal w godzinach. Następny błąd brzmi już
-- „violates check constraint events_reserve_claim_hours_check".
--
-- Stąd każdy krok niżej jest warunkowy, a całość rozpoznaje trzy stany:
-- przed migracją, po połowicznej migracji i po pełnej.
DO $mig118$
DECLARE
  -- Stan sprzed migracji: kolumna nazywa się jeszcze po staremu.
  stara_kolumna boolean := EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'events'
       AND column_name = 'reserve_claim_hours');
  -- Ograniczenie z `058` PRZEŻYWA zmianę nazwy kolumny — Postgres zmienia
  -- nazwę kolumny, nie nazwę ograniczenia. Dlatego jego obecność jest
  -- jedynym pewnym znakiem, że w kolumnie siedzą jeszcze GODZINY: dopóki
  -- `CHECK 1..72` wisi na tabeli, nic większego niż 72 nie miało prawa wejść.
  stary_check boolean := EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.events'::regclass
       AND conname = 'events_reserve_claim_hours_check');
  przeliczone integer := 0;
BEGIN
  IF stara_kolumna THEN
    ALTER TABLE events RENAME COLUMN reserve_claim_hours TO reserve_claim_minutes;
  END IF;

  -- Stare ograniczenie musi zniknąć PRZED przeliczeniem: 3 godziny to 180
  -- minut, a 180 nie mieści się w `1..72`.
  ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reserve_claim_hours_check;

  -- Mnożenie razy 60 wykonuje się DOKŁADNIE RAZ — drugie zamieniłoby trzy
  -- godziny w sto osiemdziesiąt.
  IF stara_kolumna OR stary_check THEN
    UPDATE events SET reserve_claim_minutes = reserve_claim_minutes * 60;
    GET DIAGNOSTICS przeliczone = ROW_COUNT;
  END IF;

  RAISE NOTICE 'Migracja 118: przeliczono % wierszy z godzin na minuty.', przeliczone;
END
$mig118$;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_reserve_claim_minutes_check;
ALTER TABLE events ADD CONSTRAINT events_reserve_claim_minutes_check
  CHECK (reserve_claim_minutes BETWEEN 15 AND 4320);  -- 15 min .. 72 h (górna granica bez zmian)
ALTER TABLE events ALTER COLUMN reserve_claim_minutes SET DEFAULT 180;  -- było DEFAULT 3 (godziny)

COMMENT ON COLUMN events.reserve_claim_minutes IS
  'Ile minut ma rezerwowy na przyjęcie zwolnionego miejsca, zanim przejdzie do kolejnej osoby (sync_reserve_claim). Do migracji 118 kolumna nazywała się reserve_claim_hours i liczyła pełne godziny — istniejące wartości przemnożone razy 60 przy przenumerowaniu.';

-- ---------------------------------------------------------------------------
-- sync_reserve_claim: ciało skopiowane z migracji `110` (ostatnia definicja) —
-- zmienione WYŁĄCZNIE odczyt kolumny (`v_hours`→`v_minutes`), budowa interwału
-- (`' hours'`→`' minutes'`) i tekst powiadomienia (dostaje czytelny format,
-- nie gołą liczbę minut przy krótkich oknach — „Masz 30 min." zamiast
-- mylącego „Masz 0 godz.").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_reserve_claim(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_minutes smallint; v_started boolean; v_title text; v_sport text;
  v_gk_enabled boolean;
  v_czas text;
  v_next_id uuid; v_next_user uuid;
BEGIN
  SELECT reserve_claim_minutes, goalkeepers_enabled,
         (event_date + event_time)::timestamp <= now() OR status = 'cancelled',
         coalesce(title, sport), sport
    INTO v_minutes, v_gk_enabled, v_started, v_title, v_sport
    FROM events WHERE id = p_event_id;

  IF v_minutes IS NULL OR v_started THEN RETURN; END IF;

  v_czas := CASE
    WHEN v_minutes < 60 THEN v_minutes || ' min.'
    WHEN v_minutes % 60 = 0 THEN (v_minutes / 60) || ' godz.'
    ELSE (v_minutes / 60) || ' godz. ' || (v_minutes % 60) || ' min.'
  END;

  -- Wygasłe oferty przepadają — dopiero potem cokolwiek liczymy.
  UPDATE event_participants
     SET claim_passed = true, claim_offered_at = NULL
   WHERE event_id = p_event_id AND claim_offered_at IS NOT NULL
     AND claim_offered_at + (v_minutes || ' minutes')::interval <= now();

  -- Zawodnicy z pola
  IF NOT czy_na_rezerwe(p_event_id, false) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = false
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_czas || ' na potwierdzenie udziału w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;

  -- Bramkarze — osobna kolejka. Pytanie zadajemy PONOWNIE, bo powyższa oferta
  -- mogła właśnie zająć ostatnie miejsce ze wspólnej puli (tryb `077`).
  IF v_gk_enabled AND NOT czy_na_rezerwe(p_event_id, true) THEN
    SELECT id, user_id INTO v_next_id, v_next_user
      FROM event_participants
     WHERE event_id = p_event_id AND is_reserve = true AND claim_passed = false
       AND claim_offered_at IS NULL AND pending_approval = false AND rsvp <> 'maybe'
       AND user_id IS NOT NULL AND is_goalkeeper = true
     ORDER BY zapisano_at LIMIT 1;
    IF v_next_id IS NOT NULL THEN
      UPDATE event_participants SET claim_offered_at = now() WHERE id = v_next_id;
      INSERT INTO notifications (user_id, type, title, body, event_id)
      VALUES (v_next_user, 'reserve_claim_offered', 'Zwolniło się miejsce!',
        'Masz ' || v_czas || ' na potwierdzenie udziału (jako bramkarz) w „' || v_title || '" (' || v_sport || ').', p_event_id);
    END IF;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION sync_reserve_claim(UUID) TO anon, authenticated;


-- ─────────────────────────────────────────────────────────────────────────
-- 119_id_powiadomienia_w_push.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 119: Identyfikator powiadomienia w payloadzie push.
--
-- PO CO: kliknięcie w powiadomienie push na telefonie nie oznaczało tej samej
-- pozycji jako przeczytanej w dzwonku aplikacji (zgłoszone wprost) — dzwonek
-- oznacza wszystko na raz WYŁĄCZNIE przy otwarciu panelu w aplikacji
-- (`NotificationBell.tsx`), a push to zupełnie inna ścieżka, o której dzwonek
-- nic nie wie.
--
-- Service worker (`public/sw.js`) nie ma dostępu do sesji Supabase — nie może
-- sam wykonać `UPDATE notifications SET read_at = now()`. Zamiast tego
-- dokleja identyfikator do adresu, na który nawiguje po kliknięciu
-- (`?przeczytaj=<id>`), a `NotificationBell.tsx` po stronie klienta czyta ten
-- parametr i woła zwykłe `markRead([id])`. Warunek: identyfikator musi w ogóle
-- dojechać do przeglądarki — stąd ta migracja.
--
-- Ciało funkcji skopiowane z `109` (ostatnia definicja) — zmieniona WYŁĄCZNIE
-- jedna linia `jsonb_build_object`, dokładająca `'id', NEW.id`.
CREATE OR REPLACE FUNCTION wyslij_push_po_powiadomieniu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_url    TEXT;
  v_sekret TEXT;
BEGIN
  -- Ustawienia sprawdzamy PIERWSZE: to najtańszy sposób na niewysłanie.
  IF EXISTS (
    SELECT 1 FROM profiles p
     WHERE p.id = NEW.user_id AND NEW.type = ANY(p.push_wylaczone)
  ) THEN
    RETURN NEW;
  END IF;

  SELECT wartosc INTO v_url    FROM konfiguracja_push WHERE klucz = 'url';
  SELECT wartosc INTO v_sekret FROM konfiguracja_push WHERE klucz = 'sekret';
  IF v_url IS NULL OR v_sekret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bojo-sekret', v_sekret
    ),
    body    := jsonb_build_object(
      'id',       NEW.id,
      'user_id',  NEW.user_id,
      'tytul',    NEW.title,
      'tresc',    NEW.body,
      'typ',      NEW.type,
      'event_id', NEW.event_id,
      'group_id', NEW.group_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Kanał dodatkowy nie może wywrócić zapisu powiadomienia w aplikacji.
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 120_rozmowa_i_blik_tylko_dla_swoich.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 120: Rozmowa meczu i numer BLIK przestają być czytelne dla całego internetu.
--
-- KONTEKST. Klucz `anon` siedzi w paczce JavaScriptu — musi, bo przeglądarka
-- rozmawia z Supabase bezpośrednio (patrz „Architektura w skrócie" w AGENTS.md).
-- Jedyną granicą jest więc RLS, a `event_comments` miało od `026` politykę
-- SELECT `USING (deleted_at IS NULL)`: BEZ WARUNKU NA OSOBĘ. Każdy, także
-- niezalogowany, mógł jednym zapytaniem do REST-a pobrać treść rozmów
-- WSZYSTKICH meczów w bazie — łącznie z prywatnymi. Interfejs pokazuje
-- zakładkę Rozmowa wyłącznie uczestnikom, organizatorowi i członkom ekipy
-- meczu (`mozeWidziecRozmowe` w EventDetailClient), ale to bramka w UI,
-- nie w bazie.
--
-- Tablica ekipy (`group_posts`, migracja `093`) była domknięta od pierwszego
-- dnia — ta migracja robi rozmowie meczu dokładnie to samo, tym samym
-- wzorcem: funkcja SECURITY DEFINER w warunku polityki.
--
-- DRUGA POŁOWA: NUMER BLIK. `events.blik_phone` to prywatny numer telefonu
-- organizatora. `canSeeBlikPhone()` (lib/payments.ts) chowa go w interfejsie
-- do godziny przed meczem, ale RLS na `events` jest WIERSZOWE, a polityka
-- SELECT na tej tabeli to `USING (true)` — czyli numer leciał w każdej
-- odpowiedzi `select('*')` do kogokolwiek, kto o mecz zapytał. Postgres nie
-- filtruje kolumn politykami, a odebranie uprawnienia do samej kolumny
-- (`REVOKE SELECT (blik_phone)`) wywróciłoby wszystkie `select('*')` w kodzie.
-- Dlatego numer przenosi się do OSOBNEJ TABELI z własną polityką — wiersz
-- widzi ten, kto ma coś do zapłacenia albo komu płacą.
--
-- KOLEJNOŚĆ WDROŻENIA (ważna, bo migracje puszcza się ręcznie):
--   1. ta migracja (`120`) — tworzy tabelę i kopiuje numery, `events.blik_phone`
--      zostaje nietknięte, więc STARY frontend działa dalej bez zmian,
--   2. deploy tego PR-a — frontend czyta i zapisuje już `event_blik`,
--   3. migracja `121` — dopiero ona kasuje kolumnę i zamyka wyciek.
-- Odwrócenie kroków 2 i 3 zostawia numer w świecie albo wywraca zapis meczu.

-- ---------------------------------------------------------------------------
-- 1. Kto widzi rozmowę meczu
-- ---------------------------------------------------------------------------
-- Lustro `mozeWidziecRozmowe` z EventDetailClient.tsx: uczestnik (każdy wpis
-- w `event_participants`, także oczekujący na akceptację i obserwujący — tak
-- samo jak w interfejsie), organizator oraz — gdy mecz jest przypięty do
-- ekipy — każdy jej członek. SECURITY DEFINER, bo funkcja czyta `events`
-- i `group_members` w imieniu polityki, a nie pytającego.
CREATE OR REPLACE FUNCTION czy_widzi_rozmowe_meczu(p_event_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
     WHERE e.id = p_event_id
       AND (
         e.organizer_id = auth.uid()
         OR EXISTS (SELECT 1 FROM event_participants ep
                     WHERE ep.event_id = e.id AND ep.user_id = auth.uid())
         OR (e.group_id IS NOT NULL AND EXISTS (
               SELECT 1 FROM group_members gm
                WHERE gm.group_id = e.group_id AND gm.user_id = auth.uid()))
       )
  );
$$;

GRANT EXECUTE ON FUNCTION czy_widzi_rozmowe_meczu(UUID) TO anon, authenticated;

-- UWAGA na pułapkę z migracji `100`: polityka SELECT rządzi też widocznością
-- wiersza PO zmianie, a kasowanie wiadomości jest miękkie (UPDATE ustawiający
-- `deleted_at`). Dlatego „swoje widzę zawsze" stoi jako osobny człon OR, poza
-- warunkiem widoczności rozmowy — inaczej autor, który zdążył wypisać się
-- z meczu, dostałby przy kasowaniu własnej wiadomości wyjątek
-- „new row violates row-level security policy".
DROP POLICY IF EXISTS "comments_select" ON event_comments;
CREATE POLICY "comments_select" ON event_comments FOR SELECT
  USING (
    (czy_widzi_rozmowe_meczu(event_id) AND deleted_at IS NULL)
    OR auth.uid() = user_id
  );

-- Pisać też tylko swoi. Dotąd wystarczyło być zalogowanym i znać `event_id`,
-- żeby dopisać się do rozmowy dowolnego meczu w bazie.
DROP POLICY IF EXISTS "comments_insert" ON event_comments;
CREATE POLICY "comments_insert" ON event_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id AND czy_widzi_rozmowe_meczu(event_id));

-- ---------------------------------------------------------------------------
-- 2. Numer BLIK w osobnej tabeli
-- ---------------------------------------------------------------------------
-- Jeden wiersz na mecz (PK = FK), więc PostgREST widzi relację jeden-do-jeden
-- i `select('*, event_blik(blik_phone)')` oddaje obiekt albo `null` — bez
-- numeru dla tych, których nie przepuści polityka niżej.
CREATE TABLE IF NOT EXISTS event_blik (
  event_id   UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  blik_phone TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE event_blik ENABLE ROW LEVEL SECURITY;

-- Uprawnienia WPROST, nie z domyślnych. `anon` MUSI mieć SELECT, choć nigdy
-- nie zobaczy ani jednego wiersza: strona meczu dociąga numer osadzeniem
-- (`select('*, event_blik(blik_phone)')`) i renderuje się także wylogowanemu.
-- Bez tego grantu PostgREST oddaje mu „permission denied" i pada CAŁA strona
-- meczu, zamiast po prostu nie pokazać numeru. Wiersze i tak odsiewa polityka.
GRANT SELECT ON event_blik TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON event_blik TO authenticated;

-- Widzą: organizator, delegaci (`089`) i KAŻDY, kto ma wpis w składzie —
-- rezerwowi i oczekujący na akceptację też, bo płacą tym samym numerem, gdy
-- wejdą. Reguła „dopiero godzinę przed meczem" (`canSeeBlikPhone`) zostaje
-- ŚWIADOMIE w interfejsie: to wygoda, nie ochrona przed uczestnikiem tego
-- samego meczu, a przeniesienie jej tutaj wymagałoby trzymania progu
-- `BLIK_PHONE_REVEAL_MINUTES` w dwóch miejscach naraz.
DROP POLICY IF EXISTS "event_blik_select" ON event_blik;
CREATE POLICY "event_blik_select" ON event_blik FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
    OR EXISTS (SELECT 1 FROM event_participants ep
                WHERE ep.event_id = event_blik.event_id AND ep.user_id = auth.uid())
  );

-- Zapisuje organizator albo delegat od płatności/edycji — ta sama trójka co
-- przy `events`, bez uczestników.
DROP POLICY IF EXISTS "event_blik_write" ON event_blik;
CREATE POLICY "event_blik_write" ON event_blik FOR ALL
  USING (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM events e WHERE e.id = event_id AND e.organizer_id = auth.uid())
    OR can_manage_payments(event_id)
    OR can_edit_event(event_id)
  );

-- Przeniesienie tego, co już jest w bazie. Idempotentne — migrację można
-- puścić drugi raz bez szkody.
INSERT INTO event_blik (event_id, blik_phone)
SELECT id, blik_phone FROM events
 WHERE blik_phone IS NOT NULL AND btrim(blik_phone) <> ''
ON CONFLICT (event_id) DO UPDATE SET blik_phone = EXCLUDED.blik_phone,
                                     updated_at = now();

-- ---------------------------------------------------------------------------
-- 3. RPC delegata pisze do nowej tabeli
-- ---------------------------------------------------------------------------
-- `event_set_payment_settings` z `090` ustawiała `events.blik_phone`. Po
-- migracji `121` tamtej kolumny nie będzie, więc funkcja zmienia adres zapisu
-- już teraz — działa poprawnie zarówno przed `121`, jak i po niej.
CREATE OR REPLACE FUNCTION event_set_payment_settings(
  p_event_id UUID,
  p_accepted_payment_methods TEXT[],
  p_blik_phone TEXT
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT can_manage_payments(p_event_id) THEN
    RAISE EXCEPTION 'Brak uprawnień do zmiany ustawień płatności tego wydarzenia';
  END IF;

  UPDATE events
     SET accepted_payment_methods = p_accepted_payment_methods
   WHERE id = p_event_id;

  IF p_blik_phone IS NULL OR btrim(p_blik_phone) = '' THEN
    DELETE FROM event_blik WHERE event_id = p_event_id;
  ELSE
    INSERT INTO event_blik (event_id, blik_phone)
    VALUES (p_event_id, btrim(p_blik_phone))
    ON CONFLICT (event_id) DO UPDATE SET blik_phone = EXCLUDED.blik_phone,
                                         updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION event_set_payment_settings(UUID, TEXT[], TEXT) TO authenticated;

COMMENT ON TABLE event_blik IS
  'Numer BLIK organizatora — osobno od `events`, bo RLS w Postgresie jest wierszowe, a `events` czyta każdy.';


-- ─────────────────────────────────────────────────────────────────────────
-- 121_koniec_blik_phone_w_events.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 121: Kasuje `events.blik_phone` — to ta migracja faktycznie zamyka wyciek.
--
-- URUCHOM DOPIERO PO WDROŻENIU FRONTENDU z tego samego PR-a. Kolejność
-- i uzasadnienie: patrz nagłówek migracji `120`. Skrótowo:
--   `120` → deploy → `121`.
--
-- Do tego momentu numer siedzi w DWÓCH miejscach: w `event_blik` (z polityką)
-- i w starej kolumnie `events.blik_phone`, którą czyta każdy — bo `events` ma
-- politykę SELECT `USING (true)`. Kopia w `event_blik` powstała w `120`,
-- frontend po deployu pisze i czyta wyłącznie ją, więc tutaj zostaje sama
-- czynność kasowania.
--
-- Po `121` `select('*')` na `events` przestaje zwracać `blik_phone`. Nic
-- w kodzie o tę kolumnę nie pyta: `toEvent()` czyta `event_blik`, a jedyny
-- zapis spoza klienta — `event_set_payment_settings()` — przeadresowała
-- migracja `120`.

-- Zabezpieczenie przed puszczeniem tego za wcześnie: gdyby w `events` siedział
-- numer, którego nie ma w `event_blik` (np. ktoś zapisał go starym frontendem
-- między `120` a deployem), dokładamy go, zamiast skasować razem z kolumną.
INSERT INTO event_blik (event_id, blik_phone)
SELECT id, blik_phone FROM events
 WHERE blik_phone IS NOT NULL AND btrim(blik_phone) <> ''
ON CONFLICT (event_id) DO NOTHING;

ALTER TABLE events DROP COLUMN IF EXISTS blik_phone;


-- ─────────────────────────────────────────────────────────────────────────
-- 122_odswiezenie_powiadomienia_o_wiadomosci.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 122: Odświeżenie powiadomienia o wiadomości w oknie ciszy.
--
-- PO CO: zgłoszone wprost — w panelu „Wiadomości" dzwonka (`NotificationBell.tsx`)
-- nie pojawiała się najnowsza wiadomość, mimo że osobny panel „Nieprzeczytane
-- rozmowy" (`PanelRozmow.tsx`, czyta wprost z `event_comments`/`group_posts`,
-- bez throttlingu) pokazywał ją poprawnie i z nowszą godziną.
--
-- Powód: `111` wstawia najwyżej jedno powiadomienie na odbiorcę na rozmowę
-- na godzinę (`NOT EXISTS (... created_at > now() - interval '60 minutes')`)
-- — to CELOWA ochrona przed spamem (rozmowa przed meczem potrafi mieć
-- trzydzieści wiadomości w kwadrans, jedno powiadomienie na godzinę
-- wystarcza jako sygnał). Problem: przy DRUGIEJ i KOLEJNYCH wiadomościach
-- w tej samej godzinie warunek po prostu pomijał wstawienie — istniejący
-- wiersz zostawał z treścią PIERWSZEJ wiadomości z tej godziny, a treść
-- kolejnych ginęła bez śladu, nawet w samej bazie.
--
-- NAPRAWA: zamiast pomijać wstawienie, ISTNIEJĄCY wiersz (ten sam odbiorca,
-- ta sama rozmowa, sprzed mniej niż godziny) dostaje treść NAJNOWSZEJ
-- wiadomości, świeży `created_at` i wraca do stanu nieprzeczytanego. Limit
-- (najwyżej jedno powiadomienie na godzinę) zostaje nietknięty — zmienia się
-- wyłącznie to, że TO JEDNO powiadomienie zawsze pokazuje ostatnią wiadomość,
-- nie zamrożoną pierwszą.
--
-- Push nie dubluje się: `trg_wyslij_push` (102) łapie wyłącznie INSERT, więc
-- UPDATE poniżej nie wysyła nowego powiadomienia na telefon — dokładnie to
-- samo ograniczenie co dotąd, celowo zachowane. `NotificationBell.tsx` w tym
-- samym PR dostaje osobną subskrypcję na UPDATE, żeby odświeżony wiersz
-- pokazał się na żywo, bez przeładowania panelu.

CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_meczu()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tytul TEXT;
  v_tresc TEXT;
BEGIN
  SELECT title INTO v_tytul FROM events WHERE id = NEW.event_id;

  -- 140 znaków: tyle mniej więcej mieści się w powiadomieniu na telefonie,
  -- zanim system i tak utnie resztę. Ucinamy sami, żeby dołożyć wielokropek —
  -- inaczej wiadomość kończy się w pół słowa i wygląda jak błąd.
  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  -- Odbiorcy, którzy już mają powiadomienie o tej rozmowie sprzed mniej niż
  -- godziny: podmieniamy treść na najnowszą i cofamy do nieprzeczytanego,
  -- zamiast dokładać drugi wiersz.
  UPDATE notifications n
     SET body = v_tresc,
         created_at = now(),
         read_at = NULL
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id
     AND ep.pending_approval = false
     AND n.user_id = ep.user_id
     AND n.event_id = NEW.event_id
     AND n.type = 'wiadomosc_w_meczu'
     AND n.created_at > now() - interval '60 minutes';

  -- Reszta — nikt jeszcze nie dostał powiadomienia o tej rozmowie w tej
  -- godzinie — dostaje nowy wiersz. UPDATE wyżej już nadpisał `created_at`
  -- na `now()` u objętych odbiorców, więc `NOT EXISTS` poniżej ich pomija
  -- (widzi świeży wiersz) i trafia tylko do tych bez żadnego powiadomienia.
  INSERT INTO notifications (user_id, type, title, body, event_id)
  SELECT DISTINCT ep.user_id,
         'wiadomosc_w_meczu',
         coalesce(v_tytul, 'Rozmowa meczu'),
         v_tresc,
         NEW.event_id
    FROM event_participants ep
   WHERE ep.event_id = NEW.event_id
     AND ep.user_id IS NOT NULL
     AND ep.user_id <> NEW.user_id
     AND ep.pending_approval = false
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = ep.user_id
          AND n.event_id = NEW.event_id
          AND n.type = 'wiadomosc_w_meczu'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION powiadom_o_wiadomosci_w_grupie()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_nazwa TEXT;
  v_tresc TEXT;
BEGIN
  IF NEW.pinned_at IS NOT NULL THEN
    RETURN NEW;   -- ogłoszenie ma własne powiadomienie (093)
  END IF;

  SELECT name INTO v_nazwa FROM groups WHERE id = NEW.group_id;

  v_tresc := NEW.user_name || ': ' ||
    CASE WHEN length(NEW.body) > 140 THEN left(NEW.body, 140) || '…' ELSE NEW.body END;

  UPDATE notifications n
     SET body = v_tresc,
         created_at = now(),
         read_at = NULL
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND n.user_id = gm.user_id
     AND n.group_id = NEW.group_id
     AND n.type = 'wiadomosc_w_grupie'
     AND n.created_at > now() - interval '60 minutes';

  INSERT INTO notifications (user_id, type, title, body, group_id)
  SELECT gm.user_id,
         'wiadomosc_w_grupie',
         coalesce(v_nazwa, 'Twoja ekipa'),
         v_tresc,
         NEW.group_id
    FROM group_members gm
   WHERE gm.group_id = NEW.group_id
     AND gm.user_id <> NEW.user_id
     AND NOT EXISTS (
       SELECT 1 FROM notifications n
        WHERE n.user_id = gm.user_id
          AND n.group_id = NEW.group_id
          AND n.type = 'wiadomosc_w_grupie'
          AND n.created_at > now() - interval '60 minutes'
     );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────
-- 123_potwierdzenia_obiektu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 123_potwierdzenia_obiektu.sql
--
-- Faza 3 SEO/GEO (BACKLOG.md §7a) — mikro-ankiety UGC: "czy to boisko jest
-- oświetlone?", "jaka tu jest nawierzchnia?". Google traktuje ciągłą zmianę
-- treści przez użytkowników jako sygnał świeżości; dla graczy to po prostu
-- fakt o obiekcie potwierdzony przez kogoś, kto tam realnie był.
--
-- OSOBNA TABELA od `zgloszenia_bledow` (migracja 099) — to inny mechanizm
-- z innym odbiorcą. `zgloszenia_bledow` jest widoczne WYŁĄCZNIE dla admina
-- i trafia do moderacji ("coś tu się nie zgadza, sprawdźcie"); to poniżej
-- jest publiczny, zagregowany głos ("potwierdzam: tak") bez moderacji —
-- świadomie NIC nie nadpisuje w `fields` (kolumny `lit`/`surface` z OSM
-- zostają nietknięte, patrz otwarty punkt "Zgłaszanie błędów: w aplikacji
-- i w danych obiektu" w BACKLOG.md o tym, czy/kiedy przejść na override).
--
-- Kształt bliźniaczy do `field_comments` (migracja 063): ten sam wzorzec
-- RLS (publiczny odczyt, zapis wyłącznie we własnym imieniu), bo to ta sama
-- klasa danych — publiczna, przypisana do zalogowanego autora, bez PII.

CREATE TABLE IF NOT EXISTS potwierdzenia_obiektu (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id    uuid NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,

  -- Dwa fakty na start — dokładnie te z wklejonego przez użytkownika planu
  -- SEO/GEO. Kolejny fakt = kolejna dozwolona wartość `wartosc`, nie nowa
  -- kolumna ani nowa tabela.
  fakt        TEXT NOT NULL CHECK (fakt IN ('oswietlenie', 'nawierzchnia')),

  -- Zestaw wartości zależny od `fakt`. Nawierzchnia używa DOKŁADNIE tych
  -- samych sześciu kluczy co SURFACE_MAP w scraper/import_osm_pbf.py i
  -- SURFACE_LABELS w frontend/src/lib/labels.ts — inaczej głos użytkownika
  -- i dane z OSM pokazywałyby się pod różnymi etykietami tej samej rzeczy.
  wartosc     TEXT NOT NULL,
  CONSTRAINT potwierdzenia_obiektu_wartosc_check CHECK (
    (fakt = 'oswietlenie' AND wartosc IN ('tak', 'nie'))
    OR (fakt = 'nawierzchnia' AND wartosc IN ('grass', 'artificial', 'hardcourt', 'concrete', 'clay', 'sand'))
  ),

  utworzono   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Jeden głos na fakt na obiekt na osobę. `ON CONFLICT` w zapisie (patrz
  -- lib/potwierdzeniaObiektu.ts) pozwala zmienić zdanie, nie zagłosować
  -- dwa razy pod dwoma wpisami.
  UNIQUE (field_id, user_id, fakt)
);

CREATE INDEX IF NOT EXISTS idx_potwierdzenia_obiektu_field
  ON potwierdzenia_obiektu (field_id);

ALTER TABLE potwierdzenia_obiektu ENABLE ROW LEVEL SECURITY;

-- Czyta każdy, także niezalogowany — strona boiska jest publiczna, a "kto
-- potwierdził oświetlenie" nie jest informacją wrażliwą (ten sam poziom
-- jawności co autor komentarza pod obiektem, field_comments).
DROP POLICY IF EXISTS "potwierdzenia_obiektu_select" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_select" ON potwierdzenia_obiektu FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "potwierdzenia_obiektu_insert" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_insert" ON potwierdzenia_obiektu FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Zmiana zdania nadpisuje własny głos zamiast dokładać kolejny.
DROP POLICY IF EXISTS "potwierdzenia_obiektu_update" ON potwierdzenia_obiektu;
CREATE POLICY "potwierdzenia_obiektu_update" ON potwierdzenia_obiektu FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 124_lista_rezerwowa_opcjonalna.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 124: Lista rezerwowa staje się WYBOREM organizatora, nie stałą regułą.
--
-- PO CO. Kreator mówił pod licznikiem miejsc: „Kolejni chętni trafią na listę
-- rezerwową." — zdanie o zachowaniu, którego nie dało się zmienić. Zaraz pod
-- spodem stało jeszcze ustawienie „Czas na decyzję z rezerwy", czyli reguła
-- rozdawania zwolnionych miejsc. Organizator, który rezerwy nie chce (mecz na
-- zamkniętą ekipę, hala opłacona z góry, ustalona dwunastka), musiał ją mimo
-- wszystko mieć i tłumaczyć ludziom, dlaczego zapisali się „na listę".
--
-- Od tej migracji rezerwa jest przełącznikiem. DEFAULT TRUE, bo dla wszystkich
-- istniejących meczów zachowanie ma zostać dokładnie takie, jakie było —
-- migracja niczego nikomu nie wyłącza.
--
-- CO ZNACZY „WYŁĄCZONA". Przy komplecie nikt nie ląduje na rezerwie: mecz jest
-- po prostu zamknięty, a organizator, który chce więcej ludzi, podnosi liczbę
-- miejsc. Istniejące wpisy `is_reserve = true` NIE są kasowane — wyłączenie
-- rezerwy na meczu, który już ma kolejkę, nie może po cichu usunąć ludziom
-- ich miejsca w niej. Kolejka zostaje widoczna, tylko nikt nowy do niej nie
-- wejdzie.
--
-- Kolumna `reserve_claim_minutes` zostaje bez zmian: przy wyłączonej rezerwie
-- po prostu nie ma czego rozdawać, a przy ponownym włączeniu wraca wcześniej
-- ustawiona wartość zamiast domyślnej.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS reserve_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN events.reserve_enabled IS
  'Czy przy komplecie chętni trafiają na listę rezerwową (migracja 124). false = mecz przy komplecie jest zamknięty. Istniejące wpisy is_reserve zostają — wyłączenie nie kasuje kolejki, która już powstała.';

-- ---------------------------------------------------------------------------
-- Bramka po stronie BAZY, nie interfejsu
-- ---------------------------------------------------------------------------
-- Bojo nie ma własnego backendu, a klucz `anon` siedzi jawnie w paczce JS —
-- schowanie przycisku w kreatorze nie jest żadną regułą. Reguła musi stać tu.
--
-- WYZWALACZ, a nie poprawka w `dolacz_do_meczu()`. Na rezerwę wchodzi się
-- kilkoma drogami: `dolacz_do_meczu()` (078, nadpisywane w 087 i 088),
-- akceptacja prośby, dopisanie gościa bez konta, przeniesienie przez
-- organizatora. Przepisywanie każdej z nich znaczyłoby cztery miejsca, w
-- których ta sama reguła może się rozjechać; wyzwalacz na tabeli łapie
-- wszystkie, także te dopisane w przyszłości.
--
-- Obejmuje INSERT i UPDATE: organizator nie powinien móc przenieść kogoś na
-- rezerwę meczu, który rezerwy nie prowadzi. Wpisy, które JUŻ są rezerwowe,
-- nie są ruszane — wyzwalacz patrzy wyłącznie na wiersze, które rezerwowe
-- SIĘ STAJĄ.
--
-- WYJĄTEK NA `rsvp = 'maybe'` NIE JEST DROBIAZGIEM. Obserwujący („Obserwuj"
-- na stronie meczu) siedzi w bazie z `is_reserve = true` — to sztuczka, żeby
-- nie zajmował miejsca w składzie, a nie deklaracja gry. Bez tego wyjątku
-- wyłączenie listy rezerwowej wyłączałoby przy okazji OBSERWOWANIE, czyli
-- funkcję, która z rezerwą nie ma nic wspólnego i istnieje właśnie po to,
-- żeby chcieć śledzić mecz bez blokowania komuś miejsca.

CREATE OR REPLACE FUNCTION pilnuj_wylaczonej_rezerwy()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM events WHERE id = NEW.event_id AND reserve_enabled
  ) THEN
    RAISE EXCEPTION 'Ten mecz nie prowadzi listy rezerwowej — przy komplecie zapisy są zamknięte.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pilnuj_wylaczonej_rezerwy ON event_participants;
CREATE TRIGGER trg_pilnuj_wylaczonej_rezerwy
  BEFORE INSERT OR UPDATE OF is_reserve ON event_participants
  FOR EACH ROW
  WHEN (NEW.is_reserve AND NEW.rsvp <> 'maybe')
  EXECUTE FUNCTION pilnuj_wylaczonej_rezerwy();

COMMENT ON FUNCTION pilnuj_wylaczonej_rezerwy() IS
  'Nie wpuszcza nikogo na listę rezerwową meczu z reserve_enabled = false (migracja 124). Wyzwalacz zamiast poprawki w dolacz_do_meczu(), bo na rezerwę wchodzi się kilkoma drogami.';


-- ─────────────────────────────────────────────────────────────────────────
-- 125_rozmowy_prywatne.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 125: Rozmowy prywatne między graczami (1-na-1) wraz z blokowaniem
--      i zgłaszaniem.
--
-- PO CO. Jedynym pisemnym kanałem w Bojo były dotąd rozmowy POD meczem
-- (`event_comments`, 026) i tablica ekipy (`group_posts`, 093) — obie grupowe
-- i obie zawieszone na czymś większym. Prywatne „Kuba, grasz w czwartek?"
-- albo „daj znać, jak zwolni się miejsce" szło na Messengera — do ludzi,
-- których gracz zna często TYLKO z boiska i nie ma do nich numeru.
--
-- BLOKOWANIE I ZGŁASZANIE SĄ CZĘŚCIĄ TEJ SAMEJ MIGRACJI, nie osobnym etapem.
-- Otwarty kanał do dowolnej osoby bez wyjścia awaryjnego to nie jest wersja
-- „pierwsza, uproszczona" — to jest wersja, której nie wolno wypuścić.
-- Aplikacja, w której organizator podaje numer telefonu do BLIKA, nie może
-- dawać obcemu możliwości pisania bez możliwości ucięcia tego jednym
-- kliknięciem.
--
-- KSZTAŁT WIADOMOŚCI. Bliźniaczy do `event_comments`/`group_posts`: płaska
-- lista (odpowiedzią jest nowa wiadomość), długość 1..1000, miękkie kasowanie
-- (`deleted_at`), nazwa nadawcy zapisana na sztywno przy wpisie. Czwarta kopia
-- tego samego kształtu jest celowa — patrz uzasadnienie w `063`.
--
-- JEDNA ROZMOWA = JEDNA PARA. Para jest KANONICZNA: `low_user_id < high_user_id`
-- (pilnuje CHECK). Rozmowa A↔B to zawsze dokładnie jeden wiersz, niezależnie
-- od tego, kto pisze pierwszy — bez tego porządku trzeba by pilnować dwóch
-- permutacji przy każdym zapisie i każdym odczycie, a pomyłka oznacza dwie
-- równoległe rozmowy tych samych osób. Klucz główny na parze daje unikalność
-- za darmo; tabela nie potrzebuje własnego `id`.
--
-- OSOBNE TABELE, NIE KOLUMNA „typ" W `event_comments`. Komentarz meczowy jest
-- czytelny dla uczestników meczu, rozmowa prywatna — wyłącznie dla dwóch osób.
-- Różnica widoczności o KLASĘ ważniejsza niż oszczędność dwóch tabel: polityki
-- RLS dla DM muszą być czytelne na pierwszy rzut oka, bo ich błąd oznacza cudzą
-- korespondencję na wyciągnięcie ręki.

CREATE TABLE IF NOT EXISTS dm_conversations (
  low_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  high_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (low_user_id, high_user_id),
  CHECK (low_user_id < high_user_id)
);

COMMENT ON TABLE dm_conversations IS
  'Rozmowy prywatne 1-na-1 (migracja 125). Para kanoniczna low < high: rozmowa A↔B to jeden wiersz bez względu na to, kto pisze pierwszy.';

CREATE TABLE IF NOT EXISTS dm_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  low_user_id  UUID NOT NULL,
  high_user_id UUID NOT NULL,
  sender_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name  TEXT NOT NULL,
  content      TEXT NOT NULL CHECK (char_length(btrim(content)) BETWEEN 1 AND 1000),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ,
  FOREIGN KEY (low_user_id, high_user_id)
    REFERENCES dm_conversations (low_user_id, high_user_id) ON DELETE CASCADE,
  -- Nadawca MUSI być stroną rozmowy — CHECK, nie tylko RLS, żeby reguła
  -- obowiązywała także zapisy omijające polityki (service role, wyzwalacz).
  CHECK (sender_id = low_user_id OR sender_id = high_user_id)
);

COMMENT ON TABLE dm_messages IS
  'Wiadomości prywatne (migracja 125). Miękkie kasowanie przez deleted_at, jak event_comments.';

CREATE INDEX IF NOT EXISTS dm_messages_rozmowa_czas
  ON dm_messages (low_user_id, high_user_id, created_at);

-- ---------------------------------------------------------------------------
-- Blokady
-- ---------------------------------------------------------------------------
-- KIERUNKOWA, nie symetryczna: „ja zablokowałem jego". Blokada działa jednak
-- w OBIE strony przy pisaniu — zablokowany nie napisze do mnie, a ja nie
-- napiszę do niego. To drugie jest celowe: kanał, który po zablokowaniu działa
-- w jedną stronę, jest gorszy niż brak blokady, bo daje złudzenie kontaktu.

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

COMMENT ON TABLE user_blocks IS
  'Kto kogo zablokował (migracja 125). Wpis kierunkowy, ale przy pisaniu obowiązuje w obie strony — patrz czy_zablokowani().';

CREATE TABLE IF NOT EXISTS user_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  powod       TEXT NOT NULL CHECK (char_length(btrim(powod)) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reporter_id <> reported_id)
);

COMMENT ON TABLE user_reports IS
  'Zgłoszenia użytkowników (migracja 125). Czyta wyłącznie administracja — zgłaszający nie widzi cudzych zgłoszeń, a zgłoszony nie widzi żadnego.';

/**
 * Czy między tą parą stoi blokada — W KTÓRĄKOLWIEK stronę.
 * SECURITY DEFINER, bo polityka `dm_messages_insert` musi móc zajrzeć do
 * `user_blocks` drugiej osoby, których to wierszy zwykły użytkownik nie czyta.
 */
CREATE OR REPLACE FUNCTION czy_zablokowani(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
     WHERE (blocker_id = a AND blocked_id = b)
        OR (blocker_id = b AND blocked_id = a)
  );
$$;

GRANT EXECUTE ON FUNCTION czy_zablokowani(UUID, UUID) TO authenticated;

ALTER TABLE dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reports     ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Polityki: widzi i pisze WYŁĄCZNIE uczestnik pary
-- ---------------------------------------------------------------------------
-- W przeciwieństwie do `event_comments` nie ma tu polityki dla `anon` i nie ma
-- ŻADNEJ ścieżki czytania cudzej rozmowy.

DROP POLICY IF EXISTS "dm_conversations_select" ON dm_conversations;
CREATE POLICY "dm_conversations_select" ON dm_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = low_user_id OR auth.uid() = high_user_id);

DROP POLICY IF EXISTS "dm_conversations_insert" ON dm_conversations;
CREATE POLICY "dm_conversations_insert" ON dm_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.uid() = low_user_id OR auth.uid() = high_user_id)
    AND NOT czy_zablokowani(low_user_id, high_user_id)
  );

DROP POLICY IF EXISTS "dm_messages_select" ON dm_messages;
CREATE POLICY "dm_messages_select" ON dm_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = low_user_id OR auth.uid() = high_user_id);

-- Blokada wchodzi w warunek ZAPISU, nie odczytu: historia sprzed blokady
-- zostaje widoczna obu stronom. Kasowanie cudzych wiadomości przy blokowaniu
-- byłoby przepisywaniem przeszłości — a zgłoszenie ma się do czego odwołać.
DROP POLICY IF EXISTS "dm_messages_insert" ON dm_messages;
CREATE POLICY "dm_messages_insert" ON dm_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND (auth.uid() = low_user_id OR auth.uid() = high_user_id)
    AND NOT czy_zablokowani(low_user_id, high_user_id)
  );

-- Miękkie kasowanie: wyłącznie autor własnej wiadomości (jak w migracji 100
-- dla `event_comments`).
DROP POLICY IF EXISTS "dm_messages_update" ON dm_messages;
CREATE POLICY "dm_messages_update" ON dm_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- Blokady: widzę i zakładam WYŁĄCZNIE własne. Nikt nie sprawdzi, czy został
-- zablokowany — dowiaduje się o tym tylko tyle, że wiadomość nie przechodzi.
DROP POLICY IF EXISTS "user_blocks_select" ON user_blocks;
CREATE POLICY "user_blocks_select" ON user_blocks FOR SELECT
  TO authenticated USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_insert" ON user_blocks;
CREATE POLICY "user_blocks_insert" ON user_blocks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "user_blocks_delete" ON user_blocks;
CREATE POLICY "user_blocks_delete" ON user_blocks FOR DELETE
  TO authenticated USING (auth.uid() = blocker_id);

-- Zgłoszenia: wyłącznie zapis. Ani zgłaszający, ani zgłoszony nie czytają
-- niczego — lista zgłoszeń jest sprawą administracji, a możliwość sprawdzenia
-- „czy ktoś mnie zgłosił" zamieniłaby narzędzie ochrony w narzędzie nacisku.
DROP POLICY IF EXISTS "user_reports_insert" ON user_reports;
CREATE POLICY "user_reports_insert" ON user_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);


-- ─────────────────────────────────────────────────────────────────────────
-- 126_szukanie_bez_ogonkow.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 126: Szukanie boisk przestaje wymagać polskich ogonków.
--
-- PO CO. `searchExplorerFields()` robi `ilike '%<fraza>%'` na `name` i `address`.
-- Postgres porównuje przy tym znak po znaku, więc „poznan" NIE jest zgodne
-- z „Poznań" — a nikt nie pisze ogonków w szukajce na telefonie. Efekt:
-- wpisanie miasta zwracało ZERO wyników z katalogu, mapa zostawała bez pinezek,
-- a użytkownik dostawał komunikat „nic nie znaleziono" przy 38 tysiącach
-- obiektów w bazie. Zgłoszone wprost: „po wyszukaniu np. »poznan« w widoku
-- mapy … całość się pierdoli".
--
-- Strona przeglądarki jest już naprawiona (`foldText()` w `lib/searchText.ts`),
-- ale to tylko filtr NA TYM, co przyszło z serwera. Gdy serwer nie zwraca nic,
-- nie ma czego filtrować — dlatego ta migracja.
--
-- DLACZEGO `translate()`, A NIE `unaccent()`. `unaccent()` nie jest IMMUTABLE
-- (zależy od słownika, który da się podmienić), więc nie wolno go użyć
-- w kolumnie generowanej ani zaindeksować bez owijania we własną funkcję.
-- `translate()` jest immutable, nie wymaga żadnego rozszerzenia i pokrywa
-- dokładnie te dziewięć liter, które w polskim istnieją. Mapowanie jest to samo
-- co w `foldText()` po stronie przeglądarki — obie strony MUSZĄ składać tekst
-- tak samo, inaczej filtr lokalny wytnie to, co serwer właśnie znalazł.
--
-- WIELKIE LITERY SĄ W MAPOWANIU CELOWO, mimo `lower()` przed nim. `lower()`
-- jest zależne od locale bazy: w bazie postawionej z locale „C" zna wyłącznie
-- ASCII, więc „Ń" zostaje wielkie i wypadłoby z mapowania. Wymienienie obu
-- wielkości znaczy, że kolumna liczy się tak samo niezależnie od tego, jak
-- postawiono bazę.
--
-- DA SIĘ PUŚCIĆ DRUGI RAZ. Kolumna generowana jest wyliczana przez bazę przy
-- każdym zapisie, więc nie ma czego backfillować ani co mogłoby zostać
-- w połowie (patrz pułapka z migracji 118).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS szukaj_norm TEXT
  GENERATED ALWAYS AS (
    translate(
      lower(coalesce(name, '') || ' ' || coalesce(address, '')),
      'ąćęłńóśźżĄĆĘŁŃÓŚŹŻ',
      'acelnoszzacelnoszz'
    )
  ) STORED;

COMMENT ON COLUMN fields.szukaj_norm IS
  'Nazwa + adres złożone do postaci bez ogonków i małymi literami (migracja 126). Do szukania `ilike` bez polskich znaków. Odpowiednik foldText() z frontend/src/lib/searchText.ts — zmiana po jednej stronie wymaga zmiany po drugiej.';

-- GIN po trigramach: bez niego `ilike '%...%'` na 38 tysiącach wierszy to
-- pełen przegląd tabeli przy każdym naciśnięciu klawisza.
CREATE INDEX IF NOT EXISTS fields_szukaj_norm_trgm
  ON fields USING gin (szukaj_norm gin_trgm_ops);


-- ─────────────────────────────────────────────────────────────────────────
-- 127_prywatne_kolumny_skladu.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 127: E-mail gościa, telefon i token przejęcia wpisu przestają być czytelne
--      dla całego internetu.
--
-- KONTEKST. Klucz `anon` siedzi jawnie w paczce JavaScriptu (patrz „Architektura
-- w skrócie" w AGENTS.md), więc jedyną granicą jest baza. Polityka
-- `Participants readable by all` na `event_participants` ma od `004` warunek
-- `USING (true)`, a `getEvent()` czytało skład przez `select('*')`. Razem
-- znaczyło to, że jednym zapytaniem do REST-a — bez logowania, dla DOWOLNEGO
-- meczu, także prywatnego — dało się pobrać:
--
--   • `guest_email`  — adres e-mail osoby, która zapisała się bez konta,
--   • `guest_phone`  — jej numer telefonu,
--   • `phone`        — telefon uczestnika,
--   • `claim_token`  — sekret na okaziciela, którym przejmuje się cudzy wpis,
--   • `confirmation_token` — token potwierdzenia SMS.
--
-- Przy tokenach dało się jeszcze bronić stanowiska „to sekret na okaziciela,
-- model jak `join_code`" (BACKLOG §5). Przy adresach e-mail nie da się: to są
-- dane osobowe ludzi, którzy podali je wyłącznie po to, żeby wejść do składu.
-- Migracja `128` daje dodatkowo temu tokenowi moc WYPISANIA ze składu — czyli
-- bez tej zmiany każdy mógłby wypisywać cudzych graczy. Kolejność nie jest tu
-- przypadkowa.
--
-- DLACZEGO UPRAWNIENIA KOLUMNOWE, A NIE OSOBNA TABELA JAK W `120`.
-- Migracja `120` przeniosła `events.blik_phone` do osobnej tabeli właśnie
-- dlatego, że `REVOKE SELECT (kolumna)` wywróciłby wszystkie `select('*')`
-- w kodzie. Tutaj jest inaczej i to jest cała różnica: `select('*')` na
-- `event_participants` było w całym repo JEDNO (`lib/events.ts`), a żadnej
-- z tych pięciu kolumn nie czyta ani jeden komponent. Przenoszenie ich do
-- tabeli obok kosztowałoby migrację danych i czwarte miejsce, w którym trzeba
-- pamiętać o spójności — przy zerowym zysku.
--
-- KOLEJNOŚĆ WDROŻENIA (ważna, bo migracje puszcza się ręcznie):
--   1. deploy kodu z tego PR-a — `getEvent()` prosi już o jawną listę kolumn,
--      `addGuest()` nie czyta tokenu z wiersza, a `joinEventAsGuest()` nie
--      filtruje po `claim_token`,
--   2. ta migracja.
-- Odwrotna kolejność daje 403 („permission denied for column") na stronie
-- KAŻDEGO meczu, bo `select('*')` prosi o kolumny bez uprawnienia.
--
-- SKUTEK UBOCZNY, KTÓRY JEST ZALETĄ: każde przyszłe `select('*')` na tej
-- tabeli wywali się głośno zamiast po cichu wynieść dane. Nowy kod ma
-- wymieniać kolumny z nazwy.

-- ---------------------------------------------------------------------------
-- 1. Uprawnienia kolumnowe
-- ---------------------------------------------------------------------------
-- Uprawnienia kolumnowe są DODATKOWE do tabelowych: dopóki rola ma SELECT na
-- całej tabeli, `REVOKE SELECT (kolumna)` nie robi nic. Stąd kolejność —
-- najpierw zdejmujemy SELECT z tabeli, potem oddajemy listę kolumn jawnie.
--
-- Puszczalne drugi raz: REVOKE i GRANT są idempotentne z natury.
--
-- `service_role` (funkcje brzegowe) i właściciel schematu zostają nietknięci —
-- `send-event-sms` czyta `phone` i ma działać dalej.
REVOKE SELECT ON event_participants FROM anon, authenticated;

GRANT SELECT (
  id,
  event_id,
  user_id,
  name,
  is_guest,
  created_at,
  has_paid,
  is_reserve,
  team,
  paid_amount,
  is_captain,
  added_by,
  is_goalkeeper,
  pending_approval,
  rsvp,
  payment_method,
  has_sports_card,
  sports_card_provider,
  claim_offered_at,
  claim_passed,
  claimed_at,
  zapisano_at
) ON event_participants TO anon, authenticated;

-- UWAGA przy dokładaniu kolumny do tej tabeli: nowa kolumna NIE jest widoczna
-- dla API, dopóki nie dopiszesz jej do tego GRANT-a. To jest domyślnie
-- bezpieczne i tak ma zostać — ale objawia się jako „pole zawsze puste",
-- więc warto o tym wiedzieć, zanim zacznie się szukać błędu w kodzie.

-- ---------------------------------------------------------------------------
-- 2. Token przejęcia wpisu — przez funkcję, nie przez odczyt wiersza
-- ---------------------------------------------------------------------------
-- Interfejs pokazuje „Zaproś do Bojo" przy wpisie gościa organizatorowi ORAZ
-- osobie, która tego gościa dopisała (`mozeZaprosic()` w EventDetailClient —
-- ustalenie `O-31` z audytu ścieżki organizatora). Ta sama reguła stoi teraz
-- w bazie, więc token wydaje się dokładnie tym dwóm osobom, a nie każdemu,
-- kto otworzy stronę meczu.
--
-- Zwraca NULL zamiast rzucać wyjątkiem: brak uprawnienia i wpis już przejęty
-- to dla wywołującego ta sama sytuacja („nie ma czego wysłać"), a wyjątek
-- w tym miejscu trzeba by łapać w komponencie.
CREATE OR REPLACE FUNCTION token_wpisu_goscia(p_uczestnik uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.claim_token
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.id = p_uczestnik
     AND p.is_guest
     AND p.claimed_at IS NULL
     AND p.user_id IS NULL
     AND (e.organizer_id = auth.uid() OR p.added_by = auth.uid());
$$;

REVOKE ALL ON FUNCTION token_wpisu_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION token_wpisu_goscia(uuid) TO authenticated;

COMMENT ON FUNCTION token_wpisu_goscia(uuid) IS
  'Token przejęcia wpisu gościa dla organizatora meczu albo osoby, która gościa dopisała. NULL, gdy pytający nie ma prawa albo wpis jest już przejęty. Od migracji 127 to jedyna droga do tokenu — kolumna claim_token nie jest czytelna przez API.';


-- ─────────────────────────────────────────────────────────────────────────
-- 128_gosc_zarzadza_swoim_zapisem.sql
-- ─────────────────────────────────────────────────────────────────────────
-- 128: Gość bez konta przestaje być ulicą jednokierunkową.
--
-- PO CO. „Dołącz bez konta" (migracja `082`) jest argumentem, którym organizator
-- przebija opór graczy przed zakładaniem konta — i jednocześnie jedynym zapisem
-- w Bojo, którego zapisany NIE MOŻE cofnąć. Stan przed tą migracją:
--
--   • nie ma funkcji, która usuwałaby wpis gościa — `removeParticipant` wymaga
--     sesji, więc wypisać go może wyłącznie organizator,
--   • żaden wyzwalacz powiadomień go nie widzi: `070` (odwołanie), `114`
--     (zmiana warunków) i `116` (usunięcie meczu) mają warunek
--     `user_id IS NOT NULL`. Gość bez konta NIE DOWIE SIĘ, że mecz odwołano —
--     przyjedzie na boisko,
--   • po zamknięciu okna „Utwórz profil" traci `claim_token` bezpowrotnie:
--     nic nie ląduje na urządzeniu, żaden e-mail nie wychodzi.
--
-- Skutek dla organizatora jest odwrotny do obietnicy produktu: skład kłamie
-- dokładnie w tej części, którą organizator sam przyprowadził, a odwołanie
-- meczu dociera do połowy ludzi. Na czacie WhatsApp obie te rzeczy działają.
--
-- CO ROBI TA MIGRACJA. Podnosi `claim_token` z „tokenu do założenia konta"
-- do „prywatnego linku do własnego zapisu": tym samym adresem gość widzi stan
-- meczu i tym samym adresem się wypisuje. Zero nowych sekretów, zero nowej
-- tabeli — token już istnieje i już jest generowany wyzwalaczem z `066`.
--
-- WYMAGA MIGRACJI `127`. Token dostaje tu moc zmiany składu, a do `127`
-- kolumna `claim_token` była czytelna przez API dla każdego — czyli bez niej
-- ta funkcja byłaby przyciskiem do wypisywania CUDZYCH graczy.

-- ---------------------------------------------------------------------------
-- 1. Podgląd wpisu — szerszy, bo strona przestaje być samym „przejmij"
-- ---------------------------------------------------------------------------
-- Sygnatura się zmienia (dochodzą kolumny), więc CREATE OR REPLACE nie
-- wystarczy — Postgres nie pozwala zmienić typu zwracanego w miejscu.
DROP FUNCTION IF EXISTS podejrzyj_wpis_goscia(uuid);

CREATE FUNCTION podejrzyj_wpis_goscia(p_token uuid)
RETURNS TABLE (
  imie                text,
  event_id            uuid,
  tytul               text,
  data_meczu          date,
  godzina             time,
  miejsce             text,
  juz_przejety        boolean,
  -- Nowe od `128`. Wszystko dotyczy TEGO wpisu i TEGO meczu — nic o innych
  -- uczestnikach poza dwiema liczbami składu, które i tak widać na stronie
  -- meczu, dostępnej publicznie pod adresem z linku.
  status_meczu        text,
  na_rezerwie         boolean,
  czeka_na_akceptacje boolean,
  koszt_grosze        integer,
  w_skladzie          integer,
  max_graczy          integer,
  mozna_zmieniac      boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.name,
         e.id,
         coalesce(e.title, e.sport),
         e.event_date,
         e.event_time,
         -- Mecz przy pinezce spoza katalogu nie ma `field_name` — dotąd
         -- wychodziło z tego puste miejsce w podglądzie.
         coalesce(e.field_name, e.custom_location_name, e.custom_address, 'Boisko'),
         (p.claimed_at IS NOT NULL OR p.user_id IS NOT NULL),
         e.status,
         coalesce(p.is_reserve, false),
         coalesce(p.pending_approval, false),
         -- `cost_grosz`, nie `cost_grosze` — pułapka nazewnicza opisana
         -- w docs/domena.md; kolumna w bazie jest w liczbie pojedynczej.
         coalesce(e.cost_grosz, 0),
         (SELECT count(*)::int FROM event_participants x
           WHERE x.event_id = e.id AND x.pending_approval IS NOT TRUE
             AND x.rsvp <> 'maybe' AND x.is_reserve IS NOT TRUE),
         e.max_players,
         -- Czy da się jeszcze cokolwiek z tym wpisem zrobić. Ta sama reguła,
         -- którą niżej egzekwuje `wypisz_wpis_goscia` — liczona raz, tutaj,
         -- żeby interfejs nie musiał jej zgadywać drugi raz.
         --
         -- Czas liczony w strefie 'Europe/Warsaw', nie w UTC bazy (wzorem
         -- migracji `073`): baza stoi na UTC, więc gołe `now()` uznawałoby
         -- mecz o 20:00 za rozpoczęty dopiero o 22:00 czasu polskiego.
         (p.claimed_at IS NULL AND p.user_id IS NULL AND p.is_guest
          AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw'))
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token;
$$;

-- ---------------------------------------------------------------------------
-- 2. Wypisanie się przez link
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, bo wiersz gościa z definicji nie należy do nikogo: żadna
-- polityka oparta o `auth.uid()` nie mogłaby go przepuścić. Uprawnieniem jest
-- sam token — dokładnie tak, jak przy przejęciu wpisu (`066`).
--
-- Świadomie NIE pozwalamy wypisać:
--   • wpisu już przejętego (ma właściciela — ten wypisuje się normalnie,
--     zalogowany, i wtedy powiadomienia działają jak dla każdego),
--   • po rozpoczęciu meczu (skład rozegranego meczu to zapis historii,
--     z niego liczą się statystyki i rozliczenie).
CREATE OR REPLACE FUNCTION wypisz_wpis_goscia(p_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_event uuid;
BEGIN
  SELECT p.id, p.event_id
    INTO v_id, v_event
    FROM event_participants p
    JOIN events e ON e.id = p.event_id
   WHERE p.claim_token = p_token
     AND p.is_guest
     AND p.claimed_at IS NULL
     AND p.user_id IS NULL
     AND (e.event_date + e.event_time) > (now() AT TIME ZONE 'Europe/Warsaw');

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Tego zapisu nie da się już zmienić.';
  END IF;

  DELETE FROM event_participants WHERE id = v_id;

  -- Zwolnione miejsce idzie do pierwszej osoby z rezerwy — tą samą drogą,
  -- co przy każdym innym wypisaniu. Organizatora o zmianie stanu kompletu
  -- powiadomi wyzwalacz z `079`, wywołany już przez samo DELETE.
  PERFORM sync_reserve_claim(v_event);

  RETURN v_event;
END;
$$;

REVOKE ALL ON FUNCTION podejrzyj_wpis_goscia(uuid) FROM public;
REVOKE ALL ON FUNCTION wypisz_wpis_goscia(uuid) FROM public;
GRANT EXECUTE ON FUNCTION podejrzyj_wpis_goscia(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION wypisz_wpis_goscia(uuid) TO anon, authenticated;

COMMENT ON FUNCTION wypisz_wpis_goscia(uuid) IS
  'Wypisanie ze składu wpisu gościa bez konta, uprawnieniem jest sam token (model jak join_code). Nie działa na wpisie przejętym ani po rozpoczęciu meczu. Woła sync_reserve_claim, żeby zwolnione miejsce trafiło do rezerwy.';
