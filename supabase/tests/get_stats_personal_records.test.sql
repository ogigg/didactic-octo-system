BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(11);

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
    '11000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stats-owner@example.com',
    '',
    NOW(),
    '{}',
    '{}',
    NOW(),
    NOW()
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stats-other@example.com',
    '',
    NOW(),
    '{}',
    '{}',
    NOW(),
    NOW()
  ),
  (
    '11000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'stats-empty@example.com',
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
  'Personal Record Press',
  ARRAY['chest'],
  ARRAY['barbell'],
  'weight'
);

-- The owner has completed working sets with ties in both directions. The
-- warm-up has a larger load and active/incomplete sessions have larger values,
-- so all of those rows must be excluded from every record.
INSERT INTO workout_sessions (
  id,
  user_id,
  name,
  status,
  goal_snapshot,
  started_at,
  completed_at
)
VALUES
  (
    '31000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    'Older completed stats session',
    'completed',
    'build_strength',
    '2026-08-01 09:00:00+00',
    '2026-08-01 10:00:00+00'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '11000000-0000-0000-0000-000000000001',
    'Newer completed stats session',
    'completed',
    'build_strength',
    '2026-08-02 09:00:00+00',
    '2026-08-02 10:00:00+00'
  ),
  (
    '31000000-0000-0000-0000-000000000098',
    '11000000-0000-0000-0000-000000000001',
    'Incomplete logged stats session',
    'completed',
    'build_strength',
    '2026-08-03 09:00:00+00',
    '2026-08-03 10:00:00+00'
  ),
  (
    '31000000-0000-0000-0000-000000000099',
    '11000000-0000-0000-0000-000000000001',
    'Active stats session',
    'active',
    'build_strength',
    '2026-08-04 09:00:00+00',
    NULL
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '11000000-0000-0000-0000-000000000002',
    'Other user stats session',
    'completed',
    'build_strength',
    '2026-08-05 09:00:00+00',
    '2026-08-05 10:00:00+00'
  );

