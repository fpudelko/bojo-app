-- 040_admin_delete_events.sql
-- Allow admins to delete ANY event (not just events they organize).
--
-- The frontend already treats admins as organizers for management actions
-- (isOrganizer = own || isAdmin), so the delete button is shown — but the only
-- DELETE policy on `events` was `auth.uid() = organizer_id`, so an admin's
-- delete silently affected 0 rows. This adds the missing policy.
--
-- All event-related rows (participants, comments, results, reminders, …) are
-- declared ON DELETE CASCADE, so removing the event cleans them up too.

DROP POLICY IF EXISTS "Admins can delete any event" ON events;
CREATE POLICY "Admins can delete any event"
  ON events FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
