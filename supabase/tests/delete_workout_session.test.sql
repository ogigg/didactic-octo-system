BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(9);

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
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'delete-owner@example.com',
    '',
    NOW(),
    '{}',
    '{}',
    NOW(),
    NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'delete-other@example.com',
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
  equipment
)
VALUES (
  '20000000-0000-0000-0000-000000000001',
  'Cascade Test Press',
  ARRAY['chest'],
  ARRAY['barbell']
);

INSERT INTO workout_sessions (
  id,
  user_id,
  name,
  status,
  goal_snapshot,
  started_at,
  completed_at,
  health_record_id
)
VALUES
  (
    '30000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Delete me',
    'completed',
    'build_strength',
    NOW() - INTERVAL '1 hour',
    NOW(),
    'health-record-id'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'Keep me',
    'completed',
    'build_strength',
    NOW() - INTERVAL '1 hour',
    NOW(),
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
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
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
VALUES (
  '50000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  1,
  'working',
  80,
  8
);

INSERT INTO set_logs (
  id,
  session_set_id,
  actual_load_kg,
  actual_reps,
  completed
)
VALUES (
  '60000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  80,
  8,
  TRUE
);

INSERT INTO workout_session_comments (
  id,
  user_id,
  workout_session_id,
  comment
)
VALUES (
  '70000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Remove this generation context too.'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$
    SELECT health_record_id
    FROM public.delete_workout_session(
      '30000000-0000-0000-0000-000000000001'
    )
  $$,
  ARRAY['health-record-id'::TEXT],
  'returns the deleted workout health record ID'
);

RESET ROLE;

SELECT is(
  (SELECT COUNT(*) FROM workout_sessions WHERE id = '30000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'deletes the workout session'
);
SELECT is(
  (SELECT COUNT(*) FROM session_exercises WHERE id = '40000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'cascades to session exercises'
);
SELECT is(
  (SELECT COUNT(*) FROM session_sets WHERE id = '50000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'cascades to session sets'
);
SELECT is(
  (SELECT COUNT(*) FROM set_logs WHERE id = '60000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'cascades to set logs'
);
SELECT is(
  (SELECT COUNT(*) FROM workout_session_comments WHERE id = '70000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'cascades to workout comments'
);
SELECT is(
  (SELECT COUNT(*) FROM workout_sessions WHERE id = '30000000-0000-0000-0000-000000000002'),
  1::BIGINT,
  'keeps another user workout'
);

SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$
    SELECT *
    FROM public.delete_workout_session(
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  'P0002',
  'Completed workout not found',
  'rejects deletion of another user workout'
);

SELECT throws_ok(
  $$
    SELECT *
    FROM public.delete_workout_session(
      '30000000-0000-0000-0000-000000000001'
    )
  $$,
  'P0002',
  'Completed workout not found',
  'rejects a repeated deletion instead of silently succeeding'
);

SELECT * FROM finish();

ROLLBACK;
