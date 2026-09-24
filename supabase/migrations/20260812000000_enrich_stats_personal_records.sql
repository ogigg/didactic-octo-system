-- Personal-record statistics must be calculated from completed working sets and
-- retain the reps/load pairing for the selected heaviest and highest-rep sets.

CREATE OR REPLACE FUNCTION get_stats_personal_records()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  WITH eligible_sets AS (
    SELECT
      e.id                 AS exercise_id,
      e.name               AS exercise_name,
      ws.completed_at      AS workout_completed_at,
      sl.id                AS set_log_id,
      sl.actual_load_kg,
      sl.actual_reps
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN exercises e           ON e.id = se.exercise_id
    JOIN session_sets ss       ON ss.session_exercise_id = se.id
    JOIN set_logs sl           ON sl.session_set_id = ss.id
    WHERE ws.user_id        = v_user_id
      AND ws.status         = 'completed'
      AND sl.completed      = true
      AND sl.actual_load_kg IS NOT NULL
      AND sl.actual_reps    IS NOT NULL
      AND ss.set_type       = 'working'
  ),
  grouped_records AS (
    SELECT
      exercise_id,
      exercise_name,
      MAX(actual_load_kg)::numeric(8, 2) AS max_weight_kg,
      MAX(actual_reps)::int AS max_reps,
      MAX(actual_load_kg * actual_reps)::numeric(10, 2) AS max_volume_set_kg,
      MAX(
        CASE
          WHEN actual_reps <= 10 AND actual_reps > 0
          THEN ROUND((actual_load_kg * (1.0 + actual_reps::numeric / 30.0))::numeric, 1)
          ELSE NULL
        END
      ) AS est_1rm_kg
    FROM eligible_sets
    GROUP BY exercise_id, exercise_name
  ),
  max_weight_sets AS (
    SELECT DISTINCT ON (exercise_id)
      exercise_id,
      actual_reps AS max_weight_reps
    FROM eligible_sets
    ORDER BY
      exercise_id,
      actual_load_kg DESC,
      actual_reps DESC,
      workout_completed_at DESC NULLS LAST,
      set_log_id DESC
  ),
  max_reps_sets AS (
    SELECT DISTINCT ON (exercise_id)
      exercise_id,
      actual_load_kg AS max_reps_weight_kg
    FROM eligible_sets
    ORDER BY
      exercise_id,
      actual_reps DESC,
      actual_load_kg DESC,
      workout_completed_at DESC NULLS LAST,
      set_log_id DESC
  )
  SELECT jsonb_agg(row_data ORDER BY row_data->>'exercise_name' ASC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'exercise_id',        gr.exercise_id,
      'exercise_name',      gr.exercise_name,
      'max_weight_kg',      gr.max_weight_kg,
      'max_weight_reps',    mws.max_weight_reps,
      'max_reps',           gr.max_reps,
      'max_reps_weight_kg', mrs.max_reps_weight_kg::numeric(8, 2),
      'max_volume_set_kg',  gr.max_volume_set_kg,
      'est_1rm_kg',          gr.est_1rm_kg
    ) AS row_data
    FROM grouped_records gr
    JOIN max_weight_sets mws ON mws.exercise_id = gr.exercise_id
    JOIN max_reps_sets mrs   ON mrs.exercise_id = gr.exercise_id
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
