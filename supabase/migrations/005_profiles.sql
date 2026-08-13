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
