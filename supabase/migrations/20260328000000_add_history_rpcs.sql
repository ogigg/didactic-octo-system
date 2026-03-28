-- -----------------------------------------------------------------------------
-- Migration: add_history_rpcs
-- Adds get_workout_history_page RPC for paginated history list
-- Extends get_workout_session_detail to include primary_muscles per exercise
-- -----------------------------------------------------------------------------

-- ─── Paginated history list ────────────────────────────────────────────────────
-- Returns completed workout sessions in reverse-chronological order.
-- Cursor is the completed_at of the last item from the previous page.
-- Each row includes pre-computed summary fields so the list card can render
-- without further queries.

CREATE OR REPLACE FUNCTION get_workout_history_page(
  p_limit       INT,
  p_cursor      TIMESTAMPTZ DEFAULT NULL
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
      AND (p_cursor IS NULL OR ws.completed_at < p_cursor)
    ORDER BY ws.completed_at DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- ─── Extended workout detail (adds primary_muscles) ────────────────────────────
-- Replaces the existing function to include primary_muscles[] per exercise.

CREATE OR REPLACE FUNCTION get_workout_session_detail(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result  JSONB;
  v_user_id UUID;
BEGIN
  SELECT user_id INTO v_user_id
  FROM workout_sessions
  WHERE id = p_session_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not found or not authorized';
  END IF;

  SELECT jsonb_build_object(
    'id',                ws.id,
    'name',              ws.name,
    'status',            ws.status,
    'generation_source', ws.generation_source,
    'goal_snapshot',     ws.goal_snapshot,
    'started_at',        ws.started_at,
    'completed_at',      ws.completed_at,
    'created_at',        ws.created_at,
    'exercises', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                   se.id,
          'exercise_id',          se.exercise_id,
          'exercise_name',        e.name,
          'primary_muscles',      e.primary_muscles,
          'order_index',          se.order_index,
          'rest_duration_seconds',se.rest_duration_seconds,
          'notes',                se.notes,
          'difficulty_feedback',  se.difficulty_feedback,
          'sets', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',             ss.id,
                'set_number',     ss.set_number,
                'set_type',       ss.set_type,
                'target_load_kg', ss.target_load_kg,
                'target_reps',    ss.target_reps,
                'log', (
                  SELECT jsonb_build_object(
                    'id',                    sl.id,
                    'actual_load_kg',        sl.actual_load_kg,
                    'actual_reps',           sl.actual_reps,
                    'rpe',                   sl.rpe,
                    'completed',             sl.completed,
                    'not_completed_reason',  sl.not_completed_reason
                  )
                  FROM set_logs sl
                  WHERE sl.session_set_id = ss.id
                  ORDER BY sl.created_at DESC
                  LIMIT 1
                )
              ) ORDER BY ss.set_number
            )
            FROM session_sets ss
            WHERE ss.session_exercise_id = se.id
          ), '[]'::jsonb)
        ) ORDER BY se.order_index
      )
      FROM session_exercises se
      JOIN exercises e ON e.id = se.exercise_id
      WHERE se.workout_session_id = ws.id
    ), '[]'::jsonb)
  ) INTO v_result
  FROM workout_sessions ws
  WHERE ws.id = p_session_id;

  RETURN v_result;
END;
$$;
