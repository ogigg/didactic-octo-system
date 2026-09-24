BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(8);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '11000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'warmup-history@example.com',
  '',
  NOW(),
  '{}',
  '{}',
  NOW(),
  NOW()
);

INSERT INTO exercises (
  id,
  name,
  primary_muscles,
  equipment,
  exercise_type
)
VALUES (
  '21000000-0000-0000-0000-000000000001',
  'Warmup History Press',
  ARRAY['chest'],
  ARRAY['barbell'],
  'weight'
);

-- Older completed occurrence (should lose to a newer completed one).
INSERT INTO workout_sessions (
  id,
  user_id,
  name,
  status,
  goal_snapshot,
  started_at,
  completed_at
)
VALUES (
  '31000000-0000-0000-0000-000000000010',
  '11000000-0000-0000-0000-000000000001',
  'Older completed session',
  'completed',
  'build_strength',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '2 days'
);

INSERT INTO session_exercises (
  id,
  workout_session_id,
  exercise_id,
  order_index,
  rest_duration_seconds
)
VALUES (
  '41000000-0000-0000-0000-000000000010',
  '31000000-0000-0000-0000-000000000010',
  '21000000-0000-0000-0000-000000000001',
  0,
  90
);

INSERT INTO session_sets (
  id,
  session_exercise_id,
  set_number,
  set_type,
  target_load_kg,
  target_reps
)
VALUES
  (
    '51000000-0000-0000-0000-000000000010',
    '41000000-0000-0000-0000-000000000010',
    1,
    'warmup',
    15,
    10
  ),
  (
    '51000000-0000-0000-0000-000000000011',
    '41000000-0000-0000-0000-000000000010',
    2,
    'working',
    30,
    10
  );

INSERT INTO set_logs (
  id,
  session_set_id,
  actual_load_kg,
  actual_reps,
  rpe,
  completed
)
VALUES
  (
    '61000000-0000-0000-0000-000000000010',
    '51000000-0000-0000-0000-000000000010',
    15,
    10,
    NULL,
    true
  ),
  (
    '61000000-0000-0000-0000-000000000011',
    '51000000-0000-0000-0000-000000000011',
    30,
    10,
    7,
    true
  );

-- Newer completed occurrence with W 20x10 + three working 40x10.
INSERT INTO workout_sessions (
  id,
  user_id,
  name,
  status,
  goal_snapshot,
  started_at,
  completed_at
)
VALUES (
  '31000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'Warmup history session',
  'completed',
  'build_strength',
  NOW() - INTERVAL '1 hour',
  NOW() - INTERVAL '30 minutes'
);

INSERT INTO session_exercises (
  id,
  workout_session_id,
  exercise_id,
  order_index,
  rest_duration_seconds
)
VALUES (
  '41000000-0000-0000-0000-000000000001',
  '31000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001',
  0,
  90
);

INSERT INTO session_sets (
  id,
  session_exercise_id,
  set_number,
  set_type,
  target_load_kg,
  target_reps
)
VALUES
  (
    '51000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    1,
    'warmup',
    20,
    10
  ),
  (
    '51000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000001',
    2,
    'working',
    40,
    10
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000001',
    3,
    'working',
    40,
    10
  ),
  (
    '51000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000001',
    4,
    'working',
    40,
    10
  );

INSERT INTO set_logs (
  id,
  session_set_id,
  actual_load_kg,
  actual_reps,
  rpe,
  completed
)
VALUES
  (
    '61000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    20,
    10,
    NULL,
    true
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000002',
    40,
    10,
    8,
    true
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000003',
    40,
    10,
    8,
    true
  ),
  (
    '61000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000004',
    40,
    10,
    8,
    true
  );

-- Newer incomplete/active workout must be ignored for previous history.
INSERT INTO workout_sessions (
  id,
  user_id,
  name,
  status,
  goal_snapshot,
  started_at,
  completed_at
)
VALUES (
  '31000000-0000-0000-0000-000000000099',
  '11000000-0000-0000-0000-000000000001',
  'Incomplete newer session',
  'active',
  'build_strength',
  NOW() - INTERVAL '5 minutes',
  NULL
);

INSERT INTO session_exercises (
  id,
  workout_session_id,
  exercise_id,
  order_index,
  rest_duration_seconds
)
VALUES (
  '41000000-0000-0000-0000-000000000099',
  '31000000-0000-0000-0000-000000000099',
  '21000000-0000-0000-0000-000000000001',
  0,
  90
);

INSERT INTO session_sets (
  id,
  session_exercise_id,
  set_number,
  set_type,
  target_load_kg,
  target_reps
)
VALUES
  (
    '51000000-0000-0000-0000-000000000099',
    '41000000-0000-0000-0000-000000000099',
    1,
    'warmup',
    99,
    10
  ),
  (
    '51000000-0000-0000-0000-000000000100',
    '41000000-0000-0000-0000-000000000099',
    2,
    'working',
    99,
    10
  );

INSERT INTO set_logs (
  id,
  session_set_id,
  actual_load_kg,
  actual_reps,
  rpe,
  completed
)
VALUES
  (
    '61000000-0000-0000-0000-000000000099',
    '51000000-0000-0000-0000-000000000099',
    99,
    10,
    NULL,
    true
  ),
  (
    '61000000-0000-0000-0000-000000000100',
    '51000000-0000-0000-0000-000000000100',
    99,
    10,
    9,
    true
  );

SELECT set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000001',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT is(
  (
    SELECT session_id
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  '31000000-0000-0000-0000-000000000001'::uuid,
  'newer completed occurrence wins over older completed history'
);

SELECT is(
  (
    SELECT jsonb_array_length(warmup_sets)
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  1,
  'warmup_sets includes the completed warmup log'
);

SELECT is(
  (
    SELECT jsonb_array_length(working_sets)
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  3,
  'working_sets remain working-only'
);

SELECT is(
  (
    SELECT (warmup_sets->0->>'load_kg')::numeric
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  20::numeric,
  'warmup_sets expose warmup load separately'
);

SELECT is(
  (
    SELECT (working_sets->0->>'load_kg')::numeric
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  40::numeric,
  'working_sets are not contaminated by warmup load'
);

SELECT is(
  (
    SELECT (warmup_sets->0->>'load_kg')::numeric
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  20::numeric,
  'older completed warmup load is not used'
);

SELECT isnt(
  (
    SELECT (warmup_sets->0->>'load_kg')::numeric
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  99::numeric,
  'newer incomplete workout warmup is ignored'
);

SELECT isnt(
  (
    SELECT (working_sets->0->>'load_kg')::numeric
    FROM get_exercise_progression_history(
      '11000000-0000-0000-0000-000000000001',
      ARRAY['21000000-0000-0000-0000-000000000001'::uuid]
    )
  ),
  99::numeric,
  'newer incomplete workout working load is ignored'
);

SELECT * FROM finish();

ROLLBACK;
