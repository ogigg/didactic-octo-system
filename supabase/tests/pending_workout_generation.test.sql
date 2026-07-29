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
  'queue-owner@example.com',
  '',
  NOW(),
  '{}',
  '{}',
  NOW(),
  NOW()
);

SELECT set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000001',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.start_pending_workout_generation(
      '21000000-0000-0000-0000-000000000001',
      ARRAY['push', 'pull', 'legs']
    )
    WHERE started
  ),
  3::BIGINT,
  'starts one owned queue with every requested position'
);

SELECT results_eq(
  $$
    SELECT started
    FROM public.start_pending_workout_generation(
      '21000000-0000-0000-0000-000000000002',
      ARRAY['upper', 'lower']
    )
  $$,
  ARRAY[FALSE],
  'a concurrent rebuild cannot replace an in-flight queue'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.pending_workouts
    WHERE user_id = '11000000-0000-0000-0000-000000000001'
  ),
  3::BIGINT,
  'the skipped rebuild leaves the active rows intact'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.pending_workouts
    WHERE generation_run_id = '21000000-0000-0000-0000-000000000001'
  ),
  3::BIGINT,
  'all queue rows retain the first rebuild ownership token'
);

SELECT is_empty(
  $$
    UPDATE public.pending_workouts
    SET status = 'generating'
    WHERE user_id = '11000000-0000-0000-0000-000000000001'
      AND generation_run_id = '21000000-0000-0000-0000-000000000002'
    RETURNING id
  $$,
  'a stale generation-run token updates zero rows'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.pending_workouts
    WHERE generation_run_id = '21000000-0000-0000-0000-000000000001'
      AND status = 'queued'
  ),
  3::BIGINT,
  'a stale worker cannot change the active queue state'
);

UPDATE public.pending_workouts
SET status = 'failed'
WHERE user_id = '11000000-0000-0000-0000-000000000001';

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.start_pending_workout_generation(
      '21000000-0000-0000-0000-000000000002',
      ARRAY['upper', 'lower']
    )
    WHERE started
  ),
  2::BIGINT,
  'a new rebuild can atomically replace an inactive queue'
);

SELECT results_eq(
  $$
    SELECT generation_run_id, COUNT(*)
    FROM public.pending_workouts
    WHERE user_id = '11000000-0000-0000-0000-000000000001'
    GROUP BY generation_run_id
  $$,
  $$
    VALUES (
      '21000000-0000-0000-0000-000000000002'::UUID,
      2::BIGINT
    )
  $$,
  'only the replacement run remains'
);

SELECT * FROM finish();

ROLLBACK;
