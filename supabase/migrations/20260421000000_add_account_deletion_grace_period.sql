-- Soft account deletion with a 14-day grace period.
--
-- Flow:
-- 1. User requests deletion → `request_account_deletion()` stamps
--    `profiles.deletion_scheduled_at`. The session is signed out client-side.
-- 2. If the user signs back in within the grace period, the client calls
--    `cancel_account_deletion()` which clears the timestamp.
-- 3. A scheduled job (pg_cron if available, else any external cron hitting the
--    `purge-expired-deletions` edge function) calls `purge_expired_deletions()`
--    to hard-delete any users whose grace period has elapsed.

ALTER TABLE profiles
  ADD COLUMN deletion_scheduled_at TIMESTAMPTZ;

CREATE INDEX profiles_deletion_scheduled_at_idx
  ON profiles (deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;

-- Marks the caller's account for deletion after the grace period.
-- Returns the scheduled purge timestamp so the client can show a countdown.
CREATE OR REPLACE FUNCTION public.request_account_deletion(
  grace_days INTEGER DEFAULT 14
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_scheduled_at TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF grace_days < 0 OR grace_days > 90 THEN
    RAISE EXCEPTION 'grace_days out of range' USING ERRCODE = '22023';
  END IF;

  v_scheduled_at := NOW() + (grace_days || ' days')::INTERVAL;

  UPDATE profiles
     SET deletion_scheduled_at = v_scheduled_at
   WHERE id = v_uid;

  RETURN v_scheduled_at;
END;
$$;

REVOKE ALL ON FUNCTION public.request_account_deletion(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(INTEGER) TO authenticated;

-- Clears a pending deletion for the caller. Safe to call when no deletion is
-- pending — it becomes a no-op.
CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_had_pending BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE profiles
     SET deletion_scheduled_at = NULL
   WHERE id = v_uid
     AND deletion_scheduled_at IS NOT NULL
  RETURNING TRUE INTO v_had_pending;

  RETURN COALESCE(v_had_pending, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;

-- Hard-deletes users whose grace period has elapsed. Deletes from auth.users
-- which cascades to profiles and everything else via existing FKs.
-- Returns the number of accounts purged.
CREATE OR REPLACE FUNCTION public.purge_expired_deletions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  WITH expired AS (
    SELECT id
      FROM profiles
     WHERE deletion_scheduled_at IS NOT NULL
       AND deletion_scheduled_at <= NOW()
  ),
  purged AS (
    DELETE FROM auth.users
     WHERE id IN (SELECT id FROM expired)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_deleted_count FROM purged;

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_deletions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_deletions() TO service_role;

-- Opportunistically schedule a daily purge via pg_cron when the extension is
-- available. On self-hosted or local setups without pg_cron, an external
-- scheduler should hit the `purge-expired-deletions` edge function instead.
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_available_extensions
     WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;

    -- Drop-and-recreate so repeated `db reset` runs stay idempotent.
    IF EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'purge-expired-account-deletions'
    ) THEN
      PERFORM cron.unschedule('purge-expired-account-deletions');
    END IF;

    PERFORM cron.schedule(
      'purge-expired-account-deletions',
      '17 3 * * *',
      'SELECT public.purge_expired_deletions();'
    );
  END IF;
END
$outer$;
