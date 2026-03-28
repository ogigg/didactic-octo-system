-- -----------------------------------------------------------------------------
-- Returns completed workout sessions for a half-open local-day range in UTC
-- (p_start inclusive, p_end exclusive). Same row shape as get_workout_history_page.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_workout_history_for_day_range(
  p_start TIMESTAMPTZ,
  p_end   TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jsonb_agg(row_data ORDER BY row_data->>'completed_at' DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id',             ws.id,
      'name',           ws.name,
      'started_at',     ws.started_at,
      'completed_at',   ws.completed_at,
      'created_at',     ws.created_at,
      'exercise_count', COALESCE(ex_summary.exercise_count, 0),
      'total_sets',     COALESCE(ex_summary.total_sets, 0),
      'total_volume_kg',COALESCE(ex_summary.total_volume_kg, 0),
      'exercise_names', COALESCE(ex_summary.exercise_names, '[]'::jsonb)
    ) AS row_data
    FROM workout_sessions ws
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT se.id)::int                     AS exercise_count,
        COUNT(sl.id)::int                              AS total_sets,
        COALESCE(
          SUM(sl.actual_load_kg * sl.actual_reps)
          FILTER (WHERE sl.completed = true AND sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL),
          0
        )::numeric(10,2)                               AS total_volume_kg,
        (
          SELECT jsonb_agg(e2.name ORDER BY se2.order_index)
          FROM session_exercises se2
          JOIN exercises e2 ON e2.id = se2.exercise_id
          WHERE se2.workout_session_id = ws.id
        )                                              AS exercise_names
      FROM session_exercises se
      JOIN session_sets ss  ON ss.session_exercise_id = se.id
      JOIN set_logs sl      ON sl.session_set_id = ss.id
      WHERE se.workout_session_id = ws.id
    ) ex_summary ON true
    WHERE ws.user_id  = v_user_id
      AND ws.status   = 'completed'
      AND ws.completed_at IS NOT NULL
      AND ws.completed_at >= p_start
      AND ws.completed_at < p_end
    ORDER BY ws.completed_at DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
