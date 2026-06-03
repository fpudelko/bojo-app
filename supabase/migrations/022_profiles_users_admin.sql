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
