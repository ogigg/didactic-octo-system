BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(23);

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '97000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'generation-attempts@example.test', '', now(), '{}', '{}', now(), now()
);
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
VALUES (
  '97000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'generation-attempts-other@example.test', '', now(), '{}', '{}', now(), now()
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"97000000-0000-0000-0000-000000000001","role":"service_role"}',
  true
);

INSERT INTO pending_workouts (
  id, user_id, queue_position, status, workout_data, user_edits
)
VALUES (
  '97100000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000001', 1, 'ready',
  '{"old":true}', '{"edited":true}'
);

SELECT is(
  (SELECT status FROM claim_generation_attempt(
    '97000000-0000-0000-0000-000000000001',
    '97200000-0000-0000-0000-000000000001',
    '97100000-0000-0000-0000-000000000001',
    'generate-workout', 'regeneration'
  )),
  'claimed', 'first regeneration claim wins'
);
SELECT is(
  (SELECT status FROM claim_generation_attempt(
    '97000000-0000-0000-0000-000000000001',
    '97200000-0000-0000-0000-000000000001',
    '97100000-0000-0000-0000-000000000001',
    'generate-workout', 'regeneration'
  )),
  'in_progress', 'same request is idempotent while running'
);
SELECT is(
  (SELECT status FROM claim_generation_attempt(
    '97000000-0000-0000-0000-000000000001',
    '97200000-0000-0000-0000-000000000002',
    '97100000-0000-0000-0000-000000000001',
    'generate-workout', 'regeneration'
  )),
  'rejected', 'concurrent regeneration is rejected'
);

