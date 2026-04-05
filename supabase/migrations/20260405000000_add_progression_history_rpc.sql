-- Returns the most recent completed performance for each given exercise_id.
-- Used by the progression engine to calculate weight/rep targets.
CREATE OR REPLACE FUNCTION get_exercise_progression_history(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id UUID,
  session_completed_at TIMESTAMPTZ,
  difficulty_feedback TEXT,
  working_sets JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (se.exercise_id)
    se.exercise_id,
    ws.completed_at AS session_completed_at,
    se.difficulty_feedback::TEXT,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'load_kg', sl.actual_load_kg,
          'reps', sl.actual_reps,
          'completed', sl.completed
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
  WHERE ws.user_id = p_user_id
    AND ws.status = 'completed'
    AND se.exercise_id = ANY(p_exercise_ids)
  ORDER BY se.exercise_id, ws.completed_at DESC
$$;