INSERT INTO session_exercises (
  id,
  workout_session_id,
  exercise_id,
  order_index,
  rest_duration_seconds
)
VALUES
  (
    '41000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    0,
    90
  ),
  (
    '41000000-0000-0000-0000-000000000002',
    '31000000-0000-0000-0000-000000000002',
    '21000000-0000-0000-0000-000000000001',
    0,
    90
  ),
  (
    '41000000-0000-0000-0000-000000000098',
    '31000000-0000-0000-0000-000000000098',
    '21000000-0000-0000-0000-000000000001',
    0,
    90
  ),
  (
    '41000000-0000-0000-0000-000000000099',
    '31000000-0000-0000-0000-000000000099',
    '21000000-0000-0000-0000-000000000001',
    0,
    90
  ),
  (
    '41000000-0000-0000-0000-000000000003',
    '31000000-0000-0000-0000-000000000003',
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
  -- Warm-up must not affect max_weight_kg or any paired value.
  (
    '51000000-0000-0000-0000-000000000001',
    '41000000-0000-0000-0000-000000000001',
    1,
    'warmup',
    999,
    99
  ),
  -- Same weight, different reps: max-weight tie resolves to 8 reps.
  (
    '51000000-0000-0000-0000-000000000002',
    '41000000-0000-0000-0000-000000000001',
    2,
    'working',
    100,
    5
  ),
  (
    '51000000-0000-0000-0000-000000000003',
    '41000000-0000-0000-0000-000000000001',
    3,
    'working',
    100,
    8
  ),
  -- Same reps, different loads: max-reps tie resolves to 95 kg.
  (
    '51000000-0000-0000-0000-000000000004',
    '41000000-0000-0000-0000-000000000001',
    4,
    'working',
    90,
    12
  ),
  (
    '51000000-0000-0000-0000-000000000005',
    '41000000-0000-0000-0000-000000000002',
    1,
    'working',
    100,
    8
  ),
  (
    '51000000-0000-0000-0000-000000000006',
    '41000000-0000-0000-0000-000000000002',
    2,
    'working',
    95,
    12
  ),
  -- A completed session with an uncompleted log must be ignored.
  (
    '51000000-0000-0000-0000-000000000098',
    '41000000-0000-0000-0000-000000000098',
    1,
    'working',
    888,
    88
  ),
  -- An active session must be ignored.
  (
    '51000000-0000-0000-0000-000000000099',
    '41000000-0000-0000-0000-000000000099',
    1,
    'working',
    777,
    77
  ),
  -- Another user's completed data must be ignored.
  (
    '51000000-0000-0000-0000-000000000007',
    '41000000-0000-0000-0000-000000000003',
    1,
    'working',
    666,
    66
  );

INSERT INTO set_logs (
  id,
  session_set_id,
  actual_load_kg,
  actual_reps,
  completed
)
VALUES
  (
    '61000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    999,
    99,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    '51000000-0000-0000-0000-000000000002',
    100,
    5,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    '51000000-0000-0000-0000-000000000003',
    100,
    8,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000004',
    '51000000-0000-0000-0000-000000000004',
    90,
    12,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000005',
    '51000000-0000-0000-0000-000000000005',
    100,
    8,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000006',
    '51000000-0000-0000-0000-000000000006',
    95,
    12,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000098',
    '51000000-0000-0000-0000-000000000098',
    888,
    88,
    FALSE
  ),
  (
    '61000000-0000-0000-0000-000000000099',
    '51000000-0000-0000-0000-000000000099',
    777,
    77,
    TRUE
  ),
  (
    '61000000-0000-0000-0000-000000000007',
    '51000000-0000-0000-0000-000000000007',
    666,
    66,
    TRUE
  );

SELECT set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000001',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT is(
  jsonb_array_length(get_stats_personal_records()),
  1,
  'returns one personal-record row for the owner exercise'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_weight_kg')::numeric,
  100::numeric,
  'max weight is calculated from completed working sets only'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_weight_reps')::int,
  8,
  'max-weight reps preserve the selected set pairing and resolve weight ties by reps'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_reps')::int,
  12,
  'max reps is calculated from completed working sets only'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_reps_weight_kg')::numeric,
  95::numeric,
  'max-reps load preserves the selected set pairing and resolves rep ties by load'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_volume_set_kg')::numeric,
  1140::numeric,
  'best-set volume uses working-set values'
);

SELECT is(
  (get_stats_personal_records()->0->>'est_1rm_kg')::numeric,
  126.7::numeric,
  'estimated 1RM uses the best eligible working set at ten reps or fewer'
);

SELECT is(
  (get_stats_personal_records()->0->>'max_weight_kg')::numeric,
  100::numeric,
  'warm-up, active, incomplete, and other-user high values are excluded'
);

SELECT is(
  (get_stats_personal_records()->0 ? 'max_weight_reps') AND
    (get_stats_personal_records()->0 ? 'max_reps_weight_kg'),
  TRUE,
  'response includes both exact pairing fields'
);

RESET ROLE;
SELECT set_config(
  'request.jwt.claim.sub',
  '11000000-0000-0000-0000-000000000003',
  TRUE
);
SELECT set_config('request.jwt.claim.role', 'authenticated', TRUE);
SET LOCAL ROLE authenticated;

SELECT is(
  get_stats_personal_records(),
  '[]'::jsonb,
  'returns an empty array when the authenticated user has no eligible sets'
);

RESET ROLE;
RESET request.jwt.claim.sub;
RESET request.jwt.claim.role;

SELECT throws_ok(
  $$SELECT get_stats_personal_records()$$,
  'P0001',
  'Not authenticated',
  'preserves the not-authenticated guard'
);

SELECT * FROM finish();

ROLLBACK;
