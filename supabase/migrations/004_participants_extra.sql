-- Rozszerzenie tabeli event_participants o płatności i rezerwę.
-- Uruchom w Supabase SQL Editor.

ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS has_paid  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS is_reserve BOOLEAN NOT NULL DEFAULT false;

-- Organizator może zmieniać has_paid i is_reserve uczestników swojego wydarzenia.
DROP POLICY IF EXISTS "Organizer updates participants" ON event_participants;
CREATE POLICY "Organizer updates participants"
    ON event_participants FOR UPDATE
    USING  (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id))
    WITH CHECK (auth.uid() = (SELECT organizer_id FROM events WHERE id = event_id));
