-- Make onboarding completion and first queue creation safe to retry.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS initial_queue_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS queue_generation_request_id UUID,
  ADD COLUMN IF NOT EXISTS queue_generation_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.initial_queue_generated_at IS
  'When the first successful onboarding workout queue was committed.';
COMMENT ON COLUMN public.profiles.queue_generation_request_id IS
  'Request token for the currently claimed queue replacement, when any.';
COMMENT ON COLUMN public.profiles.queue_generation_started_at IS
  'Start time for the currently claimed queue replacement.';

CREATE OR REPLACE FUNCTION public.guard_queue_generation_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'role', '') = 'authenticated'
     AND (
       NEW.initial_queue_generated_at IS DISTINCT FROM OLD.initial_queue_generated_at
       OR NEW.queue_generation_request_id IS DISTINCT FROM OLD.queue_generation_request_id
       OR NEW.queue_generation_started_at IS DISTINCT FROM OLD.queue_generation_started_at
     ) THEN
    RAISE EXCEPTION 'queue generation state is server managed'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_queue_generation_state_guard ON public.profiles;
CREATE TRIGGER profiles_queue_generation_state_guard
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_queue_generation_state();

-- Existing completed accounts with a ready queue or generated workout history
-- have already consumed the one-time onboarding generation opportunity.
UPDATE public.profiles AS p
SET initial_queue_generated_at = COALESCE(
  (
    SELECT MIN(pw.generated_at)
    FROM public.pending_workouts AS pw
    WHERE pw.user_id = p.id
      AND pw.status = 'ready'
      AND pw.workout_data IS NOT NULL
  ),
  (
    SELECT MIN(ws.completed_at)
    FROM public.workout_sessions AS ws
    WHERE ws.user_id = p.id
      AND ws.status = 'completed'
  ),
  now()
)
WHERE p.onboarding_completed
  AND p.initial_queue_generated_at IS NULL
  AND (
    EXISTS (
      SELECT 1
      FROM public.pending_workouts AS pw
      WHERE pw.user_id = p.id
        AND pw.status = 'ready'
        AND pw.workout_data IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.workout_sessions AS ws
      WHERE ws.user_id = p.id
        AND ws.status = 'completed'
    )
  );

