-- -----------------------------------------------------------------------------
-- Migration: add_stats_rpcs
-- Adds get_stats_heatmap, get_stats_volume_over_time, get_stats_personal_records,
-- and get_stats_muscle_distribution RPCs for the statistics screen
-- -----------------------------------------------------------------------------

-- ─── Activity heatmap (last 52 weeks) ─────────────────────────────────────────
-- Returns one row per day that had at least one completed workout.
-- volume_kg is the total load × reps across all completed sets on that day.
-- duration_minutes is derived from the session start/end timestamps.

CREATE OR REPLACE FUNCTION get_stats_heatmap()
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

  SELECT jsonb_agg(row_data ORDER BY row_data->>'date' ASC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'date',             ws.completed_at::date,
      'volume_kg',        COALESCE(
                            SUM(sl.actual_load_kg * sl.actual_reps)
                            FILTER (WHERE sl.completed = true AND sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL),
                            0
                          )::numeric(10,2),
      'duration_minutes', COALESCE(
                            EXTRACT(EPOCH FROM (MAX(ws.completed_at) - MIN(ws.started_at))) / 60,
                            0
                          )::numeric(6,1)
    ) AS row_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss      ON ss.session_exercise_id = se.id
    JOIN set_logs sl           ON sl.session_set_id = ss.id
    WHERE ws.user_id    = v_user_id
      AND ws.status     = 'completed'
      AND ws.completed_at >= (NOW() - INTERVAL '52 weeks')
    GROUP BY ws.completed_at::date
    ORDER BY ws.completed_at::date ASC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── Weekly volume over time ───────────────────────────────────────────────────
-- Returns one row per calendar week (ISO week starting Monday) from p_from_date
-- onwards. Useful for drawing a volume trend chart.

CREATE OR REPLACE FUNCTION get_stats_volume_over_time(p_from_date TIMESTAMPTZ)
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

  SELECT jsonb_agg(row_data ORDER BY row_data->>'week_start' ASC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'week_start', date_trunc('week', ws.completed_at)::date,
      'volume_kg',  COALESCE(
                      SUM(sl.actual_load_kg * sl.actual_reps)
                      FILTER (WHERE sl.completed = true AND sl.actual_load_kg IS NOT NULL AND sl.actual_reps IS NOT NULL),
                      0
                    )::numeric(10,2)
    ) AS row_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN session_sets ss      ON ss.session_exercise_id = se.id
    JOIN set_logs sl           ON sl.session_set_id = ss.id
    WHERE ws.user_id     = v_user_id
      AND ws.status      = 'completed'
      AND ws.completed_at >= p_from_date
    GROUP BY date_trunc('week', ws.completed_at)::date
    ORDER BY date_trunc('week', ws.completed_at)::date ASC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── Personal records ──────────────────────────────────────────────────────────
-- Returns all-time bests per exercise: heaviest weight, most reps, best set
-- volume, and estimated 1RM via the Epley formula (only for sets ≤ 10 reps).

CREATE OR REPLACE FUNCTION get_stats_personal_records()
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

  SELECT jsonb_agg(row_data ORDER BY row_data->>'exercise_name' ASC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'exercise_id',        e.id,
      'exercise_name',      e.name,
      'max_weight_kg',      MAX(sl.actual_load_kg)::numeric(8,2),
      'max_reps',           MAX(sl.actual_reps)::int,
      'max_volume_set_kg',  MAX(sl.actual_load_kg * sl.actual_reps)::numeric(10,2),
      'est_1rm_kg',         MAX(
                              CASE
                                WHEN sl.actual_reps <= 10 AND sl.actual_reps > 0
                                THEN ROUND((sl.actual_load_kg * (1.0 + sl.actual_reps::numeric / 30.0))::numeric, 1)
                                ELSE NULL
                              END
                            )
    ) AS row_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN exercises e           ON e.id = se.exercise_id
    JOIN session_sets ss       ON ss.session_exercise_id = se.id
    JOIN set_logs sl            ON sl.session_set_id = ss.id
    WHERE ws.user_id          = v_user_id
      AND ws.status           = 'completed'
      AND sl.completed        = true
      AND sl.actual_load_kg   IS NOT NULL
      AND sl.actual_reps      IS NOT NULL
    GROUP BY e.id, e.name
    ORDER BY e.name ASC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── Muscle distribution ───────────────────────────────────────────────────────
-- Returns completed-set counts per primary muscle from p_from_date onwards.
-- Uses LATERAL unnest so exercises that target multiple primary muscles are
-- counted once per muscle.

CREATE OR REPLACE FUNCTION get_stats_muscle_distribution(p_from_date TIMESTAMPTZ)
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

  SELECT jsonb_agg(row_data ORDER BY (row_data->>'set_count')::int DESC)
  INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'muscle',    muscle,
      'set_count', COUNT(sl.id)::int
    ) AS row_data
    FROM workout_sessions ws
    JOIN session_exercises se ON se.workout_session_id = ws.id
    JOIN exercises e           ON e.id = se.exercise_id
    CROSS JOIN LATERAL unnest(e.primary_muscles) AS muscle
    JOIN session_sets ss       ON ss.session_exercise_id = se.id
    JOIN set_logs sl            ON sl.session_set_id = ss.id
    WHERE ws.user_id     = v_user_id
      AND ws.status      = 'completed'
      AND sl.completed   = true
      AND ws.completed_at >= p_from_date
    GROUP BY muscle
    ORDER BY COUNT(sl.id) DESC
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
