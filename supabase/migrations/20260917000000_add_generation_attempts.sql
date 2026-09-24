-- Durable generation attempts and fenced regeneration recovery.

CREATE TABLE public.generation_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Deliberately not an FK: queue workers may trace a UUID before inserting its row.
  pending_workout_id UUID,
  function_name TEXT NOT NULL,
  trigger TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded', 'succeeded_with_fallback', 'rejected', 'failed', 'timed_out')),
  stage TEXT NOT NULL DEFAULT 'authentication',
  stages JSONB NOT NULL DEFAULT '[]'::JSONB
    CHECK (jsonb_typeof(stages) = 'array'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  generation_source TEXT,
  fallback_reason TEXT,
  error_code TEXT,
  error_message TEXT,
  final_output JSONB
);

CREATE UNIQUE INDEX generation_attempts_parent_request_idx
  ON public.generation_attempts(user_id, request_id)
  WHERE pending_workout_id IS NULL;
CREATE UNIQUE INDEX generation_attempts_child_request_idx
  ON public.generation_attempts(user_id, request_id, pending_workout_id)
  WHERE pending_workout_id IS NOT NULL;

CREATE INDEX generation_attempts_user_started_idx
  ON public.generation_attempts(user_id, started_at DESC);
CREATE INDEX generation_attempts_pending_running_idx
  ON public.generation_attempts(pending_workout_id)
  WHERE status = 'running' AND pending_workout_id IS NOT NULL;

ALTER TABLE public.generation_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY generation_attempts_select_admin
  ON public.generation_attempts FOR SELECT TO authenticated
  USING (public.is_admin());
CREATE POLICY generation_attempts_service_write
  ON public.generation_attempts FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.pending_workouts
  ADD COLUMN IF NOT EXISTS generation_attempt_id UUID
    REFERENCES public.generation_attempts(id) ON DELETE SET NULL;

CREATE INDEX pending_workouts_generation_attempt_idx
  ON public.pending_workouts(generation_attempt_id)
  WHERE generation_attempt_id IS NOT NULL;

ALTER TABLE public.llm_generation_logs
  ADD COLUMN IF NOT EXISTS attempt_id UUID REFERENCES public.generation_attempts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE INDEX llm_generation_logs_attempt_idx
  ON public.llm_generation_logs(attempt_id)
  WHERE attempt_id IS NOT NULL;
CREATE INDEX llm_generation_logs_request_idx
  ON public.llm_generation_logs(request_id)
  WHERE request_id IS NOT NULL;

-- SECURITY DEFINER recovery may release the older profile lease through the
-- existing server-managed-state guard without opening ordinary user updates.
CREATE OR REPLACE FUNCTION public.guard_queue_generation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') = 'authenticated'
     AND current_setting('app.generation_recovery', true) IS DISTINCT FROM 'on'
     AND (
       NEW.initial_queue_generated_at IS DISTINCT FROM OLD.initial_queue_generated_at
       OR NEW.queue_generation_request_id IS DISTINCT FROM OLD.queue_generation_request_id
       OR NEW.queue_generation_started_at IS DISTINCT FROM OLD.queue_generation_started_at
     ) THEN
    RAISE EXCEPTION 'generation state is server managed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_generation_attempt_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER generation_attempts_updated_at
  BEFORE UPDATE ON public.generation_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_generation_attempt_updated_at();

