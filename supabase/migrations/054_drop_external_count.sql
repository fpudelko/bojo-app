-- 054: Drop external_count.
--
-- "Ilu graczy macie już spoza aplikacji" was removed from the UI — it isn't a
-- case we want to support up front (whoever has an outside crew adds them to
-- the roster after creating the match). Keeping a dead column around would
-- only muddy future capacity logic, and no live events depend on it yet.
--
-- Deploy the app code before running this: the app must stop selecting the
-- column first.

ALTER TABLE events DROP COLUMN IF EXISTS external_count;
