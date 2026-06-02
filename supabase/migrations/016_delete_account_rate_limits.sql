-- ============================================================
-- 016: Account deletion RPC, rate limiting, profile phone field
-- ============================================================

-- Phone number + consent on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone             TEXT,
  ADD COLUMN IF NOT EXISTS phone_consent     BOOLEAN NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        REFERENCES auth.users ON DELETE CASCADE,
  action     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Efficient window lookup
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits (user_id, action, created_at);

-- Auto-clean old records (keeps table small)
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
  ON rate_limits (created_at);

-- Users must not read or manipulate rate_limits directly
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies = deny all direct access; functions use SECURITY DEFINER to bypass.

-- Check and record a rate limit action.
-- Returns TRUE if allowed, FALSE if limit exceeded.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_action       TEXT,
  p_max_per_hour INT DEFAULT 10
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid   UUID := auth.uid();
  cnt   INT;
BEGIN
  IF uid IS NULL THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO cnt
  FROM rate_limits
  WHERE user_id   = uid
    AND action     = p_action
    AND created_at > NOW() - INTERVAL '1 hour';

  IF cnt >= p_max_per_hour THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limits (user_id, action) VALUES (uid, p_action);
  RETURN TRUE;
END;
$$;

-- Periodically prune records older than 24h (call from a cron job / Edge Function)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '24 hours';
$$;

-- ---------------------------------------------------------------------------
-- Account deletion (GDPR right to be forgotten)
-- Anonymises participant records, deletes profile, then deletes auth user.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Anonymise personal data in event_participants (keep event history, lose identity)
  UPDATE public.event_participants
  SET user_id   = NULL,
      name      = 'Usunięty użytkownik',
      phone     = NULL,
      added_by  = NULL
  WHERE user_id = uid;

  -- Anonymise organizer name in events (keep events visible)
  UPDATE public.events
  SET organizer_name = 'Usunięty użytkownik'
  WHERE organizer_id = uid;

  -- Remove recurring event organizer entries
  UPDATE public.recurring_events
  SET organizer_name = 'Usunięty użytkownik'
  WHERE organizer_id = uid;

  -- Delete profile (avatar stays in storage — purge separately if needed)
  DELETE FROM public.profiles WHERE id = uid;

  -- Delete auth user — Supabase cascades to auth-linked data
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INT) TO authenticated;