-- Claim is idempotent on (user, request_id), serializes the same pending slot,
-- and takes the pending row lock before changing its state.
CREATE OR REPLACE FUNCTION public.claim_generation_attempt(
  p_user_id UUID,
  p_request_id UUID,
  p_pending_workout_id UUID DEFAULT NULL,
  p_function_name TEXT DEFAULT 'generate-workout',
  p_trigger TEXT DEFAULT 'immediate'
)
RETURNS TABLE (
  status TEXT,
  attempt_id UUID,
  request_id UUID,
  pending_workout_id UUID,
  queue_position INTEGER,
  regeneration_count INTEGER,
  regeneration_feedback JSONB,
  last_regenerated_at TIMESTAMPTZ,
  workout_data JSONB,
  pending_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_existing public.generation_attempts%ROWTYPE;
  v_attempt public.generation_attempts%ROWTYPE;
  v_pending public.pending_workouts%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'user and request ids are required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'generation claims are service managed' USING ERRCODE = '42501';
  END IF;
  IF p_function_name IS NULL OR p_function_name = '' OR p_trigger IS NULL OR p_trigger = '' THEN
    RAISE EXCEPTION 'function name and trigger are required' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  SELECT * INTO v_existing
  FROM public.generation_attempts AS ga
  WHERE ga.user_id = p_user_id AND ga.request_id = p_request_id
    AND ga.pending_workout_id IS NOT DISTINCT FROM p_pending_workout_id
  FOR UPDATE;
  IF FOUND THEN
    RETURN QUERY SELECT
      CASE WHEN v_existing.status = 'running' THEN 'in_progress' ELSE 'already_finished' END,
      v_existing.id, v_existing.request_id, v_existing.pending_workout_id,
      NULL::INTEGER, NULL::INTEGER, NULL::JSONB, NULL::TIMESTAMPTZ, NULL::JSONB, NULL::TEXT;
    RETURN;
  END IF;

  IF p_trigger = 'regeneration' AND p_pending_workout_id IS NOT NULL THEN
    SELECT * INTO v_pending
    FROM public.pending_workouts
    WHERE id = p_pending_workout_id AND user_id = p_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pending workout not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_pending.generation_attempt_id IS NOT NULL THEN
      SELECT * INTO v_existing
      FROM public.generation_attempts
      WHERE id = v_pending.generation_attempt_id
      FOR UPDATE;
      IF FOUND AND v_existing.status = 'running' THEN
        RETURN QUERY SELECT
          'rejected'::TEXT, v_existing.id, v_existing.request_id, v_existing.pending_workout_id,
          v_pending.queue_position, v_pending.regeneration_count, v_pending.regeneration_feedback,
          v_pending.last_regenerated_at, v_pending.workout_data, v_pending.status;
        RETURN;
      END IF;
    END IF;

    IF v_pending.status = 'regenerating' THEN
      INSERT INTO public.generation_attempts (
        request_id, user_id, pending_workout_id, function_name, trigger,
        status, stage, finished_at, error_code, error_message
      )
      VALUES (
        p_request_id, p_user_id, p_pending_workout_id, p_function_name, p_trigger,
        'rejected', 'claim', now(), 'concurrent_generation',
        'A generation is already in progress for this workout'
      )
      RETURNING * INTO v_attempt;
      RETURN QUERY SELECT
        'rejected'::TEXT, v_attempt.id, v_attempt.request_id, p_pending_workout_id,
        v_pending.queue_position, v_pending.regeneration_count, v_pending.regeneration_feedback,
        v_pending.last_regenerated_at, v_pending.workout_data, v_pending.status;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.generation_attempts (
    request_id, user_id, pending_workout_id, function_name, trigger
  )
  VALUES (p_request_id, p_user_id, p_pending_workout_id, p_function_name, p_trigger)
  RETURNING * INTO v_attempt;

  IF p_trigger = 'regeneration' AND p_pending_workout_id IS NOT NULL THEN
    UPDATE public.pending_workouts
    SET status = 'regenerating', generation_attempt_id = v_attempt.id
    WHERE id = p_pending_workout_id AND user_id = p_user_id;
  END IF;

  RETURN QUERY SELECT
    'claimed'::TEXT, v_attempt.id, v_attempt.request_id, v_attempt.pending_workout_id,
    v_pending.queue_position, v_pending.regeneration_count, v_pending.regeneration_feedback,
    v_pending.last_regenerated_at, v_pending.workout_data, v_pending.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_generation_attempt_stage(
  p_attempt_id UUID,
  p_stage TEXT,
  p_started_at TIMESTAMPTZ,
  p_duration_ms INTEGER DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  IF p_attempt_id IS NULL OR p_stage IS NULL OR p_stage = '' THEN
    RAISE EXCEPTION 'attempt id and stage are required' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'generation stages are service managed' USING ERRCODE = '42501';
  END IF;
  SELECT user_id INTO STRICT v_user_id FROM public.generation_attempts WHERE id = p_attempt_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));

  UPDATE public.generation_attempts
  SET stage = p_stage,
      stages = CASE
        WHEN jsonb_array_length(stages) = 0 THEN stages
        ELSE jsonb_set(
          stages,
          ARRAY[(jsonb_array_length(stages) - 1)::TEXT, 'duration_ms'],
          to_jsonb(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ((stages -> -1) ->> 'started_at')::TIMESTAMPTZ)) * 1000)::INTEGER))
        )
      END || jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object(
          'stage', p_stage,
          'started_at', COALESCE(p_started_at, now()),
          'details', p_details
        ))
      )
  WHERE id = p_attempt_id AND status = 'running';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_generation_attempt(
  p_attempt_id UUID,
  p_user_id UUID,
  p_status TEXT,
  p_generation_source TEXT DEFAULT NULL,
  p_fallback_reason TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_final_output JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_attempt_user_id UUID;
BEGIN
  IF p_attempt_id IS NULL OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'attempt and user ids are required' USING ERRCODE = '22023';
  END IF;
  IF p_status NOT IN ('succeeded', 'succeeded_with_fallback', 'rejected', 'failed', 'timed_out') THEN
    RAISE EXCEPTION 'invalid generation attempt status' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'generation attempts are service managed' USING ERRCODE = '42501';
  END IF;
  SELECT user_id INTO STRICT v_attempt_user_id FROM public.generation_attempts WHERE id = p_attempt_id;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_attempt_user_id::TEXT, 0));

  -- Failure and rejection own the rollback boundary. This keeps a crash
  -- between finishing the attempt and restoring the slot from stranding it.
  IF p_status IN ('rejected', 'failed', 'timed_out') THEN
    UPDATE public.pending_workouts
    SET status = CASE WHEN workout_data IS NOT NULL THEN 'ready' ELSE 'failed' END,
        generation_attempt_id = NULL
    WHERE generation_attempt_id = p_attempt_id
      AND user_id = p_user_id
      AND status IN ('queued', 'generating', 'regenerating')
      AND EXISTS (
        SELECT 1 FROM public.generation_attempts AS running_attempt
        WHERE running_attempt.id = p_attempt_id
          AND running_attempt.user_id = p_user_id
          AND running_attempt.status = 'running'
      );
  END IF;

  UPDATE public.generation_attempts
  SET status = p_status,
      stages = CASE
        WHEN jsonb_array_length(stages) = 0 THEN stages
        ELSE jsonb_set(
          stages,
          ARRAY[(jsonb_array_length(stages) - 1)::TEXT, 'duration_ms'],
          to_jsonb(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ((stages -> -1) ->> 'started_at')::TIMESTAMPTZ)) * 1000)::INTEGER))
        )
      END,
      finished_at = now(),
      duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INTEGER),
      generation_source = p_generation_source,
      fallback_reason = p_fallback_reason,
      error_code = p_error_code,
      error_message = p_error_message,
      final_output = p_final_output
  WHERE id = p_attempt_id AND user_id = p_user_id AND status = 'running'
  RETURNING started_at INTO v_started_at;
  RETURN FOUND;
