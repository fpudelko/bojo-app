-- 033_contact_visibility.sql
-- Phone numbers and e-mails scraped from OSM are hidden by default.
-- Admins can opt specific venues in by setting contact_visible = true.

ALTER TABLE fields
  ADD COLUMN IF NOT EXISTS contact_visible BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN fields.contact_visible IS
  'When false (default), phone and email are stripped from API responses.
   Set to true by an admin to make contact info visible to all users.';
