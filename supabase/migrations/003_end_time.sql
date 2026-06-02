-- Add optional end time to events (e.g. "gramy 18:00 – 20:00")
ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME;