END;
$$;

-- Save a regenerated workout and finish its attempt in one transaction. The
-- attempt and pending-row predicates fence late responses after recovery.
CREATE OR REPLACE FUNCTION public.complete_regeneration_attempt(
  p_attempt_id UUID,
  p_user_id UUID,
  p_pending_workout_id UUID,
  p_workout_data JSONB,
  p_generation_source TEXT,
  p_regeneration_count INTEGER,
  p_regeneration_feedback JSONB,
  p_last_regenerated_at TIMESTAMPTZ,
  p_final_output JSONB DEFAULT NULL,
  p_fallback_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.generation_attempts%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'regeneration is service managed' USING ERRCODE = '42501';
  END IF;
  IF p_workout_data IS NULL OR jsonb_typeof(p_workout_data) <> 'object' THEN
    RAISE EXCEPTION 'workout data must be a JSON object' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  SELECT * INTO v_attempt
  FROM public.generation_attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'running'
     OR v_attempt.pending_workout_id IS DISTINCT FROM p_pending_workout_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.pending_workouts
  SET workout_data = p_workout_data,
      generation_source = p_generation_source,
      status = 'ready',
      generation_attempt_id = NULL,
      user_edits = NULL,
      last_regenerated_at = p_last_regenerated_at,
      regeneration_count = p_regeneration_count,
      regeneration_feedback = COALESCE(p_regeneration_feedback, '[]'::JSONB),
      generated_at = p_last_regenerated_at
  WHERE id = p_pending_workout_id
    AND user_id = p_user_id
    AND generation_attempt_id = p_attempt_id
    AND status = 'regenerating';
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.generation_attempts
  SET status = CASE WHEN p_generation_source = 'llm' THEN 'succeeded' ELSE 'succeeded_with_fallback' END,
        finished_at = now(),
        duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INTEGER),
        stage = 'saved',
        stages = CASE
          WHEN jsonb_array_length(stages) = 0 THEN stages
          ELSE jsonb_set(
            stages,
            ARRAY[(jsonb_array_length(stages) - 1)::TEXT, 'duration_ms'],
            to_jsonb(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ((stages -> -1) ->> 'started_at')::TIMESTAMPTZ)) * 1000)::INTEGER))
          )
        END || jsonb_build_array(jsonb_build_object(
          'stage', 'saved', 'started_at', now(), 'duration_ms', 0,
          'details', jsonb_build_object('pending_workout_id', p_pending_workout_id)
        )),
      generation_source = p_generation_source,
      fallback_reason = p_fallback_reason,
      final_output = p_final_output
  WHERE id = p_attempt_id AND status = 'running';
  RETURN FOUND;
