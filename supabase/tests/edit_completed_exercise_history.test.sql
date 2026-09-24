BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(10);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES
  ('11000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'history-owner@example.com', '', NOW(), '{}', '{}', NOW(), NOW()),
  ('11000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'history-other@example.com', '', NOW(), '{}', '{}', NOW(), NOW());

INSERT INTO exercises (id, name, primary_muscles, equipment)
VALUES ('21000000-0000-0000-0000-000000000001', 'History Test Press', ARRAY['chest'], ARRAY['barbell']);

INSERT INTO workout_sessions (
  id, user_id, name, status, goal_snapshot, started_at, completed_at
) VALUES
  ('31000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'Owner workout', 'completed', 'build_strength', NOW() - INTERVAL '1 hour', NOW()),
  ('31000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000002', 'Other workout', 'completed', 'build_strength', NOW() - INTERVAL '1 hour', NOW());

INSERT INTO session_exercises (
  id, workout_session_id, exercise_id, order_index, rest_duration_seconds
) VALUES
  ('41000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 0, 90),
  ('41000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 0, 90);

INSERT INTO session_sets (
  id, session_exercise_id, set_number, set_type, target_load_kg, target_reps
) VALUES
  ('51000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000001', 1, 'working', 80, 8),
  ('51000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000002', 1, 'working', 60, 10);

INSERT INTO set_logs (session_set_id, actual_load_kg, actual_reps, rpe, completed)
VALUES
  ('51000000-0000-0000-0000-000000000001', 80, 8, 7, TRUE),
  ('51000000-0000-0000-0000-000000000002', 60, 10, 8, TRUE);

SELECT set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', TRUE);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT is(
  jsonb_array_length(public.get_editable_exercise_history('21000000-0000-0000-0000-000000000001')),
  1,
  'history only returns the authenticated user exercise occurrence'
);

SELECT public.update_completed_exercise_sets(
  '41000000-0000-0000-0000-000000000001',
  '[
    {"id":"51000000-0000-0000-0000-000000000001","set_type":"working","actual_load_kg":82.5,"actual_reps":6,"rpe":8.5},
    {"set_type":"working","actual_load_kg":75,"actual_reps":10,"rpe":8}
  ]'::jsonb
);

RESET ROLE;

SELECT is(
  (SELECT COUNT(*) FROM session_sets WHERE session_exercise_id = '41000000-0000-0000-0000-000000000001'),
  2::BIGINT,
  'adds a completed series'
);
SELECT is(
  (SELECT set_number FROM session_sets WHERE id = '51000000-0000-0000-0000-000000000001'),
  1,
  'preserves an existing set ID and order'
);
SELECT is(
  (SELECT actual_load_kg FROM set_logs WHERE session_set_id = '51000000-0000-0000-0000-000000000001'),
  82.5::numeric,
  'updates the logged weight'
);
SELECT is(
  (SELECT actual_reps FROM set_logs WHERE session_set_id = '51000000-0000-0000-0000-000000000001'),
  6,
  'updates the logged reps'
);
SELECT is(
  (SELECT rpe FROM set_logs WHERE session_set_id = '51000000-0000-0000-0000-000000000001'),
  8.5::numeric,
  'updates the logged RPE'
);

SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$
    SELECT public.update_completed_exercise_sets(
      '41000000-0000-0000-0000-000000000002',
      '[{"set_type":"working","actual_load_kg":100,"actual_reps":1}]'::jsonb
    )
  $$,
  'P0001',
  'Completed exercise not found or not authorized',
  'rejects edits to another user history'
);

SELECT public.delete_completed_session_exercise(
  '41000000-0000-0000-0000-000000000001'
);

RESET ROLE;

SELECT is(
  (SELECT COUNT(*) FROM session_exercises WHERE id = '41000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'deletes the owned completed exercise occurrence'
);
SELECT is(
  (SELECT COUNT(*) FROM session_sets WHERE session_exercise_id = '41000000-0000-0000-0000-000000000001'),
  0::BIGINT,
  'exercise deletion cascades to session sets'
);
SELECT is(
  (
    SELECT COUNT(*)
    FROM set_logs sl
    WHERE NOT EXISTS (SELECT 1 FROM session_sets ss WHERE ss.id = sl.session_set_id)
  ),
  0::BIGINT,
  'exercise deletion leaves no orphaned set logs'
);

SELECT * FROM finish();

ROLLBACK;
