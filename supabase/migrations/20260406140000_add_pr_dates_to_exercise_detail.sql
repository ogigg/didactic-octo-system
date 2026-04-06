-- -----------------------------------------------------------------------------
-- Migration: add_pr_dates_to_exercise_detail
-- Updates get_exercise_detail to include achievement dates for each PR stat,
-- filters out history sessions with no completed sets, and adds session counts.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_exercise_detail(p_exercise_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_records JSONB;
  v_volume_weeks JSONB;
  v_sessions JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ─── Personal Records with achievement dates ─────────────────────────────
  SELECT jsonb_build_object(
    'max_weight_kg',     COALESCE(MAX(sl.actual_load_kg), 0)::numeric(10,2),
    'max_weight_date',   (
                           SELECT ws2.completed_at::date
                           FROM set_logs sl2
                           JOIN session_sets ss2 ON ss2.id = sl2.session_set_id
                           JOIN session_exercises se2 ON se2.id = ss2.session_exercise_id
                           JOIN workout_sessions ws2 ON ws2.id = se2.workout_session_id
                           WHERE ws2.user_id = v_user_id
                             AND ws2.status = 'completed'
                             AND se2.exercise_id = p_exercise_id
                             AND sl2.completed = true
                             AND sl2.actual_load_kg IS NOT NULL
                             AND sl2.actual_reps IS NOT NULL
                           ORDER BY sl2.actual_load_kg DESC, ws2.completed_at DESC
                           LIMIT 1
                         ),
    'max_reps',          COALESCE(MAX(sl.actual_reps), 0),
    'max_reps_date',     (
                           SELECT ws2.completed_at::date
                           FROM set_logs sl2
                           JOIN session_sets ss2 ON ss2.id = sl2.session_set_id
                           JOIN session_exercises se2 ON se2.id = ss2.session_exercise_id
                           JOIN workout_sessions ws2 ON ws2.id = se2.workout_session_id
                           WHERE ws2.user_id = v_user_id
                             AND ws2.status = 'completed'
                             AND se2.exercise_id = p_exercise_id
                             AND sl2.completed = true
                             AND sl2.actual_load_kg IS NOT NULL
                             AND sl2.actual_reps IS NOT NULL
                           ORDER BY sl2.actual_reps DESC, ws2.completed_at DESC
                           LIMIT 1
                         ),
    'max_volume_set_kg', COALESCE(MAX(sl.actual_load_kg * sl.actual_reps), 0)::numeric(10,2),
    'max_volume_set_date', (
                             SELECT ws2.completed_at::date
                             FROM set_logs sl2
                             JOIN session_sets ss2 ON ss2.id = sl2.session_set_id
                             JOIN session_exercises se2 ON se2.id = ss2.session_exercise_id
                             JOIN workout_sessions ws2 ON ws2.id = se2.workout_session_id
                             WHERE ws2.user_id = v_user_id
                               AND ws2.status = 'completed'
                               AND se2.exercise_id = p_exercise_id
                               AND sl2.completed = true
                               AND sl2.actual_load_kg IS NOT NULL
                               AND sl2.actual_reps IS NOT NULL
                             ORDER BY (sl2.actual_load_kg * sl2.actual_reps) DESC, ws2.completed_at DESC
                             LIMIT 1
                           ),
    'est_1rm_kg',        (
                           SELECT ROUND((sub.load * (1 + sub.reps / 30.0))::numeric, 2)
                           FROM (
                             SELECT sl2.actual_load_kg AS load, sl2.actual_reps AS reps
                             FROM set_logs sl2
                             JOIN session_sets ss2 ON ss2.id = sl2.session_set_id
                             JOIN session_exercises se2 ON se2.id = ss2.session_exercise_id
                             JOIN workout_sessions ws2 ON ws2.id = se2.workout_session_id
                             WHERE ws2.user_id = v_user_id
                               AND ws2.status = 'completed'
                               AND se2.exercise_id = p_exercise_id
                               AND sl2.completed = true
                               AND sl2.actual_load_kg IS NOT NULL
                               AND sl2.actual_reps IS NOT NULL
                               AND sl2.actual_reps BETWEEN 1 AND 10
                             ORDER BY (sl2.actual_load_kg * (1 + sl2.actual_reps / 30.0)) DESC
                             LIMIT 1
                           ) sub
                         ),
    'max_rpe',           (
                           SELECT MAX(sl3.rpe)
                           FROM set_logs sl3
                           JOIN session_sets ss3 ON ss3.id = sl3.session_set_id
                           JOIN session_exercises se3 ON se3.id = ss3.session_exercise_id
                           JOIN workout_sessions ws3 ON ws3.id = se3.workout_session_id
                           WHERE ws3.user_id = v_user_id
                             AND ws3.status = 'completed'
                             AND se3.exercise_id = p_exercise_id
                             AND sl3.completed = true
                             AND sl3.rpe IS NOT NULL
                         )
  )
  INTO v_records
  FROM set_logs sl
  JOIN session_sets ss ON ss.id = sl.session_set_id
  JOIN session_exercises se ON se.id = ss.session_exercise_id
  JOIN workout_sessions ws ON ws.id = se.workout_session_id
  WHERE ws.user_id = v_user_id
    AND ws.status = 'completed'
    AND se.exercise_id = p_exercise_id
    AND sl.completed = true
    AND sl.actual_load_kg IS NOT NULL
    AND sl.actual_reps IS NOT NULL;

  -- ─── Weekly Volume (last 52 weeks) ──────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'week_start' ASC), '[]'::jsonb)
  INTO v_volume_weeks
  FROM (
    SELECT jsonb_build_object(
      'week_start', date_trunc('week', ws.completed_at)::date,
      'volume_kg',  SUM(sl.actual_load_kg * sl.actual_reps)::numeric(10,2)
    ) AS row_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss ON ss.session_exercise_id = se.id
    JOIN set_logs sl ON sl.session_set_id = ss.id
    WHERE ws.user_id = v_user_id
      AND ws.status = 'completed'
      AND se.exercise_id = p_exercise_id
      AND sl.completed = true
      AND sl.actual_load_kg IS NOT NULL
      AND sl.actual_reps IS NOT NULL
      AND ws.completed_at >= (NOW() - INTERVAL '52 weeks')
    GROUP BY date_trunc('week', ws.completed_at)::date
  ) sub;

  -- ─── Session History — only sessions with completed sets ─────────────────
  SELECT COALESCE(jsonb_agg(session_data ORDER BY session_data->>'date' DESC), '[]'::jsonb)
  INTO v_sessions
  FROM (
    SELECT jsonb_build_object(
      'date',         ws.completed_at::date,
      'workout_name', ws.name,
      'sets',         (
                        SELECT jsonb_agg(
                          jsonb_build_object(
                            'set_number', ss.set_number,
                            'load_kg',    sl.actual_load_kg,
                            'reps',       sl.actual_reps,
                            'rpe',        sl.rpe
                          )
                          ORDER BY ss.set_number
                        )
                        FROM session_sets ss
                        JOIN set_logs sl ON sl.session_set_id = ss.id
                        WHERE ss.session_exercise_id = se.id
                          AND sl.completed = true
                          AND sl.actual_load_kg IS NOT NULL
                          AND sl.actual_reps IS NOT NULL
                      )
    ) AS session_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    WHERE ws.user_id = v_user_id
      AND ws.status = 'completed'
      AND se.exercise_id = p_exercise_id
      -- Only include sessions that have at least one completed set for this exercise
      AND EXISTS (
        SELECT 1
        FROM session_sets ss
        JOIN set_logs sl ON sl.session_set_id = ss.id
        WHERE ss.session_exercise_id = se.id
          AND sl.completed = true
          AND sl.actual_load_kg IS NOT NULL
          AND sl.actual_reps IS NOT NULL
      )
    ORDER BY ws.completed_at DESC
    LIMIT 50
  ) sub;

  RETURN jsonb_build_object(
    'records',      COALESCE(v_records, jsonb_build_object(
      'max_weight_kg', 0, 'max_weight_date', null,
      'max_reps', 0, 'max_reps_date', null,
      'max_volume_set_kg', 0, 'max_volume_set_date', null,
      'est_1rm_kg', null, 'max_rpe', null
    )),
    'volume_weeks', v_volume_weeks,
    'sessions',     v_sessions
  );
END;
$$;
