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
