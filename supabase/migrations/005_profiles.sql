-- Profiles: avatar + admin flag
CREATE TABLE IF NOT EXISTS profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  is_admin   BOOLEAN  NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- `CREATE TABLE IF NOT EXISTS` milczy, gdy tabela już jest — a `profiles` to
-- najpopularniejsza nazwa w całym Supabase: zakłada ją quickstart „User
-- Management Starter" (id, username, full_name, avatar_url, website), więc
-- świeży projekt potrafi ją mieć, zanim ktokolwiek wklei pierwszą migrację.
-- Wtedy powyższe CREATE przechodzi bez słowa, a pierwsza polityka wywraca się
-- na `column "is_admin" does not exist` — komunikat, w którym nie ma ani słowa
-- o tym, że winna jest cudza tabela. Kolumny dokładamy więc jawnie; to samo
-- lekarstwo, co na migrację przerwaną w połowie (patrz docs/baza-danych.md).
-- Na bazie, która ma je od zawsze, ten blok jest pustym przebiegiem.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin   BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

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
