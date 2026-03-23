-- Custom ENUM types for workout tracking
CREATE TYPE workout_status AS ENUM (
  'active',
  'completed',
  'discarded'
);

CREATE TYPE difficulty_feedback AS ENUM (
  'too_easy',
  'ok',
  'too_hard'
);

CREATE TYPE generation_source AS ENUM (
  'llm',
  'fallback_template',
  'fallback_substitution'
);

-- =============================================================================
-- TABLES
-- =============================================================================

-- exercises: Local exercise library, seeded from external APIs
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL,
  external_id TEXT UNIQUE,

  primary_muscles TEXT[] NOT NULL,
  secondary_muscles TEXT[],
  equipment TEXT[] NOT NULL,
  difficulty_level TEXT,
  instructions TEXT,

  image_url TEXT,
  video_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT exercises_name_not_empty CHECK (char_length(name) > 0),
  CONSTRAINT exercises_primary_muscles_not_empty CHECK (array_length(primary_muscles, 1) > 0)
);

COMMENT ON TABLE exercises IS 'Local exercise library for validation and workout generation';

-- workout_sessions: Main entity representing a workout session
CREATE TABLE workout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT,
  status workout_status NOT NULL DEFAULT 'active',
  generation_source generation_source NOT NULL DEFAULT 'llm',

  goal_snapshot goal_type NOT NULL,
  custom_goal_snapshot TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT workout_sessions_completed_after_start CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  )
);

COMMENT ON TABLE workout_sessions IS 'Workout session container tracking both plan and execution';

-- session_exercises: Junction table linking exercises to workout sessions
CREATE TABLE session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id UUID NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,

  order_index INTEGER NOT NULL,
  rest_duration_seconds INTEGER NOT NULL DEFAULT 60,

  notes TEXT,
  difficulty_feedback difficulty_feedback,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT session_exercises_unique_exercise_per_session
    UNIQUE (workout_session_id, exercise_id),
  CONSTRAINT session_exercises_unique_order_per_session
    UNIQUE (workout_session_id, order_index),
  CONSTRAINT session_exercises_order_positive CHECK (order_index >= 0),
  CONSTRAINT session_exercises_rest_positive CHECK (rest_duration_seconds >= 0)
);

COMMENT ON TABLE session_exercises IS 'Defines which exercises are in a workout session and their order';

-- session_sets: Planned/suggested sets for each exercise
CREATE TABLE session_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_exercise_id UUID NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,

  set_number INTEGER NOT NULL,
  set_type TEXT NOT NULL DEFAULT 'working',

  target_load_kg DECIMAL(5, 2) NOT NULL,
  target_reps INTEGER NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT session_sets_unique_set_per_exercise
    UNIQUE (session_exercise_id, set_number),
  CONSTRAINT session_sets_set_number_positive CHECK (set_number > 0),
  CONSTRAINT session_sets_set_type_valid CHECK (set_type IN ('warmup', 'working')),
  CONSTRAINT session_sets_target_load_non_negative CHECK (target_load_kg >= 0),
  CONSTRAINT session_sets_target_reps_positive CHECK (target_reps > 0)
);

COMMENT ON TABLE session_sets IS 'Planned/suggested sets for each exercise with target load and reps';

-- set_logs: Actual execution logs for each set
CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_set_id UUID NOT NULL REFERENCES session_sets(id) ON DELETE CASCADE,

  actual_load_kg DECIMAL(5, 2),
  actual_reps INTEGER,
  rpe DECIMAL(3, 1),

  completed BOOLEAN NOT NULL DEFAULT FALSE,
  not_completed_reason TEXT,

  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT set_logs_actual_load_non_negative CHECK (
    actual_load_kg IS NULL OR actual_load_kg >= 0
  ),
  CONSTRAINT set_logs_actual_reps_positive CHECK (
    actual_reps IS NULL OR actual_reps > 0
  ),
  CONSTRAINT set_logs_rpe_range CHECK (
    rpe IS NULL OR (rpe >= 1 AND rpe <= 10)
  ),
  CONSTRAINT set_logs_completed_requires_values CHECK (
    (completed = FALSE) OR (actual_load_kg IS NOT NULL AND actual_reps IS NOT NULL)
  ),
  CONSTRAINT set_logs_completed_after_start CHECK (
    completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at
  )
);

COMMENT ON TABLE set_logs IS 'Actual execution logs for each set. Highest-growth table.';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- exercises
CREATE INDEX idx_exercises_primary_muscles ON exercises USING GIN(primary_muscles);
CREATE INDEX idx_exercises_equipment ON exercises USING GIN(equipment);
CREATE INDEX idx_exercises_external_id ON exercises(external_id);

-- workout_sessions
CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_status ON workout_sessions(status);
CREATE INDEX idx_workout_sessions_created_at ON workout_sessions(created_at DESC);
CREATE INDEX idx_workout_sessions_user_status ON workout_sessions(user_id, status);
CREATE INDEX idx_workout_sessions_user_created ON workout_sessions(user_id, created_at DESC);

