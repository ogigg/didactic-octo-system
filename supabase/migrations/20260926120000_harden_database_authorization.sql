-- Security batch A (SWE-205): close profile privilege escalation and
-- database authorization gaps found in the 2026-09-26 audit.
--
-- Supabase grants anon/authenticated full table DML and EXECUTE on every new
-- public function through default privileges, so RLS policies and explicit
-- REVOKEs are the only boundary. `REVOKE ... FROM PUBLIC` alone does not
-- remove those role-specific grants.

-- ---------------------------------------------------------------------------
-- 1. Server-owned profile fields
-- ---------------------------------------------------------------------------
-- profiles_insert_own/profiles_update_own let a user write any column of
-- their own row, including is_admin and subscription state. This guard
-- rejects direct anon/authenticated writes that change server-owned fields on
-- INSERT, upsert and UPDATE. It is SECURITY INVOKER on purpose: SECURITY
-- DEFINER RPCs (complete_onboarding, claim_queue_generation,
-- request_account_deletion, ...) run as their owner, and service_role or SQL
-- sessions keep full control, so current_user identifies a direct caller.
-- It supersedes guard_queue_generation_state, which only covered UPDATE.

CREATE OR REPLACE FUNCTION public.guard_profile_server_owned_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_baseline public.profiles%ROWTYPE;
  v_changed TEXT[];
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_baseline := OLD;
  ELSE
    -- An upsert on an existing row compares with that row, so echoing the
    -- current values is allowed; a new row must carry the column defaults.
    SELECT * INTO v_baseline FROM public.profiles WHERE id = NEW.id;
    IF NOT FOUND THEN
      v_baseline.is_admin := FALSE;
      v_baseline.subscription_tier := 'free';
    END IF;
  END IF;

  v_changed := array_remove(ARRAY[
    CASE WHEN NEW.is_admin IS DISTINCT FROM v_baseline.is_admin
      THEN 'is_admin' END,
    CASE WHEN NEW.subscription_tier IS DISTINCT FROM v_baseline.subscription_tier
      THEN 'subscription_tier' END,
    CASE WHEN NEW.subscription_expires_at IS DISTINCT FROM v_baseline.subscription_expires_at
      THEN 'subscription_expires_at' END,
    CASE WHEN NEW.revenuecat_customer_id IS DISTINCT FROM v_baseline.revenuecat_customer_id
      THEN 'revenuecat_customer_id' END,
    CASE WHEN NEW.deletion_scheduled_at IS DISTINCT FROM v_baseline.deletion_scheduled_at
      THEN 'deletion_scheduled_at' END,
    CASE WHEN NEW.initial_queue_generated_at IS DISTINCT FROM v_baseline.initial_queue_generated_at
      THEN 'initial_queue_generated_at' END,
    CASE WHEN NEW.queue_generation_request_id IS DISTINCT FROM v_baseline.queue_generation_request_id
      THEN 'queue_generation_request_id' END,
    CASE WHEN NEW.queue_generation_started_at IS DISTINCT FROM v_baseline.queue_generation_started_at
      THEN 'queue_generation_started_at' END
  ], NULL);

  IF cardinality(v_changed) > 0 THEN
    RAISE EXCEPTION 'profile fields are server managed: %',
      array_to_string(v_changed, ', ')
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_profile_server_owned_fields() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_queue_generation_state_guard ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_queue_generation_state();

CREATE TRIGGER profiles_server_owned_fields_guard
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_server_owned_fields();

-- ---------------------------------------------------------------------------
-- 2. Workout session detail: explicit NULL semantics
-- ---------------------------------------------------------------------------
-- `v_user_id != auth.uid()` is NULL for anonymous callers, so the old guard
-- let anon read any session by UUID. Owners and the service-role
-- generate-next-workout path remain allowed.

