-- 035: Let organizers allow participants to add guests
-- When allow_guest_adds = true on an event, any logged-in user can insert
-- a guest row (is_guest = true) into event_participants.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS allow_guest_adds boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN events.allow_guest_adds IS
  'When true, any authenticated user can add a guest participant to this event.';

-- Extend the existing INSERT policy to cover participant-added guests.
DROP POLICY IF EXISTS "Join or organiser adds guest" ON event_participants;
CREATE POLICY "Join or organiser adds guest"
    ON event_participants FOR INSERT
    WITH CHECK (
        -- User adding themselves
        auth.uid() = user_id
        -- Organizer adding anyone (guests included)
        OR auth.uid() = (SELECT organizer_id FROM events WHERE events.id = event_id)
        -- Any logged-in user adding a guest when the organizer has enabled it
        OR (
            is_guest = true
            AND auth.uid() IS NOT NULL
            AND (SELECT allow_guest_adds FROM events WHERE events.id = event_id) = true
        )
    );
