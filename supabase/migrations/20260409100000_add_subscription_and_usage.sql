-- ============================================================
-- Subscription fields on profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT;

-- ============================================================
-- Generation usage table
-- One row per AI generation event (rolling-window rate limiting)
-- ============================================================

CREATE TABLE IF NOT EXISTS generation_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  generation_trigger  TEXT NOT NULL
    CHECK (generation_trigger IN ('onboarding', 'preference_change', 'regeneration', 'auto_completion')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast rolling-window queries: WHERE user_id = $1 AND created_at > now() - interval '7 days'
CREATE INDEX IF NOT EXISTS idx_generation_usage_user_created
  ON generation_usage(user_id, created_at DESC);

-- Row-Level Security: users can read their own rows; writes only via SECURITY DEFINER RPCs
ALTER TABLE generation_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own generation usage"
  ON generation_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- RPC: check_generation_allowance
-- Returns whether the user may generate `p_requested_count`
-- more workouts given their current tier and rolling-window usage.
-- ============================================================

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
  v_tier       TEXT;
  v_expires_at TIMESTAMPTZ;
  v_used       INTEGER;
  v_limit      INTEGER := 5;
BEGIN
  SELECT subscription_tier, subscription_expires_at
    INTO v_tier, v_expires_at
    FROM profiles
   WHERE id = p_user_id;

  -- Pro with valid (or perpetual) subscription: unlimited
  IF v_tier = 'pro' AND (v_expires_at IS NULL OR v_expires_at > now()) THEN
    RETURN QUERY SELECT TRUE, 0, 999, 'pro'::TEXT;
    RETURN;
  END IF;

  -- Free (or expired Pro): count generations in the last 7 days
  SELECT COUNT(*)::INTEGER
    INTO v_used
    FROM generation_usage
   WHERE user_id = p_user_id
     AND created_at > now() - INTERVAL '7 days';

  RETURN QUERY
    SELECT
      (v_used + p_requested_count) <= v_limit,
      v_used,
      GREATEST(v_limit - v_used, 0),
      'free'::TEXT;
END;
$$;

-- ============================================================
-- RPC: record_generation_usage
-- Inserts p_count rows into generation_usage for the user.
-- Called after successful generation, server-side only.
-- ============================================================

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
BEGIN
  INSERT INTO generation_usage (user_id, generation_trigger)
  SELECT p_user_id, p_trigger
    FROM generate_series(1, p_count);
END;
$$;

-- ============================================================
-- RPC: update_subscription_status
-- Called by the RevenueCat webhook edge function (future).
-- Uses service role — not callable by RLS-restricted clients.
-- ============================================================

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
BEGIN
  UPDATE profiles
     SET subscription_tier        = p_tier,
         subscription_expires_at  = p_expires_at,
         revenuecat_customer_id   = p_rc_customer_id,
         updated_at               = now()
   WHERE id = p_user_id;
END;
$$;
