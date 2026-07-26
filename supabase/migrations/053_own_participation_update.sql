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
