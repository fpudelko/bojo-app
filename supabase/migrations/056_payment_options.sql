-- 056: Payment method + sports-card discount options.
--
-- Event level (organizer sets at creation):
--   accepted_payment_methods — which ways participants may pay (blik/gotowka/inne)
--   blik_phone               — phone number for BLIK transfers, shown when 'blik' accepted
--   accepted_sports_cards    — which sports-benefit cards are honoured (multisport/
--                               fitprofit/medicover/inne)
--   sports_card_discount_grosz — flat discount (grosze) applied when a participant
--                               has any of the accepted cards. One shared amount,
--                               not per-provider — keeps the model and the UI simple.
--                               NULLABLE: real-world discounts vary too much to
--                               force a number (percentage-based, daily-visit
--                               limits, etc). NULL = "there is a discount, ask
--                               the organizer for details"; a value = exact grosze.
--
-- Participant level (player picks when joining a paid match):
--   payment_method     — which of the event's accepted methods they'll use
--   has_sports_card     — whether they hold one of the accepted cards
--   sports_card_provider — which one, when the event accepts more than one

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS accepted_payment_methods TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS blik_phone TEXT,
  ADD COLUMN IF NOT EXISTS accepted_sports_cards TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sports_card_discount_grosz INT CHECK (sports_card_discount_grosz IS NULL OR sports_card_discount_grosz >= 0);

ALTER TABLE event_participants
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS has_sports_card BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sports_card_provider TEXT;
