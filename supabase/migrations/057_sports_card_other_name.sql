-- 057: Custom name for the "inne" (other) sports card option.
--
-- When the organizer accepts a card that isn't Multisport/FitProfit/Medicover,
-- "Inna karta" alone doesn't tell participants which one. This lets the
-- organizer name it once (e.g. "OK System") and have that name shown wherever
-- the generic "Inna karta" label would otherwise appear.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS sports_card_other_name TEXT;
