-- Allow authenticated users to edit the completed set history they own.

CREATE OR REPLACE FUNCTION public.get_editable_exercise_history(
  p_exercise_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(session_data ORDER BY completed_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      ws.completed_at,
      jsonb_build_object(
        'id', se.id,
        'session_id', ws.id,
        'date', ws.completed_at,
        'workout_name', COALESCE(ws.name, 'Workout'),
        'sets', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', ss.id,
              'set_number', ss.set_number,
              'set_type', ss.set_type,
              'load_kg', sl.actual_load_kg,
              'reps', sl.actual_reps,
              'duration_seconds', sl.actual_duration_seconds,
              'rpe', sl.rpe
            ) ORDER BY ss.set_number
          )
          FROM session_sets ss
          JOIN set_logs sl ON sl.session_set_id = ss.id
          WHERE ss.session_exercise_id = se.id
            AND sl.completed = true
        ), '[]'::jsonb)
      ) AS session_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    WHERE ws.user_id = auth.uid()
      AND ws.status = 'completed'
      AND se.exercise_id = p_exercise_id
      AND EXISTS (
        SELECT 1
        FROM session_sets ss
        JOIN set_logs sl ON sl.session_set_id = ss.id
        WHERE ss.session_exercise_id = se.id
          AND sl.completed = true
      )
    ORDER BY ws.completed_at DESC
    LIMIT 50
  ) history;
$$;

CREATE OR REPLACE FUNCTION public.update_completed_exercise_sets(
  p_session_exercise_id UUID,
  p_sets JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completed_at TIMESTAMPTZ;
  v_exercise_type TEXT;
  v_set JSONB;
  v_set_id UUID;
  v_set_number INTEGER := 0;
BEGIN
  SELECT ws.completed_at, e.exercise_type
  INTO v_completed_at, v_exercise_type
  FROM session_exercises se
  JOIN workout_sessions ws ON ws.id = se.workout_session_id
  JOIN exercises e ON e.id = se.exercise_id
  WHERE se.id = p_session_exercise_id
    AND ws.user_id = auth.uid()
    AND ws.status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed exercise not found or not authorized';
  END IF;

  IF jsonb_typeof(p_sets) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_sets) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Sets must contain between 1 and 20 entries';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_sets) item
    WHERE (item->>'set_type') NOT IN ('warmup', 'working')
      OR (NULLIF(item->>'rpe', '') IS NOT NULL AND (
        (item->>'rpe')::numeric < 1 OR (item->>'rpe')::numeric > 10
      ))
      OR (v_exercise_type = 'time' AND COALESCE((item->>'actual_duration_seconds')::integer, 0) <= 0)
      OR (v_exercise_type = 'weight' AND (
        COALESCE((item->>'actual_load_kg')::numeric, -1) < 0
        OR COALESCE((item->>'actual_reps')::integer, 0) <= 0
      ))
  ) THEN
    RAISE EXCEPTION 'Invalid completed set values';
  END IF;

  DELETE FROM session_sets WHERE session_exercise_id = p_session_exercise_id;

  FOR v_set IN SELECT value FROM jsonb_array_elements(p_sets)
  LOOP
    v_set_number := v_set_number + 1;
    v_set_id := COALESCE(NULLIF(v_set->>'id', '')::uuid, gen_random_uuid());

    INSERT INTO session_sets (
      id,
      session_exercise_id,
      set_number,
      set_type,
      target_load_kg,
      target_reps,
      target_duration_seconds
    ) VALUES (
      v_set_id,
      p_session_exercise_id,
      v_set_number,
      v_set->>'set_type',
      CASE WHEN v_exercise_type = 'weight' THEN (v_set->>'actual_load_kg')::numeric ELSE NULL END,
      CASE WHEN v_exercise_type = 'weight' THEN (v_set->>'actual_reps')::integer ELSE NULL END,
      CASE WHEN v_exercise_type = 'time' THEN (v_set->>'actual_duration_seconds')::integer ELSE NULL END
    );

    INSERT INTO set_logs (
      session_set_id,
      actual_load_kg,
      actual_reps,
      actual_duration_seconds,
      rpe,
      completed,
      completed_at
    ) VALUES (
      v_set_id,
      CASE WHEN v_exercise_type = 'weight' THEN (v_set->>'actual_load_kg')::numeric ELSE NULL END,
      CASE WHEN v_exercise_type = 'weight' THEN (v_set->>'actual_reps')::integer ELSE NULL END,
      CASE WHEN v_exercise_type = 'time' THEN (v_set->>'actual_duration_seconds')::integer ELSE NULL END,
      NULLIF(v_set->>'rpe', '')::numeric,
      true,
      v_completed_at
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_completed_session_exercise(
  p_session_exercise_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM session_exercises se
  USING workout_sessions ws
  WHERE se.id = p_session_exercise_id
    AND ws.id = se.workout_session_id
    AND ws.user_id = auth.uid()
    AND ws.status = 'completed';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed exercise not found or not authorized';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_editable_exercise_history(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_completed_exercise_sets(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_completed_session_exercise(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_editable_exercise_history(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_completed_exercise_sets(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_completed_session_exercise(UUID) TO authenticated;
