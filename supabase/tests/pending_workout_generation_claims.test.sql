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
VALUES (
  '10000000-0000-0000-0000-000000000092',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'recovery-owner@example.com',
  '',
  NOW(),
  '{}',
  '{}',
  NOW(),
  NOW()
);

INSERT INTO public.pending_workouts (
  id,
  user_id,
  queue_position,
  status,
  user_edits,
  updated_at
)
VALUES (
  '92000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000092',
  1,
  'failed',
  '{"sets":[99]}'::JSONB,
  NOW() - INTERVAL '10 minutes'
);

SELECT set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000092',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

CREATE TEMP TABLE claimed_generation AS
SELECT *
FROM public.claim_pending_workout_generation(
  '92000000-0000-0000-0000-000000000001',
  0,
  'recovery',
  FALSE
);

SELECT is(
  (SELECT COUNT(*) FROM claimed_generation),
  1::BIGINT,
  'the first recovery worker atomically claims the slot'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM public.claim_pending_workout_generation(
      '92000000-0000-0000-0000-000000000001',
      0,
      'recovery',
      FALSE
    )
  ),
  0::BIGINT,
  'a concurrent worker with the stale version cannot claim'
);

SELECT is(
  (
    SELECT public.replace_pending_workout_with_fallback(
      '92000000-0000-0000-0000-000000000001',
      1,
      '{"workout_name":"Fallback winner"}'::JSONB
    )
  ),
  TRUE,
  'fallback atomically supersedes the claimed worker'
);

SELECT is(
  (
    SELECT public.complete_pending_workout_generation(
      '92000000-0000-0000-0000-000000000001',
      generation_version,
      claim_token,
      '{"workout_name":"Late worker"}'::JSONB,
      'llm',
      TRUE,
      NULL
    )
    FROM claimed_generation
  ),
  FALSE,
  'late completion becomes a no-op'
);

SELECT is(
  (
    SELECT public.fail_pending_workout_generation(
      '92000000-0000-0000-0000-000000000001',
      generation_version,
      claim_token
    )
    FROM claimed_generation
  ),
  FALSE,
  'late failure restoration becomes a no-op'
);

RESET ROLE;

SELECT is(
  (
    SELECT workout_data ->> 'workout_name'
    FROM public.pending_workouts
    WHERE id = '92000000-0000-0000-0000-000000000001'
  ),
  'Fallback winner',
  'fallback data remains the winner'
);

SELECT is(
  (
    SELECT generation_version
    FROM public.pending_workouts
    WHERE id = '92000000-0000-0000-0000-000000000001'
  ),
  2::BIGINT,
  'fallback advances the generation version'
);

SELECT is(
  (
    SELECT user_edits
    FROM public.pending_workouts
    WHERE id = '92000000-0000-0000-0000-000000000001'
  ),
  NULL::JSONB,
  'fallback clears incompatible user edits'
);

SELECT is(
  (
    SELECT status
    FROM public.pending_workouts
    WHERE id = '92000000-0000-0000-0000-000000000001'
  ),
  'ready',
  'fallback leaves the slot ready'
);

SELECT * FROM finish();

ROLLBACK;
