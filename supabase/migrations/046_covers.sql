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
