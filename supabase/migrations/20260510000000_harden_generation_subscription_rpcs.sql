-- Harden subscription / generation RPCs before production launch.
--
-- SECURITY DEFINER functions bypass RLS, so each function must enforce caller
-- intent explicitly instead of trusting client-provided user ids.

CREATE OR REPLACE FUNCTION check_generation_allowance(
  p_user_id         UUID,
  p_requested_count INTEGER DEFAULT 1
)
RETURNS TABLE (
  allowed   BOOLEAN,
  used      INTEGER,
  remaining INTEGER,
  tier      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role       TEXT := auth.jwt() ->> 'role';
  v_auth_uid   UUID := auth.uid();
  v_tier       TEXT;
  v_expires_at TIMESTAMPTZ;
  v_used       INTEGER;
  v_limit      INTEGER := 5;
  v_requested  INTEGER := GREATEST(COALESCE(p_requested_count, 1), 0);
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to check generation allowance for this user'
      USING ERRCODE = '42501';
  END IF;

  SELECT subscription_tier, subscription_expires_at
    INTO v_tier, v_expires_at
    FROM profiles
   WHERE id = p_user_id;

  IF v_tier = 'pro' AND (v_expires_at IS NULL OR v_expires_at > now()) THEN
    RETURN QUERY SELECT TRUE, 0, 999, 'pro'::TEXT;
    RETURN;
  END IF;

  SELECT COUNT(*)::INTEGER
    INTO v_used
    FROM generation_usage
   WHERE user_id = p_user_id
     AND created_at > now() - INTERVAL '7 days';

  RETURN QUERY
    SELECT
      (v_used + v_requested) <= v_limit,
      v_used,
      GREATEST(v_limit - v_used, 0),
      'free'::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION record_generation_usage(
  p_user_id  UUID,
  p_trigger  TEXT,
  p_count    INTEGER DEFAULT 1
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  TEXT := auth.jwt() ->> 'role';
  v_count INTEGER := GREATEST(COALESCE(p_count, 1), 0);
BEGIN
  IF COALESCE(v_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'record_generation_usage requires service_role'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO generation_usage (user_id, generation_trigger)
  SELECT p_user_id, p_trigger
    FROM generate_series(1, v_count);
END;
$$;

CREATE OR REPLACE FUNCTION update_subscription_status(
  p_user_id        UUID,
  p_tier           TEXT,
  p_expires_at     TIMESTAMPTZ,
  p_rc_customer_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
BEGIN
  IF COALESCE(v_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'update_subscription_status requires service_role'
      USING ERRCODE = '42501';
  END IF;

  UPDATE profiles
     SET subscription_tier        = p_tier,
         subscription_expires_at  = p_expires_at,
         revenuecat_customer_id   = p_rc_customer_id,
         updated_at               = now()
   WHERE id = p_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_generation_allowance(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_generation_allowance(UUID, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION record_generation_usage(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_generation_usage(UUID, TEXT, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION update_subscription_status(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION update_subscription_status(UUID, TEXT, TIMESTAMPTZ, TEXT) TO service_role;