END;
$$;

-- Commit a generated row for queue/auto-completion workers. The same fence is
-- used as regeneration, while regeneration-specific counters remain untouched.
CREATE OR REPLACE FUNCTION public.complete_pending_workout_attempt(
  p_attempt_id UUID,
  p_user_id UUID,
  p_pending_workout_id UUID,
  p_workout_data JSONB,
  p_generation_source TEXT,
  p_final_output JSONB DEFAULT NULL,
  p_fallback_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempt public.generation_attempts%ROWTYPE;
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'generation is service managed' USING ERRCODE = '42501';
  END IF;
  IF p_workout_data IS NULL OR jsonb_typeof(p_workout_data) <> 'object' THEN
    RAISE EXCEPTION 'workout data must be a JSON object' USING ERRCODE = '22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT, 0));

  SELECT * INTO v_attempt
  FROM public.generation_attempts
  WHERE id = p_attempt_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_attempt.status <> 'running'
     OR v_attempt.pending_workout_id IS DISTINCT FROM p_pending_workout_id THEN
    RETURN FALSE;
  END IF;

  UPDATE public.pending_workouts
  SET workout_data = p_workout_data,
      generation_source = p_generation_source,
      status = 'ready',
      generation_attempt_id = NULL,
      user_edits = NULL,
      generated_at = now()
  WHERE id = p_pending_workout_id
    AND user_id = p_user_id
    AND generation_attempt_id = p_attempt_id
    AND status IN ('generating', 'regenerating');
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  UPDATE public.generation_attempts
  SET status = CASE WHEN p_generation_source = 'llm' THEN 'succeeded' ELSE 'succeeded_with_fallback' END,
        finished_at = now(),
        duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INTEGER),
        stage = 'saved',
        stages = CASE
          WHEN jsonb_array_length(stages) = 0 THEN stages
          ELSE jsonb_set(
            stages,
            ARRAY[(jsonb_array_length(stages) - 1)::TEXT, 'duration_ms'],
            to_jsonb(GREATEST(0, (EXTRACT(EPOCH FROM (now() - ((stages -> -1) ->> 'started_at')::TIMESTAMPTZ)) * 1000)::INTEGER))
          )
        END || jsonb_build_array(jsonb_build_object(
          'stage', 'saved', 'started_at', now(), 'duration_ms', 0,
          'details', jsonb_build_object('pending_workout_id', p_pending_workout_id)
        )),
      generation_source = p_generation_source,
      fallback_reason = p_fallback_reason,
      final_output = p_final_output
  WHERE id = p_attempt_id AND status = 'running';
  RETURN FOUND;
END;
$$;