SELECT ok(
  complete_regeneration_attempt(
    (SELECT id FROM generation_attempts WHERE request_id = '97200000-0000-0000-0000-000000000001'),
    '97000000-0000-0000-0000-000000000001',
    '97100000-0000-0000-0000-000000000001',
    '{"new":true}', 'llm', 1, '[{"feedback":null}]', now(), '{"new":true}'
  ),
  'valid owner can atomically finish regeneration'
);
SELECT is((SELECT status FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000001'), 'ready', 'finished row is ready');
SELECT is((SELECT user_edits FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000001'), NULL::jsonb, 'regeneration clears user edits');
SELECT is((SELECT status FROM generation_attempts WHERE request_id = '97200000-0000-0000-0000-000000000001'), 'succeeded', 'attempt is fenced and finished');
SELECT is(
  (SELECT status FROM claim_generation_attempt(
    '97000000-0000-0000-0000-000000000001',
    '97200000-0000-0000-0000-000000000001',
    '97100000-0000-0000-0000-000000000001',
    'generate-workout', 'regeneration'
  )),
  'already_finished', 'finished request is idempotent'
);

INSERT INTO pending_workouts (
  id, user_id, queue_position, status, workout_data
)
VALUES (
  '97100000-0000-0000-0000-000000000002',
  '97000000-0000-0000-0000-000000000001', 2, 'ready', '{"old":true}'
);
SELECT ok((SELECT status = 'claimed' FROM claim_generation_attempt(
  '97000000-0000-0000-0000-000000000001',
  '97200000-0000-0000-0000-000000000003',
  '97100000-0000-0000-0000-000000000002',
  'generate-workout', 'regeneration'
)), 'stale attempt can be claimed');
ALTER TABLE generation_attempts DISABLE TRIGGER generation_attempts_updated_at;
UPDATE generation_attempts
SET updated_at = now() - interval '6 minutes'
WHERE request_id = '97200000-0000-0000-0000-000000000003';
ALTER TABLE generation_attempts ENABLE TRIGGER generation_attempts_updated_at;
SELECT is(
  recover_stale_generation_attempts('97000000-0000-0000-0000-000000000001'),
  1,
  'stale attempt recovery returns one recovered attempt'
);
SELECT is((SELECT status FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000002'), 'ready', 'stale row with prior data is restored');
SELECT ok(
  NOT complete_regeneration_attempt(
    (SELECT id FROM generation_attempts WHERE request_id = '97200000-0000-0000-0000-000000000003'),
    '97000000-0000-0000-0000-000000000001',
    '97100000-0000-0000-0000-000000000002',
    '{"late":true}', 'llm', 1, '[]', now(), '{"late":true}'
  ),
  'late finish is fenced after recovery'
);

-- Failed finishes restore the claimed row in the same transaction.
INSERT INTO pending_workouts (
  id, user_id, queue_position, status, workout_data, user_edits
)
VALUES (
  '97100000-0000-0000-0000-000000000003',
  '97000000-0000-0000-0000-000000000001', 3, 'ready', '{"old":true}', '{"edited":true}'
);
SELECT ok((SELECT status = 'claimed' FROM claim_generation_attempt(
  '97000000-0000-0000-0000-000000000001', '97200000-0000-0000-0000-000000000004',
  '97100000-0000-0000-0000-000000000003', 'generate-workout', 'regeneration'
)), 'failure test claim succeeds');
SELECT ok(finish_generation_attempt(
  (SELECT id FROM generation_attempts WHERE request_id = '97200000-0000-0000-0000-000000000004'),
  '97000000-0000-0000-0000-000000000001', 'failed', NULL, NULL, 'provider_error', 'provider unavailable', NULL
), 'failed finish succeeds');
SELECT is((SELECT status FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000003'), 'ready', 'failed finish restores prior data');
SELECT is((SELECT generation_attempt_id FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000003'), NULL::uuid, 'failed finish clears lease atomically');

-- Authenticated users may recover only their own rows; admins can inspect attempts.
INSERT INTO pending_workouts (id, user_id, queue_position, status, workout_data)
VALUES ('97100000-0000-0000-0000-000000000004', '97000000-0000-0000-0000-000000000001', 4, 'generating', NULL);
UPDATE profiles
SET queue_generation_request_id = '97300000-0000-0000-0000-000000000001',
    queue_generation_started_at = now() - interval '6 minutes'
WHERE id = '97000000-0000-0000-0000-000000000001';
ALTER TABLE pending_workouts DISABLE TRIGGER pending_workouts_updated_at;
UPDATE pending_workouts
SET updated_at = now() - interval '6 minutes'
WHERE id = '97100000-0000-0000-0000-000000000004';
ALTER TABLE pending_workouts ENABLE TRIGGER pending_workouts_updated_at;
UPDATE profiles
SET is_admin = true
WHERE id = '97000000-0000-0000-0000-000000000002';
SELECT set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is(recover_stale_generation_attempts(NULL), 1, 'owner can recover own legacy row');
SELECT is((SELECT status FROM pending_workouts WHERE id = '97100000-0000-0000-0000-000000000004'), 'failed', 'legacy null-data row becomes failed');
SELECT is((SELECT queue_generation_request_id FROM profiles WHERE id = '97000000-0000-0000-0000-000000000001'), NULL::uuid, 'owner recovery releases stale queue lease');
SELECT throws_ok($$SELECT recover_stale_generation_attempts('97000000-0000-0000-0000-000000000002')$$, '42501', NULL, 'owner cannot recover another user');
SELECT is((SELECT count(*)::integer FROM generation_attempts), 0, 'non-admin cannot read attempts through RLS');
SELECT throws_ok($$UPDATE profiles SET queue_generation_request_id = '97300000-0000-0000-0000-000000000002' WHERE id = '97000000-0000-0000-0000-000000000001'$$, '42501', NULL, 'owner cannot spoof queue lease state');
SELECT set_config('request.jwt.claims', '{"sub":"97000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
SELECT ok((SELECT count(*)::integer > 0 FROM generation_attempts), 'admin can read generation attempts through RLS');

SELECT * FROM finish();
ROLLBACK;
