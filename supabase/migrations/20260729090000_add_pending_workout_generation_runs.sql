-- Make queue rebuild ownership atomic and durable.
--
-- All rows created by one rebuild share a generation_run_id. The start RPC
-- serializes rebuilds per user, refuses to replace an in-flight queue, and
-- atomically replaces inactive rows with the new owned run.

ALTER TABLE public.pending_workouts
  ADD COLUMN generation_run_id UUID;

CREATE INDEX idx_pending_workouts_user_generation_run
  ON public.pending_workouts(user_id, generation_run_id);

CREATE OR REPLACE FUNCTION public.start_pending_workout_generation(
  p_run_id UUID,
  p_focus_areas TEXT[]
)
RETURNS TABLE (
  started BOOLEAN,
  workout_id UUID,
  workout_queue_position INTEGER,
  workout_focus_area TEXT,
  run_id UUID
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INTEGER := cardinality(p_focus_areas);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_run_id IS NULL THEN
    RAISE EXCEPTION 'p_run_id is required' USING ERRCODE = '22023';
  END IF;

  IF v_count IS NULL OR v_count < 1 OR v_count > 7 THEN
    RAISE EXCEPTION 'p_focus_areas must contain between 1 and 7 entries'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_focus_areas) AS focus(value)
    WHERE focus.value IS NULL
       OR focus.value NOT IN ('push', 'pull', 'legs', 'upper', 'lower', 'full_body')
  ) THEN
    RAISE EXCEPTION 'p_focus_areas contains an invalid focus area'
      USING ERRCODE = '22023';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pending-workout-generation:' || v_user_id::TEXT, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.pending_workouts
    WHERE user_id = v_user_id
      AND status IN ('queued', 'generating', 'regenerating')
  ) THEN
    RETURN QUERY
      SELECT FALSE, NULL::UUID, NULL::INTEGER, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  DELETE FROM public.pending_workouts
  WHERE user_id = v_user_id;

  RETURN QUERY
    INSERT INTO public.pending_workouts (
      user_id,
      queue_position,
      status,
      focus_area,
      generation_run_id
    )
    SELECT
      v_user_id,
      focus.ordinality::INTEGER,
      'queued',
      focus.value,
      p_run_id
    FROM unnest(p_focus_areas) WITH ORDINALITY AS focus(value, ordinality)
    RETURNING
      TRUE,
      pending_workouts.id,
      pending_workouts.queue_position,
      pending_workouts.focus_area,
      pending_workouts.generation_run_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_pending_workout_generation(UUID, TEXT[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_pending_workout_generation(UUID, TEXT[])
  TO authenticated;

COMMENT ON COLUMN public.pending_workouts.generation_run_id IS
  'Shared ownership token for rows created by one atomic queue rebuild.';

COMMENT ON FUNCTION public.start_pending_workout_generation(UUID, TEXT[]) IS
  'Atomically starts one queue rebuild per user and returns its owned rows.';