-- Recover both durable attempts and legacy rows that predate generation_attempt_id.
CREATE OR REPLACE FUNCTION public.recover_stale_generation_attempts(p_user_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
  v_user UUID := auth.uid();
  v_count INTEGER := 0;
  v_legacy_count INTEGER := 0;
  v_row RECORD;
  v_locked_attempt RECORD;
  v_status TEXT;
  v_previous_recovery TEXT := current_setting('app.generation_recovery', true);
BEGIN
  IF COALESCE(v_role, '') NOT IN ('service_role', 'authenticated') THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NOT NULL AND v_role <> 'service_role'
     AND p_user_id <> v_user AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'not allowed to recover attempts for this user' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL AND v_role = 'authenticated' AND NOT public.is_admin() THEN
    p_user_id := v_user;
  END IF;

  FOR v_row IN
    SELECT id, user_id FROM public.generation_attempts
    WHERE status = 'running'
      AND updated_at < now() - INTERVAL '5 minutes'
      AND (p_user_id IS NULL OR user_id = p_user_id)
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(v_row.user_id::TEXT, 0));
    SELECT * INTO v_locked_attempt
    FROM public.generation_attempts
    WHERE id = v_row.id
      AND status = 'running'
      AND updated_at < now() - INTERVAL '5 minutes'
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;
    v_status := CASE WHEN EXISTS (
      SELECT 1 FROM public.pending_workouts
      WHERE generation_attempt_id = v_locked_attempt.id AND workout_data IS NOT NULL
    ) THEN 'ready' ELSE 'failed' END;

    UPDATE public.pending_workouts
    SET status = v_status,
        generation_attempt_id = NULL
    WHERE generation_attempt_id = v_locked_attempt.id;

    UPDATE public.generation_attempts
    SET status = 'timed_out',
        stages = stages || jsonb_build_array(jsonb_build_object(
          'stage', 'recovery', 'started_at', now(), 'duration_ms', 0,
          'details', jsonb_build_object('reason', 'stale_attempt_recovered')
        )),
        finished_at = now(),
        duration_ms = GREATEST(0, (EXTRACT(EPOCH FROM (now() - started_at)) * 1000)::INTEGER),
        error_code = 'stale_attempt_recovered',
        error_message = 'Generation lease exceeded five minutes'
    WHERE id = v_locked_attempt.id AND status = 'running';
    v_count := v_count + 1;
  END LOOP;

  -- Legacy regeneration rows have no attempt to fence; updated_at is their lease.
  UPDATE public.pending_workouts
  SET status = CASE WHEN workout_data IS NOT NULL THEN 'ready' ELSE 'failed' END
  WHERE status IN ('queued', 'generating', 'regenerating')
    AND generation_attempt_id IS NULL
    AND updated_at < now() - INTERVAL '5 minutes'
    AND (p_user_id IS NULL OR user_id = p_user_id);
  GET DIAGNOSTICS v_legacy_count = ROW_COUNT;
  v_count := v_count + v_legacy_count;

  -- Queue claim fields are an older lease mechanism and must be released too.
  PERFORM set_config('app.generation_recovery', 'on', true);
  UPDATE public.profiles
  SET queue_generation_request_id = NULL,
      queue_generation_started_at = NULL
  WHERE queue_generation_request_id IS NOT NULL
    AND queue_generation_started_at < now() - INTERVAL '5 minutes'
    AND (p_user_id IS NULL OR id = p_user_id);

  PERFORM set_config('app.generation_recovery', COALESCE(v_previous_recovery, ''), true);

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_generation_attempt(UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_attempt(UUID, UUID, UUID, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.record_generation_attempt_stage(UUID, TEXT, TIMESTAMPTZ, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_generation_attempt_stage(UUID, TEXT, TIMESTAMPTZ, INTEGER, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.finish_generation_attempt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_generation_attempt(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
REVOKE ALL ON FUNCTION public.complete_regeneration_attempt(UUID, UUID, UUID, JSONB, TEXT, INTEGER, JSONB, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_regeneration_attempt(UUID, UUID, UUID, JSONB, TEXT, INTEGER, JSONB, TIMESTAMPTZ, JSONB, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.complete_pending_workout_attempt(UUID, UUID, UUID, JSONB, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pending_workout_attempt(UUID, UUID, UUID, JSONB, TEXT, JSONB, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.recover_stale_generation_attempts(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recover_stale_generation_attempts(UUID) TO authenticated, service_role;