-- Claiming is server-side because the generation request runs outside the
-- database transaction. A stale claim can be reclaimed after 15 minutes.
CREATE OR REPLACE FUNCTION public.claim_queue_generation(
  p_user_id UUID,
  p_request_id UUID,
  p_trigger TEXT
)
RETURNS TABLE (status TEXT, request_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_role TEXT := auth.jwt() ->> 'role';
  v_now TIMESTAMPTZ := now();
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'user and request ids are required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to claim queue generation for this user'
      USING ERRCODE = '42501';
  END IF;

  IF p_trigger NOT IN ('onboarding', 'preference_change') THEN
    RAISE EXCEPTION 'invalid queue generation trigger' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT v_profile.onboarding_completed THEN
    RAISE EXCEPTION 'onboarding must be completed before queue generation'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_trigger = 'onboarding' AND v_profile.initial_queue_generated_at IS NOT NULL THEN
    RETURN QUERY SELECT 'already_ready'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  IF v_profile.queue_generation_request_id IS NOT NULL
     AND COALESCE(v_profile.queue_generation_started_at, '-infinity'::TIMESTAMPTZ)
       > v_now - INTERVAL '15 minutes' THEN
    RETURN QUERY
    SELECT 'in_progress'::TEXT, v_profile.queue_generation_request_id;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET queue_generation_request_id = p_request_id,
      queue_generation_started_at = v_now
  WHERE id = p_user_id;

  RETURN QUERY SELECT 'claimed'::TEXT, p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_queue_generation(
  p_user_id UUID,
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT := auth.jwt() ->> 'role';
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'user and request ids are required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to release queue generation for this user'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET queue_generation_request_id = NULL,
      queue_generation_started_at = NULL
  WHERE id = p_user_id
    AND queue_generation_request_id = p_request_id;

  RETURN FOUND;
END;
$$;

-- Swap only a complete, validated ready queue. The delete and insert are in
-- one transaction, so an invalid payload leaves the old queue untouched.
CREATE OR REPLACE FUNCTION public.replace_pending_workouts(
  p_user_id UUID,
  p_request_id UUID,
  p_trigger TEXT,
  p_workouts JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_role TEXT := auth.jwt() ->> 'role';
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'user and request ids are required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_user_id) THEN
    RAISE EXCEPTION 'not allowed to replace this queue'
      USING ERRCODE = '42501';
  END IF;

  IF p_trigger NOT IN ('onboarding', 'preference_change') THEN
    RAISE EXCEPTION 'invalid queue generation trigger' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(p_workouts) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'workouts must be a JSON array' USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_array_length(p_workouts) INTO v_count;
  IF v_count < 1 OR v_count > 7 THEN
    RAISE EXCEPTION 'workout count must be between 1 and 7' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_workouts) AS item
    WHERE item->>'status' IS DISTINCT FROM 'ready'
       OR jsonb_typeof(item->'workout_data') IS DISTINCT FROM 'object'
       OR item->>'generation_source' IS NULL
       OR item->>'generation_source' NOT IN (
         'llm', 'fallback_template', 'fallback_substitution'
       )
       OR item->>'queue_position' IS NULL
  ) THEN
    RAISE EXCEPTION 'queue replacement accepts ready workouts only'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_workouts) AS item
    WHERE (item->>'queue_position')::INTEGER < 1
       OR (item->>'queue_position')::INTEGER > v_count
  )
  OR (
    SELECT COUNT(DISTINCT (item->>'queue_position')::INTEGER)
    FROM jsonb_array_elements(p_workouts) AS item
  ) <> v_count THEN
    RAISE EXCEPTION 'queue positions must be unique and contiguous'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_workouts) AS item
    WHERE item->>'focus_area' IS NOT NULL
      AND item->>'focus_area' NOT IN (
        'push', 'pull', 'legs', 'upper', 'lower', 'full_body'
      )
  ) THEN
    RAISE EXCEPTION 'invalid queue focus area' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_profile.queue_generation_request_id IS DISTINCT FROM p_request_id THEN
    RAISE EXCEPTION 'queue generation claim is no longer valid'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_trigger = 'onboarding'
     AND v_profile.initial_queue_generated_at IS NOT NULL THEN
    RAISE EXCEPTION 'initial onboarding queue already generated'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.pending_workouts
  WHERE user_id = p_user_id;

  INSERT INTO public.pending_workouts (
    id,
    user_id,
    queue_position,
    status,
    workout_data,
    generation_source,
    focus_area,
    generated_at
  )
  SELECT
    COALESCE(NULLIF(item->>'id', '')::UUID, gen_random_uuid()),
    p_user_id,
    (item->>'queue_position')::INTEGER,
    'ready',
    item->'workout_data',
    item->>'generation_source',
    NULLIF(item->>'focus_area', ''),
    COALESCE(NULLIF(item->>'generated_at', '')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(p_workouts) AS item;

  UPDATE public.profiles
  SET initial_queue_generated_at = CASE
        WHEN p_trigger = 'onboarding' THEN COALESCE(initial_queue_generated_at, now())
        ELSE initial_queue_generated_at
      END,
      queue_generation_request_id = NULL,
      queue_generation_started_at = NULL
  WHERE id = p_user_id;

  RETURN jsonb_build_object('status', 'replaced', 'count', v_count);
END;
$$;

-- Complete the profile and optional strength baselines atomically. Explicit
-- columns keep entitlement and queue state out of the onboarding write path.
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_profile JSONB,
  p_baselines JSONB,
  p_expected_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.profiles%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_role TEXT := auth.jwt() ->> 'role';
  v_gender gender_type;
  v_goal goal_type;
  v_weekly_frequency frequency_type;
  v_training_split TEXT;
  v_session_duration SMALLINT;
  v_equipment_level TEXT;
  v_training_style TEXT;
  v_difficulty_level TEXT;
  v_weight_unit TEXT;
  v_custom_goal TEXT;
  v_training_custom_prompt TEXT;
  v_item JSONB;
BEGIN
  IF p_expected_user_id IS NULL THEN
    RAISE EXCEPTION 'expected user id is required' USING ERRCODE = '22023';
  END IF;

  IF COALESCE(v_role, '') <> 'service_role'
     AND (auth.uid() IS NULL OR auth.uid() <> p_expected_user_id) THEN
    RAISE EXCEPTION 'not allowed to complete onboarding for this user'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.profiles
  WHERE id = p_expected_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_existing.onboarding_completed THEN
    RETURN jsonb_build_object(
      'status', 'already_completed',
      'profile', to_jsonb(v_existing)
    );
  END IF;

  IF p_profile IS NULL OR jsonb_typeof(p_profile) <> 'object' THEN
    RAISE EXCEPTION 'profile must be a JSON object' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(ARRAY[
      'goal', 'weekly_frequency', 'training_split',
      'session_duration_minutes', 'equipment_level',
      'training_style', 'difficulty_level', 'weight_unit'
    ]) AS required_key
    WHERE NOT (p_profile ? required_key)
       OR p_profile->>required_key IS NULL
  ) THEN
    RAISE EXCEPTION 'required onboarding profile fields are missing'
      USING ERRCODE = '22023';
  END IF;

  IF p_profile->>'gender' IS NOT NULL
     AND p_profile->>'gender' NOT IN ('male', 'female', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'invalid gender' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'training_split' NOT IN ('full_body', 'upper_lower', 'push_pull_legs') THEN
    RAISE EXCEPTION 'invalid training split' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'session_duration_minutes' NOT IN ('15', '30', '45', '60', '90') THEN
    RAISE EXCEPTION 'invalid session duration' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'equipment_level' NOT IN ('bodyweight', 'dumbbells', 'barbell', 'full_gym') THEN
    RAISE EXCEPTION 'invalid equipment level' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'training_style' NOT IN ('strength', 'hypertrophy', 'endurance', 'circuit') THEN
    RAISE EXCEPTION 'invalid training style' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'difficulty_level' NOT IN ('beginner', 'intermediate', 'advanced') THEN
    RAISE EXCEPTION 'invalid difficulty level' USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'weight_unit' NOT IN ('kg', 'lbs') THEN
    RAISE EXCEPTION 'invalid weight unit' USING ERRCODE = '22023';
  END IF;

  v_custom_goal = NULLIF(btrim(p_profile->>'custom_goal'), '');
  IF p_profile->>'goal' = 'custom'
     AND (v_custom_goal IS NULL OR char_length(v_custom_goal) > 500) THEN
    RAISE EXCEPTION 'custom goal is required and must be 500 characters or fewer'
      USING ERRCODE = '22023';
  END IF;
  IF p_profile->>'goal' <> 'custom' THEN
    v_custom_goal := NULL;
  END IF;

  v_training_custom_prompt = NULLIF(btrim(p_profile->>'training_custom_prompt'), '');
  IF v_training_custom_prompt IS NOT NULL
     AND char_length(v_training_custom_prompt) > 200 THEN
    RAISE EXCEPTION 'training custom prompt must be 200 characters or fewer'
      USING ERRCODE = '22023';
  END IF;

  v_gender = NULLIF(p_profile->>'gender', '')::gender_type;
  v_goal = (p_profile->>'goal')::goal_type;
  v_weekly_frequency = (p_profile->>'weekly_frequency')::frequency_type;
  v_training_split = p_profile->>'training_split';
  v_session_duration = (p_profile->>'session_duration_minutes')::SMALLINT;
  v_equipment_level = p_profile->>'equipment_level';
  v_training_style = p_profile->>'training_style';
  v_difficulty_level = p_profile->>'difficulty_level';
  v_weight_unit = p_profile->>'weight_unit';

  IF p_baselines IS NOT NULL
     AND jsonb_typeof(p_baselines) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'baselines must be a JSON array' USING ERRCODE = '22023';
  END IF;

  IF p_baselines IS NOT NULL THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_baselines) AS value
    LOOP
      IF v_item->>'exercise_key' NOT IN (
        'pushups', 'pullups', 'db_bench', 'db_row', 'bb_bench', 'bb_squat', 'deadlift'
      ) THEN
        RAISE EXCEPTION 'invalid baseline exercise' USING ERRCODE = '22023';
      END IF;
      IF v_item->>'reps' IS NULL OR (v_item->>'reps')::INTEGER < 0 THEN
        RAISE EXCEPTION 'baseline reps cannot be negative' USING ERRCODE = '22023';
      END IF;
      IF v_item->>'load_kg' IS NOT NULL
         AND v_item->>'load_kg' <> ''
         AND (v_item->>'load_kg')::NUMERIC < 0 THEN
        RAISE EXCEPTION 'baseline load cannot be negative' USING ERRCODE = '22023';
      END IF;
      IF v_item->>'load_kg' IS NOT NULL
         AND v_item->>'load_kg' <> ''
         AND (v_item->>'load_kg')::NUMERIC > 0
         AND (v_item->>'reps')::INTEGER < 1 THEN
        RAISE EXCEPTION 'weighted baselines require at least one rep'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles
  SET gender = v_gender,
      goal = v_goal,
      custom_goal = v_custom_goal,
      weekly_frequency = v_weekly_frequency,
      onboarding_completed = TRUE,
      training_split = v_training_split,
      session_duration_minutes = v_session_duration,
      equipment_level = v_equipment_level,
      training_style = v_training_style,
      difficulty_level = v_difficulty_level,
      training_custom_prompt = v_training_custom_prompt,
      training_setup_completed = TRUE,
      weight_unit = v_weight_unit
  WHERE id = p_expected_user_id;

  IF p_baselines IS NOT NULL THEN
    DELETE FROM public.strength_baselines
    WHERE user_id = p_expected_user_id;

    INSERT INTO public.strength_baselines (
      user_id,
      exercise_key,
      load_kg,
      reps
    )
    SELECT
      p_expected_user_id,
      item->>'exercise_key',
      NULLIF(item->>'load_kg', '')::NUMERIC,
      (item->>'reps')::INTEGER
    FROM jsonb_array_elements(p_baselines) AS item;
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles
  WHERE id = p_expected_user_id;

  RETURN jsonb_build_object('status', 'completed', 'profile', to_jsonb(v_profile));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_queue_generation(UUID, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_queue_generation(UUID, UUID, TEXT)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.release_queue_generation(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_queue_generation(UUID, UUID)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.replace_pending_workouts(UUID, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_pending_workouts(UUID, UUID, TEXT, JSONB)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding(JSONB, JSONB, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(JSONB, JSONB, UUID)
  TO authenticated, service_role;