CREATE OR REPLACE FUNCTION public.get_workout_session_detail(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result  JSONB;
  v_user_id UUID;
  v_caller  UUID := auth.uid();
BEGIN
  SELECT ws.user_id INTO v_user_id
  FROM public.workout_sessions ws
  WHERE ws.id = p_session_id;

  IF v_user_id IS NULL
     OR (
       COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
       AND (v_caller IS NULL OR v_caller <> v_user_id)
     ) THEN
    RAISE EXCEPTION 'Not found or not authorized';
  END IF;

  SELECT jsonb_build_object(
    'id',                ws.id,
    'name',              ws.name,
    'status',            ws.status,
    'generation_source', ws.generation_source,
    'goal_snapshot',     ws.goal_snapshot,
    'started_at',        ws.started_at,
    'completed_at',      ws.completed_at,
    'created_at',        ws.created_at,
    'warmup', CASE
      WHEN ws.warmup_duration_seconds IS NULL THEN NULL
      ELSE jsonb_build_object(
        'duration_seconds', ws.warmup_duration_seconds,
        'completed',        ws.warmup_completed
      )
    END,
    'exercises', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                   se.id,
          'exercise_id',          se.exercise_id,
          'exercise_name',        e.name,
          'exercise_type',        e.exercise_type,
          'primary_muscles',      e.primary_muscles,
          'order_index',          se.order_index,
          'rest_duration_seconds',se.rest_duration_seconds,
          'notes',                se.notes,
          'difficulty_feedback',  se.difficulty_feedback,
          'sets', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',                     ss.id,
                'set_number',             ss.set_number,
                'set_type',               ss.set_type,
                'target_load_kg',         ss.target_load_kg,
                'target_reps',            ss.target_reps,
                'target_duration_seconds',ss.target_duration_seconds,
                'log', (
                  SELECT jsonb_build_object(
                    'id',                    sl.id,
                    'actual_load_kg',        sl.actual_load_kg,
                    'actual_reps',           sl.actual_reps,
                    'actual_duration_seconds', sl.actual_duration_seconds,
                    'rpe',                   sl.rpe,
                    'completed',             sl.completed,
                    'not_completed_reason',  sl.not_completed_reason
                  )
                  FROM public.set_logs sl
                  WHERE sl.session_set_id = ss.id
                  ORDER BY sl.created_at DESC
                  LIMIT 1
                )
              ) ORDER BY ss.set_number
            )
            FROM public.session_sets ss
            WHERE ss.session_exercise_id = se.id
          ), '[]'::jsonb)
        ) ORDER BY se.order_index
      )
      FROM public.session_exercises se
      JOIN public.exercises e ON e.id = se.exercise_id
      WHERE se.workout_session_id = ws.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.workout_sessions ws
  WHERE ws.id = p_session_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_workout_session_detail(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_workout_session_detail(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Session comments may only reference the caller's own session
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS wsc_insert_own ON public.workout_session_comments;

CREATE POLICY wsc_insert_own ON public.workout_session_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.workout_sessions ws
      WHERE ws.id = workout_session_id
        AND ws.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Body measurement date move
-- ---------------------------------------------------------------------------
-- The old (uuid, text, text) overload compared the DATE column with TEXT, so
-- every call failed, and it would have let any caller move any user's rows.
-- The replacement takes real dates, runs as the caller (RLS still applies)
-- and rejects moving somebody else's measurements.

DROP FUNCTION IF EXISTS public.update_body_measurement_date(UUID, TEXT, TEXT);

CREATE FUNCTION public.update_body_measurement_date(
  p_user_id UUID,
  p_old_logged_at DATE,
  p_new_logged_at DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_old_logged_at IS NULL OR p_new_logged_at IS NULL THEN
    RAISE EXCEPTION 'user and dates are required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to update measurements for this user'
      USING ERRCODE = '42501';
  END IF;

  IF p_old_logged_at = p_new_logged_at THEN
    RETURN;
  END IF;

  UPDATE public.body_measurements
  SET logged_at = p_new_logged_at,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND logged_at = p_old_logged_at;
END;
$$;

REVOKE ALL ON FUNCTION public.update_body_measurement_date(UUID, DATE, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_body_measurement_date(UUID, DATE, DATE) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Service-only and maintenance routines
-- ---------------------------------------------------------------------------

-- Hard-deletes auth users. pg_cron runs it as postgres and the
-- purge-expired-deletions Edge Function calls it with the service role.
REVOKE ALL ON FUNCTION public.purge_expired_deletions() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_deletions() TO service_role;

-- Reads auth.users/auth.identities by email. Only the login-provider-hint
-- Edge Function may call it, with the service role; direct anon calls
-- allowed unthrottled account enumeration.
ALTER FUNCTION public.get_login_provider_hint(TEXT) SET search_path = '';
REVOKE ALL ON FUNCTION public.get_login_provider_hint(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_provider_hint(TEXT) TO service_role;

-- Trigger functions are never called through PostgREST. Trigger firing does
-- not check EXECUTE, so these revokes only remove the direct RPC surface.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.notify_workout_completed() SET search_path = '';
REVOKE ALL ON FUNCTION public.notify_workout_completed() FROM PUBLIC, anon, authenticated;

-- User-scoped RPCs resolve the caller from auth.uid(); anonymous callers
-- have no legitimate use for them. Account deletion was meant to be
-- authenticated-only already (20260421000000).
REVOKE ALL ON FUNCTION public.request_account_deletion(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(INTEGER) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.cancel_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Explicit search_path for the remaining SECURITY DEFINER routines
-- ---------------------------------------------------------------------------
-- These bodies reference public objects unqualified, so they pin `public`
-- and move pg_temp last instead of inheriting the caller's search_path.
-- Defense in depth: no exploit through these functions was demonstrated.

ALTER FUNCTION public.get_exercise_detail(UUID) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_latest_measurements() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_localized_catalog_labels(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_localized_exercise(UUID, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_localized_exercise_filter_options(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_localized_exercises(TEXT, TEXT, TEXT[], TEXT[], UUID[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_measurement_history(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_measurement_trend(TEXT, TIMESTAMPTZ) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_stats_heatmap() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_stats_muscle_distribution(TIMESTAMPTZ) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_stats_volume_over_time(TIMESTAMPTZ) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_workout_history_for_day_range(TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public, pg_temp;
ALTER FUNCTION public.get_workout_history_page(INTEGER, TIMESTAMPTZ) SET search_path = public, pg_temp;
ALTER FUNCTION public.localized_label_array(TEXT, TEXT[], TEXT) SET search_path = public, pg_temp;