-- session_exercises
CREATE INDEX idx_session_exercises_workout_session_id ON session_exercises(workout_session_id);
CREATE INDEX idx_session_exercises_exercise_id ON session_exercises(exercise_id);
CREATE INDEX idx_session_exercises_order ON session_exercises(workout_session_id, order_index);

-- session_sets
CREATE INDEX idx_session_sets_session_exercise_id ON session_sets(session_exercise_id);
CREATE INDEX idx_session_sets_set_number ON session_sets(session_exercise_id, set_number);

-- set_logs
CREATE INDEX idx_set_logs_session_set_id ON set_logs(session_set_id);
CREATE INDEX idx_set_logs_created_at ON set_logs(created_at DESC);
CREATE INDEX idx_set_logs_completed ON set_logs(completed);

-- =============================================================================
-- TRIGGERS (reuse existing set_updated_at() from init migration)
-- =============================================================================

CREATE TRIGGER exercises_updated_at
  BEFORE UPDATE ON exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER workout_sessions_updated_at
  BEFORE UPDATE ON workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER session_exercises_updated_at
  BEFORE UPDATE ON session_exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER session_sets_updated_at
  BEFORE UPDATE ON session_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_logs_updated_at
  BEFORE UPDATE ON set_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW-LEVEL SECURITY
-- =============================================================================

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE set_logs ENABLE ROW LEVEL SECURITY;

-- exercises: public read for authenticated, write for service_role
CREATE POLICY exercises_select_authenticated ON exercises
  FOR SELECT TO authenticated USING (true);

CREATE POLICY exercises_modify_service_role ON exercises
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- workout_sessions: users access own data
CREATE POLICY workout_sessions_select_own ON workout_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY workout_sessions_insert_own ON workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY workout_sessions_update_own ON workout_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY workout_sessions_delete_own ON workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- session_exercises: access via parent workout_session ownership
CREATE POLICY session_exercises_select_own ON session_exercises
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_exercises.workout_session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_exercises_insert_own ON session_exercises
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_exercises.workout_session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_exercises_update_own ON session_exercises
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_exercises.workout_session_id
      AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_exercises.workout_session_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_exercises_delete_own ON session_exercises
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = session_exercises.workout_session_id
      AND ws.user_id = auth.uid()
    )
  );

-- session_sets: access via parent chain (session_exercises -> workout_sessions)
CREATE POLICY session_sets_select_own ON session_sets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE se.id = session_sets.session_exercise_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_sets_insert_own ON session_sets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE se.id = session_sets.session_exercise_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_sets_update_own ON session_sets
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE se.id = session_sets.session_exercise_id
      AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE se.id = session_sets.session_exercise_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY session_sets_delete_own ON session_sets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM session_exercises se
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE se.id = session_sets.session_exercise_id
      AND ws.user_id = auth.uid()
    )
  );

-- set_logs: access via parent chain (session_sets -> session_exercises -> workout_sessions)
CREATE POLICY set_logs_select_own ON set_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE ss.id = set_logs.session_set_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY set_logs_insert_own ON set_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE ss.id = set_logs.session_set_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY set_logs_update_own ON set_logs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE ss.id = set_logs.session_set_id
      AND ws.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE ss.id = set_logs.session_set_id
      AND ws.user_id = auth.uid()
    )
  );

CREATE POLICY set_logs_delete_own ON set_logs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM session_sets ss
      JOIN session_exercises se ON se.id = ss.session_exercise_id
      JOIN workout_sessions ws ON ws.id = se.workout_session_id
      WHERE ss.id = set_logs.session_set_id
      AND ws.user_id = auth.uid()
    )
  );

-- =============================================================================
-- RPC FUNCTION: Get full workout session detail with nested data
-- =============================================================================

CREATE OR REPLACE FUNCTION get_workout_session_detail(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_user_id UUID;
BEGIN
  -- Enforce ownership check (SECURITY DEFINER bypasses RLS)
  SELECT user_id INTO v_user_id
  FROM workout_sessions
  WHERE id = p_session_id;

  IF v_user_id IS NULL OR v_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Not found or not authorized';
  END IF;

  SELECT jsonb_build_object(
    'id', ws.id,
    'name', ws.name,
    'status', ws.status,
    'generation_source', ws.generation_source,
    'goal_snapshot', ws.goal_snapshot,
    'started_at', ws.started_at,
    'completed_at', ws.completed_at,
    'created_at', ws.created_at,
    'exercises', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', se.id,
          'exercise_id', se.exercise_id,
          'exercise_name', e.name,
          'order_index', se.order_index,
          'rest_duration_seconds', se.rest_duration_seconds,
          'notes', se.notes,
          'difficulty_feedback', se.difficulty_feedback,
          'sets', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', ss.id,
                'set_number', ss.set_number,
                'set_type', ss.set_type,
                'target_load_kg', ss.target_load_kg,
                'target_reps', ss.target_reps,
                'log', (
                  SELECT jsonb_build_object(
                    'id', sl.id,
                    'actual_load_kg', sl.actual_load_kg,
                    'actual_reps', sl.actual_reps,
                    'rpe', sl.rpe,
                    'completed', sl.completed,
                    'not_completed_reason', sl.not_completed_reason
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
