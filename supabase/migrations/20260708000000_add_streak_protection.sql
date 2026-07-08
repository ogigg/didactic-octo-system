-- ============================================================
-- Streak protection
-- ============================================================

CREATE TABLE IF NOT EXISTS streak_protection_balances (
  user_id                         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  lifetime_rescue_used_at          TIMESTAMPTZ,
  earned_freezes_available         INTEGER NOT NULL DEFAULT 0
    CHECK (earned_freezes_available BETWEEN 0 AND 1),
  pro_freezes_available            INTEGER NOT NULL DEFAULT 0
    CHECK (pro_freezes_available BETWEEN 0 AND 3),
  pro_freezes_granted_through_month DATE,
  auto_apply_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  streak_restarted_at              TIMESTAMPTZ,
  last_prompt_dismissed_at         TIMESTAMPTZ,
  last_prompt_state                TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER streak_protection_balances_updated_at
  BEFORE UPDATE ON streak_protection_balances
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE streak_protection_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY streak_protection_balances_select_own
  ON streak_protection_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS streak_protection_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type           TEXT NOT NULL CHECK (
    event_type IN (
      'lifetime_rescue_used',
      'earned_freeze_granted',
      'earned_freeze_used',
      'pro_freeze_granted',
      'pro_freeze_used',
      'pro_auto_freeze_used',
      'streak_restarted',
      'comeback_started',
      'comeback_completed',
      'prompt_dismissed'
    )
  ),
  covered_week_start   DATE,
  covered_week_end     DATE,
  streak_weeks_before  INTEGER,
  streak_weeks_after   INTEGER,
  metadata             JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_streak_protection_events_user_created
  ON streak_protection_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_streak_protection_events_user_type
  ON streak_protection_events(user_id, event_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_streak_protection_events_one_coverage
  ON streak_protection_events(user_id, covered_week_start)
  WHERE event_type IN (
    'lifetime_rescue_used',
    'earned_freeze_used',
    'pro_freeze_used',
    'pro_auto_freeze_used'
  );

ALTER TABLE streak_protection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY streak_protection_events_select_own
  ON streak_protection_events FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- Internal helper
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_streak_protection_balance(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO streak_protection_balances (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ============================================================
-- RPC: get_streak_status
--
-- Returns the current streak/protection state. The function also performs
-- idempotent entitlement maintenance: monthly Pro freeze grants, earned free
-- freeze grants, and Pro auto-application for the most recently missed week.
-- ============================================================

CREATE OR REPLACE FUNCTION get_streak_status(
  p_user_id UUID
)
RETURNS TABLE (
  tier TEXT,
  is_pro_active BOOLEAN,
  current_streak_weeks INTEGER,
  longest_streak_weeks INTEGER,
  last_workout_at TIMESTAMPTZ,
  days_since_last_workout INTEGER,
  missed_week_count INTEGER,
  earned_freezes_available INTEGER,
  pro_freezes_available INTEGER,
  lifetime_rescue_available BOOLEAN,
  auto_apply_enabled BOOLEAN,
  prompt_state TEXT,
  should_show_prompt BOOLEAN,
  covered_week_start DATE,
  covered_week_end DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_auth_uid UUID := auth.uid();
  v_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_is_pro_active BOOLEAN;
  v_current_week_start DATE := DATE_TRUNC('week', NOW())::DATE;
  v_candidate_week_start DATE := (DATE_TRUNC('week', NOW())::DATE - 7);
  v_month_start DATE := DATE_TRUNC('month', NOW())::DATE;
  v_lifetime_rescue_used_at TIMESTAMPTZ;
  v_earned_freezes INTEGER;
  v_pro_freezes INTEGER;
  v_granted_through_month DATE;
  v_auto_apply_enabled BOOLEAN;
  v_streak_restarted_at TIMESTAMPTZ;
  v_last_prompt_dismissed_at TIMESTAMPTZ;
  v_last_prompt_state TEXT;
  v_active_weeks DATE[] := ARRAY[]::DATE[];
  v_week DATE;
  v_previous_week DATE;
  v_cursor DATE;
  v_has_prior_streak BOOLEAN := FALSE;
  v_needs_protection BOOLEAN := FALSE;
  v_auto_applied BOOLEAN := FALSE;
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_running_streak INTEGER := 0;
  v_missed_weeks INTEGER := 0;
  v_last_workout_at TIMESTAMPTZ;
  v_days_since_last_workout INTEGER;
  v_prompt_state TEXT := 'none';
  v_should_show_prompt BOOLEAN := FALSE;
  v_previous_pro_freezes INTEGER;
  v_last_earned_grant_at TIMESTAMPTZ;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to get streak status for this user'
      USING ERRCODE = '42501';
  END IF;

  PERFORM ensure_streak_protection_balance(p_user_id);

  SELECT subscription_tier, subscription_expires_at
    INTO v_tier, v_expires_at
    FROM profiles
   WHERE id = p_user_id;

  v_tier := COALESCE(v_tier, 'free');
  v_is_pro_active :=
    v_tier = 'pro' AND (v_expires_at IS NULL OR v_expires_at > NOW());

  SELECT
      lifetime_rescue_used_at,
      earned_freezes_available,
      pro_freezes_available,
      pro_freezes_granted_through_month,
      auto_apply_enabled,
      streak_restarted_at,
      last_prompt_dismissed_at,
      last_prompt_state
    INTO
      v_lifetime_rescue_used_at,
      v_earned_freezes,
      v_pro_freezes,
      v_granted_through_month,
      v_auto_apply_enabled,
      v_streak_restarted_at,
      v_last_prompt_dismissed_at,
      v_last_prompt_state
    FROM streak_protection_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  IF v_is_pro_active
     AND (v_granted_through_month IS NULL OR v_granted_through_month < v_month_start) THEN
    v_previous_pro_freezes := v_pro_freezes;
    v_pro_freezes := LEAST(3, v_pro_freezes + 1);
    v_granted_through_month := v_month_start;

    UPDATE streak_protection_balances
       SET pro_freezes_available = v_pro_freezes,
           pro_freezes_granted_through_month = v_granted_through_month
     WHERE user_id = p_user_id;

    IF v_pro_freezes > v_previous_pro_freezes THEN
      INSERT INTO streak_protection_events (user_id, event_type, metadata)
      VALUES (
        p_user_id,
        'pro_freeze_granted',
        jsonb_build_object('grant_month', v_month_start)
      );
    END IF;
  END IF;

  WITH qualifying_sessions AS (
    SELECT
      ws.completed_at,
      DATE_TRUNC('week', ws.completed_at)::DATE AS week_start
    FROM workout_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.status = 'completed'
      AND ws.completed_at IS NOT NULL
      AND (v_streak_restarted_at IS NULL OR ws.completed_at > v_streak_restarted_at)
      AND EXISTS (
        SELECT 1
        FROM session_exercises se
        JOIN session_sets ss ON ss.session_exercise_id = se.id
        JOIN set_logs sl ON sl.session_set_id = ss.id
        WHERE se.workout_session_id = ws.id
          AND sl.completed = TRUE
      )
  ),
  protected_weeks AS (
    SELECT spe.covered_week_start AS week_start
    FROM streak_protection_events spe
    WHERE spe.user_id = p_user_id
      AND spe.covered_week_start IS NOT NULL
      AND spe.event_type IN (
        'lifetime_rescue_used',
        'earned_freeze_used',
        'pro_freeze_used',
        'pro_auto_freeze_used'
      )
      AND (
        v_streak_restarted_at IS NULL
        OR spe.created_at > v_streak_restarted_at
      )
  ),
  active_weeks AS (
    SELECT week_start FROM qualifying_sessions
    UNION
    SELECT week_start FROM protected_weeks
  )
  SELECT
      COALESCE(ARRAY_AGG(DISTINCT week_start ORDER BY week_start), ARRAY[]::DATE[]),
      (SELECT MAX(completed_at) FROM qualifying_sessions)
    INTO v_active_weeks, v_last_workout_at
    FROM active_weeks;

  IF v_last_workout_at IS NOT NULL THEN
    v_days_since_last_workout :=
      GREATEST(FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_workout_at)) / 86400), 0)::INTEGER;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM UNNEST(v_active_weeks) AS active_week(week_start)
    WHERE active_week.week_start < v_candidate_week_start
  ) INTO v_has_prior_streak;

  v_needs_protection :=
    v_has_prior_streak
    AND NOT v_candidate_week_start = ANY(v_active_weeks);

  IF v_needs_protection THEN
    v_cursor := v_candidate_week_start;
    WHILE v_cursor >= v_candidate_week_start - 364 LOOP
      EXIT WHEN v_cursor = ANY(v_active_weeks);
      v_missed_weeks := v_missed_weeks + 1;
      v_cursor := v_cursor - 7;
    END LOOP;
  END IF;

  IF v_needs_protection
     AND v_is_pro_active
     AND v_auto_apply_enabled
     AND v_pro_freezes > 0 THEN
    v_cursor := v_candidate_week_start;

    WHILE v_cursor >= v_candidate_week_start - 364 AND v_pro_freezes > 0 LOOP
      EXIT WHEN v_cursor = ANY(v_active_weeks);

      IF NOT EXISTS (
        SELECT 1
        FROM streak_protection_events spe
        WHERE spe.user_id = p_user_id
          AND spe.covered_week_start = v_cursor
          AND spe.event_type IN (
            'lifetime_rescue_used',
            'earned_freeze_used',
            'pro_freeze_used',
            'pro_auto_freeze_used'
          )
      ) THEN
        v_pro_freezes := v_pro_freezes - 1;
        v_auto_applied := TRUE;
        v_active_weeks := ARRAY_APPEND(v_active_weeks, v_cursor);

        INSERT INTO streak_protection_events (
          user_id,
          event_type,
          covered_week_start,
          covered_week_end,
          metadata
        )
        VALUES (
          p_user_id,
          'pro_auto_freeze_used',
          v_cursor,
          v_cursor + 6,
          jsonb_build_object('remaining_pro_freezes', v_pro_freezes)
        );
      END IF;

      v_cursor := v_cursor - 7;
    END LOOP;

    IF v_auto_applied THEN
      UPDATE streak_protection_balances
         SET pro_freezes_available = v_pro_freezes
       WHERE user_id = p_user_id;

      SELECT COALESCE(
          ARRAY_AGG(DISTINCT active_week.week_start ORDER BY active_week.week_start),
          ARRAY[]::DATE[]
        )
        INTO v_active_weeks
        FROM UNNEST(v_active_weeks) AS active_week(week_start);
    END IF;
  END IF;

  v_cursor := v_current_week_start;
  IF NOT v_cursor = ANY(v_active_weeks) THEN
    v_cursor := v_cursor - 7;
  END IF;

  WHILE v_cursor = ANY(v_active_weeks) LOOP
    v_current_streak := v_current_streak + 1;
    v_cursor := v_cursor - 7;
  END LOOP;

  v_previous_week := NULL;
  FOREACH v_week IN ARRAY v_active_weeks LOOP
    IF v_previous_week IS NULL OR v_week = v_previous_week + 7 THEN
      v_running_streak := v_running_streak + 1;
    ELSE
      v_running_streak := 1;
    END IF;

    v_longest_streak := GREATEST(v_longest_streak, v_running_streak);
    v_previous_week := v_week;
  END LOOP;

  IF NOT v_is_pro_active AND v_current_streak >= 4 AND v_earned_freezes < 1 THEN
    SELECT MAX(created_at)
      INTO v_last_earned_grant_at
      FROM streak_protection_events
     WHERE user_id = p_user_id
       AND event_type = 'earned_freeze_granted';

    IF v_last_earned_grant_at IS NULL
       OR v_last_earned_grant_at < NOW() - INTERVAL '28 days' THEN
      v_earned_freezes := 1;

      UPDATE streak_protection_balances
         SET earned_freezes_available = v_earned_freezes
       WHERE user_id = p_user_id;

      INSERT INTO streak_protection_events (
        user_id,
        event_type,
        streak_weeks_after,
        metadata
      )
      VALUES (
        p_user_id,
        'earned_freeze_granted',
        v_current_streak,
        jsonb_build_object('earned_after_weeks', v_current_streak)
      );
    END IF;
  END IF;

  IF v_auto_applied THEN
    v_prompt_state := 'pro_auto_applied';
  ELSIF v_last_workout_at IS NULL THEN
    v_prompt_state := 'none';
  ELSIF v_needs_protection AND v_is_pro_active AND v_pro_freezes > 0 THEN
    v_prompt_state := 'pro_available_freeze';
  ELSIF v_needs_protection AND v_is_pro_active THEN
    v_prompt_state := 'pro_comeback';
  ELSIF v_needs_protection AND v_earned_freezes > 0 THEN
    v_prompt_state := 'free_earned_freeze';
  ELSIF v_needs_protection AND v_lifetime_rescue_used_at IS NULL THEN
    v_prompt_state := 'free_lifetime_rescue';
  ELSIF v_needs_protection THEN
    v_prompt_state := 'free_comeback';
  ELSIF v_days_since_last_workout >= 8 THEN
    v_prompt_state := 'at_risk';
  ELSE
    v_prompt_state := 'none';
  END IF;

  v_should_show_prompt :=
    v_prompt_state <> 'none'
    AND NOT (
      v_last_prompt_state = v_prompt_state
      AND v_last_prompt_dismissed_at IS NOT NULL
      AND v_last_prompt_dismissed_at > NOW() - INTERVAL '3 days'
    );

  RETURN QUERY
  SELECT
    v_tier,
    v_is_pro_active,
    v_current_streak,
    v_longest_streak,
    v_last_workout_at,
    v_days_since_last_workout,
    v_missed_weeks,
    v_earned_freezes,
    v_pro_freezes,
    v_lifetime_rescue_used_at IS NULL,
    v_auto_apply_enabled,
    v_prompt_state,
    v_should_show_prompt,
    CASE WHEN v_needs_protection OR v_auto_applied THEN v_candidate_week_start ELSE NULL END,
    CASE WHEN v_needs_protection OR v_auto_applied THEN v_candidate_week_start + 6 ELSE NULL END;
END;
$$;

-- ============================================================
-- RPC: apply_streak_protection
-- ============================================================

CREATE OR REPLACE FUNCTION apply_streak_protection(
  p_user_id UUID,
  p_protection_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_auth_uid UUID := auth.uid();
  v_tier TEXT;
  v_expires_at TIMESTAMPTZ;
  v_is_pro_active BOOLEAN;
  v_candidate_week_start DATE := (DATE_TRUNC('week', NOW())::DATE - 7);
  v_lifetime_rescue_used_at TIMESTAMPTZ;
  v_earned_freezes INTEGER;
  v_pro_freezes INTEGER;
  v_streak_restarted_at TIMESTAMPTZ;
  v_active_weeks DATE[] := ARRAY[]::DATE[];
  v_has_prior_streak BOOLEAN := FALSE;
  v_event_type TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_protection_type NOT IN ('lifetime_rescue', 'earned_freeze', 'pro_freeze') THEN
    RAISE EXCEPTION 'invalid protection type' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to apply streak protection for this user'
      USING ERRCODE = '42501';
  END IF;

  PERFORM ensure_streak_protection_balance(p_user_id);

  SELECT subscription_tier, subscription_expires_at
    INTO v_tier, v_expires_at
    FROM profiles
   WHERE id = p_user_id;

  v_is_pro_active :=
    v_tier = 'pro' AND (v_expires_at IS NULL OR v_expires_at > NOW());

  SELECT
      lifetime_rescue_used_at,
      earned_freezes_available,
      pro_freezes_available,
      streak_restarted_at
    INTO
      v_lifetime_rescue_used_at,
      v_earned_freezes,
      v_pro_freezes,
      v_streak_restarted_at
    FROM streak_protection_balances
   WHERE user_id = p_user_id
   FOR UPDATE;

  WITH qualifying_weeks AS (
    SELECT DATE_TRUNC('week', ws.completed_at)::DATE AS week_start
    FROM workout_sessions ws
    WHERE ws.user_id = p_user_id
      AND ws.status = 'completed'
      AND ws.completed_at IS NOT NULL
      AND (v_streak_restarted_at IS NULL OR ws.completed_at > v_streak_restarted_at)
      AND EXISTS (
        SELECT 1
        FROM session_exercises se
        JOIN session_sets ss ON ss.session_exercise_id = se.id
        JOIN set_logs sl ON sl.session_set_id = ss.id
        WHERE se.workout_session_id = ws.id
          AND sl.completed = TRUE
      )
    UNION
    SELECT spe.covered_week_start
    FROM streak_protection_events spe
    WHERE spe.user_id = p_user_id
      AND spe.covered_week_start IS NOT NULL
      AND spe.event_type IN (
        'lifetime_rescue_used',
        'earned_freeze_used',
        'pro_freeze_used',
        'pro_auto_freeze_used'
      )
      AND (
        v_streak_restarted_at IS NULL
        OR spe.created_at > v_streak_restarted_at
      )
  )
  SELECT COALESCE(ARRAY_AGG(DISTINCT week_start ORDER BY week_start), ARRAY[]::DATE[])
    INTO v_active_weeks
    FROM qualifying_weeks;

  SELECT EXISTS (
    SELECT 1 FROM UNNEST(v_active_weeks) AS active_week(week_start)
    WHERE active_week.week_start < v_candidate_week_start
  ) INTO v_has_prior_streak;

  IF NOT v_has_prior_streak OR v_candidate_week_start = ANY(v_active_weeks) THEN
    RAISE EXCEPTION 'no missed streak week is eligible for protection'
      USING ERRCODE = '22023';
  END IF;

  IF p_protection_type = 'lifetime_rescue' THEN
    IF v_lifetime_rescue_used_at IS NOT NULL THEN
      RAISE EXCEPTION 'lifetime rescue has already been used'
        USING ERRCODE = '22023';
    END IF;

    v_event_type := 'lifetime_rescue_used';

    UPDATE streak_protection_balances
       SET lifetime_rescue_used_at = NOW()
     WHERE user_id = p_user_id;
  ELSIF p_protection_type = 'earned_freeze' THEN
    IF v_earned_freezes <= 0 THEN
      RAISE EXCEPTION 'no earned freeze is available'
        USING ERRCODE = '22023';
    END IF;

    v_event_type := 'earned_freeze_used';

    UPDATE streak_protection_balances
       SET earned_freezes_available = earned_freezes_available - 1
     WHERE user_id = p_user_id;
  ELSE
    IF NOT v_is_pro_active OR v_pro_freezes <= 0 THEN
      RAISE EXCEPTION 'no pro freeze is available'
        USING ERRCODE = '22023';
    END IF;

    v_event_type := 'pro_freeze_used';

    UPDATE streak_protection_balances
       SET pro_freezes_available = pro_freezes_available - 1
     WHERE user_id = p_user_id;
  END IF;

  INSERT INTO streak_protection_events (
    user_id,
    event_type,
    covered_week_start,
    covered_week_end,
    metadata
  )
  VALUES (
    p_user_id,
    v_event_type,
    v_candidate_week_start,
    v_candidate_week_start + 6,
    jsonb_build_object('protection_type', p_protection_type)
  );
END;
$$;

-- ============================================================
-- RPC: dismiss_streak_prompt
-- ============================================================

CREATE OR REPLACE FUNCTION dismiss_streak_prompt(
  p_user_id UUID,
  p_prompt_state TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_auth_uid UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to dismiss streak prompt for this user'
      USING ERRCODE = '42501';
  END IF;

  PERFORM ensure_streak_protection_balance(p_user_id);

  UPDATE streak_protection_balances
     SET last_prompt_dismissed_at = NOW(),
         last_prompt_state = p_prompt_state
   WHERE user_id = p_user_id;

  INSERT INTO streak_protection_events (user_id, event_type, metadata)
  VALUES (
    p_user_id,
    'prompt_dismissed',
    jsonb_build_object('prompt_state', p_prompt_state)
  );
END;
$$;

-- ============================================================
-- RPC: restart_streak
-- ============================================================

CREATE OR REPLACE FUNCTION restart_streak(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_auth_uid UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to restart streak for this user'
      USING ERRCODE = '42501';
  END IF;

  PERFORM ensure_streak_protection_balance(p_user_id);

  UPDATE streak_protection_balances
     SET streak_restarted_at = NOW(),
         last_prompt_dismissed_at = NOW(),
         last_prompt_state = 'none'
   WHERE user_id = p_user_id;

  INSERT INTO streak_protection_events (user_id, event_type)
  VALUES (p_user_id, 'streak_restarted');
END;
$$;

-- ============================================================
-- RPC: record_comeback_event
-- ============================================================

CREATE OR REPLACE FUNCTION record_comeback_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_auth_uid UUID := auth.uid();
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required' USING ERRCODE = '22023';
  END IF;

  IF p_event_type NOT IN ('comeback_started', 'comeback_completed') THEN
    RAISE EXCEPTION 'invalid comeback event type' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (v_auth_uid IS NULL OR v_auth_uid <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to record comeback event for this user'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO streak_protection_events (user_id, event_type, metadata)
  VALUES (p_user_id, p_event_type, COALESCE(p_metadata, '{}'::JSONB));
END;
$$;

REVOKE EXECUTE ON FUNCTION ensure_streak_protection_balance(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ensure_streak_protection_balance(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION get_streak_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_streak_status(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION apply_streak_protection(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION apply_streak_protection(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION dismiss_streak_prompt(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION dismiss_streak_prompt(UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION restart_streak(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION restart_streak(UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION record_comeback_event(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION record_comeback_event(UUID, TEXT, JSONB) TO authenticated, service_role;
