-- -----------------------------------------------------------------------------
-- Migration: add_workout_warmup
-- Adds a timer-only, session-level warmup that is distinct from exercise warmup
-- sets and excluded from exercise progression history.
-- -----------------------------------------------------------------------------

ALTER TABLE workout_sessions
  ADD COLUMN warmup_duration_seconds INTEGER,
  ADD COLUMN warmup_completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE workout_sessions
  ADD CONSTRAINT workout_sessions_warmup_duration_positive
  CHECK (
    warmup_duration_seconds IS NULL
    OR warmup_duration_seconds > 0
  );

ALTER TABLE workout_sessions
  ADD CONSTRAINT workout_sessions_warmup_completed_requires_duration
  CHECK (
    warmup_completed = FALSE
    OR warmup_duration_seconds IS NOT NULL
  );

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
    'warmup', CASE
      WHEN ws.warmup_duration_seconds IS NULL THEN NULL
      ELSE jsonb_build_object(
        'duration_seconds', ws.warmup_duration_seconds,
        'completed',        ws.warmup_completed
      )
    END,
    'exercises', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id',                   se.id,
          'exercise_id',          se.exercise_id,
          'exercise_name',        e.name,
          'exercise_type',        e.exercise_type,
          'primary_muscles',      e.primary_muscles,
          'order_index',          se.order_index,
          'rest_duration_seconds',se.rest_duration_seconds,
          'notes',                se.notes,
          'difficulty_feedback',  se.difficulty_feedback,
          'sets', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id',                     ss.id,
                'set_number',             ss.set_number,
                'set_type',               ss.set_type,
                'target_load_kg',         ss.target_load_kg,
                'target_reps',            ss.target_reps,
                'target_duration_seconds',ss.target_duration_seconds,
                'log', (
                  SELECT jsonb_build_object(
                    'id',                    sl.id,
                    'actual_load_kg',        sl.actual_load_kg,
                    'actual_reps',           sl.actual_reps,
                    'actual_duration_seconds', sl.actual_duration_seconds,
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
