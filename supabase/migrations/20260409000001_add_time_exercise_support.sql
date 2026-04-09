-- -----------------------------------------------------------------------------
-- Migration: add_time_exercise_support
-- Adds 'time' exercise type (e.g. plank, wall sit) with duration-based tracking
-- instead of weight/reps.
-- -----------------------------------------------------------------------------

-- 1. Add exercise_type to exercises
ALTER TABLE exercises ADD COLUMN exercise_type TEXT NOT NULL DEFAULT 'weight'
  CONSTRAINT exercises_type_valid CHECK (exercise_type IN ('weight', 'time'));

-- 2. Add target_duration_seconds to session_sets
ALTER TABLE session_sets ADD COLUMN target_duration_seconds INTEGER;
ALTER TABLE session_sets ADD CONSTRAINT session_sets_target_duration_positive
  CHECK (target_duration_seconds IS NULL OR target_duration_seconds > 0);

-- 3. Make target_load_kg and target_reps nullable (time exercises don't use them)
ALTER TABLE session_sets ALTER COLUMN target_load_kg DROP NOT NULL;
ALTER TABLE session_sets ALTER COLUMN target_reps DROP NOT NULL;

-- Drop old non-null-aware constraints
ALTER TABLE session_sets DROP CONSTRAINT session_sets_target_load_non_negative;
ALTER TABLE session_sets DROP CONSTRAINT session_sets_target_reps_positive;

-- Recreate as nullable-aware
ALTER TABLE session_sets ADD CONSTRAINT session_sets_target_load_non_negative
  CHECK (target_load_kg IS NULL OR target_load_kg >= 0);
ALTER TABLE session_sets ADD CONSTRAINT session_sets_target_reps_positive
  CHECK (target_reps IS NULL OR target_reps > 0);

-- Ensure every set has either weight/reps targets OR a duration target
ALTER TABLE session_sets ADD CONSTRAINT session_sets_has_targets
  CHECK (
    (target_load_kg IS NOT NULL AND target_reps IS NOT NULL)
    OR target_duration_seconds IS NOT NULL
  );

-- 4. Add actual_duration_seconds to set_logs
ALTER TABLE set_logs ADD COLUMN actual_duration_seconds INTEGER;
ALTER TABLE set_logs ADD CONSTRAINT set_logs_actual_duration_non_negative
  CHECK (actual_duration_seconds IS NULL OR actual_duration_seconds >= 0);

-- 5. Relax completion constraint to allow duration-based completion
ALTER TABLE set_logs DROP CONSTRAINT set_logs_completed_requires_values;
ALTER TABLE set_logs ADD CONSTRAINT set_logs_completed_requires_values
  CHECK (
    (completed = FALSE)
    OR (actual_load_kg IS NOT NULL AND actual_reps IS NOT NULL)
    OR (actual_duration_seconds IS NOT NULL)
  );

-- 6. Seed common time-based exercises
INSERT INTO exercises (name, exercise_type, primary_muscles, secondary_muscles, equipment, difficulty_level, instructions)
VALUES
  ('Plank', 'time', ARRAY['Rectus abdominis'], ARRAY['Erector spinae'], ARRAY['bodyweight'], 'beginner',
   'Start in a push-up position with arms straight or resting on forearms. Keep your body in a straight line from head to heels. Squeeze your core and glutes throughout. Breathe steadily and hold for the target duration.'),
  ('Side Plank', 'time', ARRAY['Rectus abdominis'], ARRAY['Lateral deltoid'], ARRAY['bodyweight'], 'beginner',
   'Lie on your side and prop yourself up on one forearm with elbow directly below your shoulder. Raise your hips so your body forms a straight line from head to feet. Hold the position, then switch sides.'),
  ('Wall Sit', 'time', ARRAY['Quadriceps'], ARRAY['Gluteus maximus', 'Hamstrings'], ARRAY['bodyweight'], 'beginner',
   'Stand with your back flat against a wall. Slide down until your thighs are parallel to the floor and your knees are at a 90-degree angle. Keep your back flat against the wall and hold for the target duration.'),
  ('Dead Hang', 'time', ARRAY['Brachialis'], ARRAY['Latissimus dorsi'], ARRAY['bodyweight'], 'beginner',
   'Grip a pull-up bar with both hands shoulder-width apart, palms facing away. Let your body hang fully extended with arms straight. Maintain a slight retraction of your shoulder blades. Hang for the target duration.'),
  ('L-Sit Hold', 'time', ARRAY['Rectus abdominis'], ARRAY['Triceps brachii'], ARRAY['bodyweight'], 'intermediate',
   'Sit on the floor with legs extended. Place your hands next to your hips, fingers pointing forward. Press down to lift your body off the floor, extending your legs straight out in front at hip height. Hold for the target duration.');

-- 7. Update get_workout_session_detail to include exercise_type and duration fields
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

-- 8. Update get_exercise_progression_history to include exercise_type and duration
DROP FUNCTION IF EXISTS get_exercise_progression_history(UUID, UUID[]);

CREATE FUNCTION get_exercise_progression_history(
  p_user_id UUID,
  p_exercise_ids UUID[]
)
RETURNS TABLE (
  exercise_id UUID,
  exercise_type TEXT,
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
    e.exercise_type,
    ws.completed_at AS session_completed_at,
    se.difficulty_feedback::TEXT,
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'load_kg',          sl.actual_load_kg,
          'reps',             sl.actual_reps,
          'duration_seconds', sl.actual_duration_seconds,
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
    AND ws.status = 'completed'
    AND se.exercise_id = ANY(p_exercise_ids)
  ORDER BY se.exercise_id, ws.completed_at DESC
$$;

-- 9. Update get_exercise_detail to support time exercises
CREATE OR REPLACE FUNCTION get_exercise_detail(p_exercise_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id     UUID;
  v_exercise_type TEXT;
  v_records     JSONB;
  v_volume_weeks JSONB;
  v_sessions    JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT exercise_type INTO v_exercise_type FROM exercises WHERE id = p_exercise_id;

  IF v_exercise_type = 'time' THEN
    -- ─── Time Exercise: Personal Records ─────────────────────────────────────
    SELECT jsonb_build_object(
      'max_weight_kg',        0,
      'max_weight_date',      NULL,
      'max_reps',             0,
      'max_reps_date',        NULL,
      'max_volume_set_kg',    0,
      'max_volume_set_date',  NULL,
      'est_1rm_kg',           NULL,
      'max_rpe',              (
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
      ),
      'max_duration_seconds', (
        SELECT MAX(sl4.actual_duration_seconds)
        FROM set_logs sl4
        JOIN session_sets ss4 ON ss4.id = sl4.session_set_id
        JOIN session_exercises se4 ON se4.id = ss4.session_exercise_id
        JOIN workout_sessions ws4 ON ws4.id = se4.workout_session_id
        WHERE ws4.user_id = v_user_id
          AND ws4.status = 'completed'
          AND se4.exercise_id = p_exercise_id
          AND sl4.completed = true
          AND sl4.actual_duration_seconds IS NOT NULL
      ),
      'max_duration_date',    (
        SELECT ws5.completed_at::date
        FROM set_logs sl5
        JOIN session_sets ss5 ON ss5.id = sl5.session_set_id
        JOIN session_exercises se5 ON se5.id = ss5.session_exercise_id
        JOIN workout_sessions ws5 ON ws5.id = se5.workout_session_id
        WHERE ws5.user_id = v_user_id
          AND ws5.status = 'completed'
          AND se5.exercise_id = p_exercise_id
          AND sl5.completed = true
          AND sl5.actual_duration_seconds IS NOT NULL
        ORDER BY sl5.actual_duration_seconds DESC, ws5.completed_at DESC
        LIMIT 1
      )
    )
    INTO v_records;

    -- ─── Time Exercise: Weekly Volume (total hold time) ──────────────────────
    SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'week_start' ASC), '[]'::jsonb)
    INTO v_volume_weeks
    FROM (
      SELECT jsonb_build_object(
        'week_start',           date_trunc('week', ws.completed_at)::date,
        'volume_kg',            0,
        'total_duration_seconds', SUM(sl.actual_duration_seconds)
      ) AS row_data
      FROM workout_sessions ws
      JOIN session_exercises se ON se.workout_session_id = ws.id
      JOIN session_sets ss ON ss.session_exercise_id = se.id
      JOIN set_logs sl ON sl.session_set_id = ss.id
      WHERE ws.user_id = v_user_id
        AND ws.status = 'completed'
        AND se.exercise_id = p_exercise_id
        AND sl.completed = true
        AND sl.actual_duration_seconds IS NOT NULL
        AND ws.completed_at >= (NOW() - INTERVAL '52 weeks')
      GROUP BY date_trunc('week', ws.completed_at)::date
    ) sub;

    -- ─── Time Exercise: Session History ──────────────────────────────────────
    SELECT COALESCE(jsonb_agg(session_data ORDER BY session_data->>'date' DESC), '[]'::jsonb)
    INTO v_sessions
    FROM (
      SELECT jsonb_build_object(
        'date',         ws.completed_at::date,
        'workout_name', ws.name,
        'sets',         (
          SELECT jsonb_agg(
            jsonb_build_object(
              'set_number',      ss.set_number,
              'load_kg',         NULL,
              'reps',            NULL,
              'duration_seconds', sl.actual_duration_seconds,
              'rpe',             sl.rpe
            )
            ORDER BY ss.set_number
          )
          FROM session_sets ss
          JOIN set_logs sl ON sl.session_set_id = ss.id
          WHERE ss.session_exercise_id = se.id
            AND sl.completed = true
        )
      ) AS session_data
      FROM workout_sessions ws
      JOIN session_exercises se ON se.workout_session_id = ws.id
      WHERE ws.user_id = v_user_id
        AND ws.status = 'completed'
        AND se.exercise_id = p_exercise_id
        AND EXISTS (
          SELECT 1
          FROM session_sets ss2
          JOIN set_logs sl2 ON sl2.session_set_id = ss2.id
          WHERE ss2.session_exercise_id = se.id
            AND sl2.completed = true
            AND sl2.actual_duration_seconds IS NOT NULL
        )
      ORDER BY ws.completed_at DESC
      LIMIT 50
    ) sub;

  ELSE
    -- ─── Weight Exercise: Personal Records with achievement dates ────────────
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
                           ),
      'max_duration_seconds', NULL,
      'max_duration_date',    NULL
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

    -- ─── Weight Exercise: Weekly Volume (last 52 weeks) ─────────────────────
    SELECT COALESCE(jsonb_agg(row_data ORDER BY row_data->>'week_start' ASC), '[]'::jsonb)
    INTO v_volume_weeks
    FROM (
      SELECT jsonb_build_object(
        'week_start', date_trunc('week', ws.completed_at)::date,
        'volume_kg',  SUM(sl.actual_load_kg * sl.actual_reps)::numeric(10,2),
        'total_duration_seconds', NULL
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

    -- ─── Weight Exercise: Session History ────────────────────────────────────
    SELECT COALESCE(jsonb_agg(session_data ORDER BY session_data->>'date' DESC), '[]'::jsonb)
    INTO v_sessions
    FROM (
      SELECT jsonb_build_object(
        'date',         ws.completed_at::date,
        'workout_name', ws.name,
        'sets',         (
          SELECT jsonb_agg(
            jsonb_build_object(
              'set_number',      ss.set_number,
              'load_kg',         sl.actual_load_kg,
              'reps',            sl.actual_reps,
              'duration_seconds', NULL,
              'rpe',             sl.rpe
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

  END IF;

  RETURN jsonb_build_object(
    'exercise_type',  COALESCE(v_exercise_type, 'weight'),
    'records',        COALESCE(v_records, jsonb_build_object(
      'max_weight_kg', 0, 'max_weight_date', NULL,
      'max_reps', 0, 'max_reps_date', NULL,
      'max_volume_set_kg', 0, 'max_volume_set_date', NULL,
      'est_1rm_kg', NULL, 'max_rpe', NULL,
      'max_duration_seconds', NULL, 'max_duration_date', NULL
    )),
    'volume_weeks',   v_volume_weeks,
    'sessions',       v_sessions
  );
END;
$$;
