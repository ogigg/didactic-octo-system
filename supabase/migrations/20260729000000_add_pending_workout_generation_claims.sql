-- Version and claim pending-workout generation so concurrent devices, fallback
-- recovery, and late Edge Function workers cannot overwrite one another.

ALTER TABLE public.pending_workouts
  ADD COLUMN generation_version BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN generation_claim_token UUID,
  ADD COLUMN generation_claimed_at TIMESTAMPTZ,
  ADD COLUMN generation_previous_status TEXT;

ALTER TABLE public.pending_workouts
  ADD CONSTRAINT pending_workouts_generation_previous_status_check
  CHECK (
    generation_previous_status IS NULL
    OR generation_previous_status IN (
      'queued',
      'generating',
      'regenerating',
      'ready',
      'failed'
    )
  );

-- Once a worker has a claim, legacy unconditional ready/failed writes cannot
-- leave that claim attached to a terminal row and overwrite a recovery winner.
ALTER TABLE public.pending_workouts
  ADD CONSTRAINT pending_workouts_terminal_generation_claim_check
  CHECK (
    status IN ('generating', 'regenerating')
    OR (
      generation_claim_token IS NULL
      AND generation_claimed_at IS NULL
      AND generation_previous_status IS NULL
    )
  );

CREATE OR REPLACE FUNCTION public.claim_pending_workout_generation(
  p_pending_workout_id UUID,
  p_expected_version BIGINT,
  p_claim_reason TEXT,
  p_allow_corrupt_ready BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  claim_token UUID,
  generation_version BIGINT,
  workout_data JSONB,
  regeneration_count INTEGER,
  regeneration_feedback JSONB,
  last_regenerated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_claim_reason NOT IN ('initial', 'regeneration', 'recovery') THEN
    RAISE EXCEPTION 'Invalid pending workout claim reason'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.pending_workouts AS pw
  SET
    generation_previous_status = pw.status,
    status = 'regenerating',
    generation_version = pw.generation_version + 1,
    generation_claim_token = gen_random_uuid(),
    generation_claimed_at = NOW()
  WHERE pw.id = p_pending_workout_id
    AND pw.user_id = auth.uid()
    AND pw.generation_version = p_expected_version
    AND (
      (p_claim_reason = 'initial' AND pw.status = 'queued')
      OR (
        p_claim_reason = 'regeneration'
        AND pw.status = 'ready'
        AND pw.workout_data IS NOT NULL
      )
      OR (
        p_claim_reason = 'recovery'
        AND (
          pw.status = 'failed'
          OR (
            pw.status IN ('queued', 'generating', 'regenerating')
            AND pw.updated_at <= NOW() - INTERVAL '5 minutes'
          )
          OR (
            pw.status = 'ready'
            AND (pw.workout_data IS NULL OR p_allow_corrupt_ready)
          )
        )
      )
    )
  RETURNING
    pw.generation_claim_token,
    pw.generation_version,
    pw.workout_data,
    pw.regeneration_count,
    pw.regeneration_feedback,
    pw.last_regenerated_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_pending_workout_generation(
  p_pending_workout_id UUID,
  p_generation_version BIGINT,
  p_claim_token UUID,
  p_workout_data JSONB,
  p_generation_source TEXT,
  p_is_regeneration BOOLEAN DEFAULT FALSE,
  p_regeneration_feedback TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count BIGINT;
  v_submitted_at TIMESTAMPTZ := NOW();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_generation_source NOT IN (
    'llm',
    'fallback_template',
    'fallback_substitution'
  ) THEN
    RAISE EXCEPTION 'Invalid generation source' USING ERRCODE = '22023';
  END IF;

  UPDATE public.pending_workouts AS pw
  SET
    workout_data = p_workout_data,
    generation_source = p_generation_source,
    status = 'ready',
    generated_at = v_submitted_at,
    last_regenerated_at = CASE
      WHEN p_is_regeneration THEN v_submitted_at
      ELSE pw.last_regenerated_at
    END,
    regeneration_count = CASE
      WHEN p_is_regeneration THEN COALESCE(pw.regeneration_count, 0) + 1
      ELSE pw.regeneration_count
    END,
    regeneration_feedback = CASE
      WHEN p_is_regeneration THEN
        COALESCE(pw.regeneration_feedback, '[]'::JSONB)
        || JSONB_BUILD_ARRAY(JSONB_BUILD_OBJECT(
          'feedback', p_regeneration_feedback,
          'has_feedback', p_regeneration_feedback IS NOT NULL,
          'submitted_at', v_submitted_at
        ))
      ELSE pw.regeneration_feedback
    END,
    generation_claim_token = NULL,
    generation_claimed_at = NULL,
    generation_previous_status = NULL
  WHERE pw.id = p_pending_workout_id
    AND pw.user_id = auth.uid()
    AND pw.status = 'regenerating'
    AND pw.generation_version = p_generation_version
    AND pw.generation_claim_token = p_claim_token;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_pending_workout_generation(
  p_pending_workout_id UUID,
  p_generation_version BIGINT,
  p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pending_workouts AS pw
  SET
    status = CASE
      WHEN pw.generation_previous_status = 'ready'
        AND pw.workout_data IS NOT NULL
      THEN 'ready'
      ELSE 'failed'
    END,
    generation_claim_token = NULL,
    generation_claimed_at = NULL,
    generation_previous_status = NULL
  WHERE pw.id = p_pending_workout_id
    AND pw.user_id = auth.uid()
    AND pw.status = 'regenerating'
    AND pw.generation_version = p_generation_version
    AND pw.generation_claim_token = p_claim_token;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_pending_workout_with_fallback(
  p_pending_workout_id UUID,
  p_expected_version BIGINT,
  p_workout_data JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.pending_workouts AS pw
  SET
    status = 'ready',
    generation_source = 'fallback_template',
    workout_data = p_workout_data,
    generated_at = NOW(),
    user_edits = NULL,
    generation_version = pw.generation_version + 1,
    generation_claim_token = NULL,
    generation_claimed_at = NULL,
    generation_previous_status = NULL
  WHERE pw.id = p_pending_workout_id
    AND pw.user_id = auth.uid()
    AND pw.generation_version = p_expected_version;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_workout_generation(UUID, BIGINT, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_pending_workout_generation(UUID, BIGINT, UUID, JSONB, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_pending_workout_generation(UUID, BIGINT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.replace_pending_workout_with_fallback(UUID, BIGINT, JSONB) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_pending_workout_generation(UUID, BIGINT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_pending_workout_generation(UUID, BIGINT, UUID, JSONB, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_pending_workout_generation(UUID, BIGINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_pending_workout_with_fallback(UUID, BIGINT, JSONB) TO authenticated;
