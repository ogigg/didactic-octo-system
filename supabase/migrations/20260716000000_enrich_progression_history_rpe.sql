-- Enrich get_exercise_progression_history for RPE-aware progression.
-- Adds source session_id and includes rpe inside working_sets JSON.
-- Keep exercise_type (from time-exercise support) and do not edit older migrations.

DROP FUNCTION IF EXISTS get_exercise_progression_history(UUID, UUID[]);

CREATE FUNCTION get_exercise_progression_history(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id UUID,
  exercise_type TEXT,
  session_id UUID,
  session_completed_at TIMESTAMPTZ,
  difficulty_feedback TEXT,
  working_sets JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (se.exercise_id)
    se.exercise_id,
    e.exercise_type,
    ws.id AS session_id,
    ws.completed_at AS session_completed_at,
    se.difficulty_feedback::TEXT,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'load_kg',          sl.actual_load_kg,
          'reps',             sl.actual_reps,
          'duration_seconds', sl.actual_duration_seconds,
          'rpe',              sl.rpe,
          'completed',        sl.completed
        )
        ORDER BY ss.set_number
      )
      FROM session_sets ss
      JOIN set_logs sl ON sl.session_set_id = ss.id
      WHERE ss.session_exercise_id = se.id
        AND ss.set_type = 'working'
    ) AS working_sets
  FROM workout_sessions ws
  JOIN session_exercises se ON se.workout_session_id = ws.id
  JOIN exercises e ON e.id = se.exercise_id
  WHERE ws.user_id = p_user_id
    AND (auth.uid() = p_user_id OR auth.role() = 'service_role')
    AND ws.status = 'completed'
    AND se.exercise_id = ANY(p_exercise_ids)
  ORDER BY se.exercise_id, ws.completed_at DESC
$$;

REVOKE ALL ON FUNCTION get_exercise_progression_history(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_exercise_progression_history(UUID, UUID[])
  TO authenticated, service_role;
