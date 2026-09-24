BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(16);

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
    '98000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'llm-diagnostics-admin@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '98000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'llm-diagnostics-user@example.test',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

UPDATE public.profiles
SET is_admin = true
WHERE id = '98000000-0000-0000-0000-000000000001';

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"98000000-0000-0000-0000-000000000002","role":"service_role"}',
  true
);

INSERT INTO public.generation_attempts (
  id, request_id, user_id, function_name, trigger, status, duration_ms
)
VALUES
  (
    '98100000-0000-0000-0000-000000000001',
    '98200000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'immediate', 'succeeded', 500
  ),
  (
    '98100000-0000-0000-0000-000000000002',
    '98200000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'immediate', 'succeeded_with_fallback', 900
  ),
  (
    '98100000-0000-0000-0000-000000000003',
    '98200000-0000-0000-0000-000000000003',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'immediate', 'succeeded', 700
  );

INSERT INTO public.llm_generation_logs (
  id,
  user_id,
  function_name,
  model,
  status,
  request_messages,
  attempt_id,
  request_id,
  duration_ms,
  prompt_tokens,
  completion_tokens,
  provider,
  request_settings,
  finish_reason,
  reasoning_tokens,
  cost_usd,
  failure_code,
  created_at
)
VALUES
  (
    '98300000-0000-0000-0000-000000000001',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'test-model', 'success', '{}',
    '98100000-0000-0000-0000-000000000001',
    '98200000-0000-0000-0000-000000000001',
    100, 1000, 200, 'provider-a', '{"reasoning":{"enabled":false}}',
    'stop', 0, 0.001, NULL, now() - interval '20 minutes'
  ),
  (
    '98300000-0000-0000-0000-000000000002',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'test-model', 'parse_error', '{}',
    '98100000-0000-0000-0000-000000000002',
    '98200000-0000-0000-0000-000000000002',
    200, 1100, 300, 'provider-a', '{"max_tokens":3200}',
    'length', 120, 0.002, 'token_limit', now() - interval '15 minutes'
  ),
  (
    '98300000-0000-0000-0000-000000000003',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'test-model', 'success', '{}',
    '98100000-0000-0000-0000-000000000003',
    '98200000-0000-0000-0000-000000000003',
    300, 1200, 400, 'provider-b', '{"max_tokens":3200}',
    'stop', 0, 0.003, NULL, now() - interval '10 minutes'
  ),
  (
    '98300000-0000-0000-0000-000000000004',
    '98000000-0000-0000-0000-000000000002',
    'diagnostics-test', 'legacy-model', 'success', '{}',
    NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
    now() - interval '5 minutes'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"98000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);

SELECT is(
  (public.llm_generation_metrics(now() - interval '1 hour')->>'calls')::INTEGER,
  0,
  'non-admins cannot read model metrics through RLS'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.llm_generation_logs),
  0,
  'non-admins cannot read raw model logs'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"98000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

CREATE TEMP TABLE diagnostics_metrics AS
SELECT public.llm_generation_metrics(now() - interval '1 hour') AS payload;

SELECT is(((SELECT payload FROM diagnostics_metrics)->>'calls')::INTEGER, 4, 'admin sees every model call');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'valid_success')::INTEGER, 3, 'valid response count excludes parse errors');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'failures')::INTEGER, 1, 'failure count includes parse errors');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'avg_duration_ms')::NUMERIC, 200.0::NUMERIC, 'average model duration excludes null legacy duration');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'p50_duration_ms')::NUMERIC, 200.0::NUMERIC, 'p50 model duration is calculated in the database');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'p95_duration_ms')::NUMERIC, 290.0::NUMERIC, 'p95 model duration is calculated in the database');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'fallback_attempts')::INTEGER, 1, 'linked fallback attempts are counted');
SELECT is(((SELECT payload FROM diagnostics_metrics)->>'fallback_rate')::NUMERIC, 0.3333::NUMERIC, 'fallback rate uses linked attempts');
SELECT is(
  (SELECT (entry->>'calls')::INTEGER
   FROM diagnostics_metrics, jsonb_array_elements(payload->'providers') AS entry
   WHERE entry->>'provider' = 'provider-a'),
  2,
  'provider aggregates include all calls for provider-a'
);
SELECT is(
  (SELECT (entry->>'valid_success_rate')::NUMERIC
   FROM diagnostics_metrics, jsonb_array_elements(payload->'providers') AS entry
   WHERE entry->>'provider' = 'provider-a'),
  0.5::NUMERIC,
  'provider valid success rate is exposed'
);
SELECT is(
  (public.llm_generation_metrics(now() - interval '1 hour', 'success', NULL, 'diagnostics-test')->>'calls')::INTEGER,
  3,
  'status and function filters apply to metrics'
);
SELECT is(
  (public.llm_generation_metrics(now() - interval '1 hour', NULL, 'provider-a', NULL)->>'calls')::INTEGER,
  2,
  'provider filter applies to metrics'
);
SELECT is(
  (public.llm_generation_metrics(now() - interval '1 hour', NULL, NULL, NULL, 'token_limit', NULL)->>'calls')::INTEGER,
  1,
  'failure code filter applies to metrics'
);
SELECT is(
  (SELECT count(*)::INTEGER FROM public.llm_generation_logs
   WHERE provider = 'provider-a'
     AND request_settings->'reasoning'->>'enabled' = 'false'
     AND failure_code IS NULL),
  1,
  'diagnostic metadata is persisted and queryable'
);

SELECT * FROM finish();
ROLLBACK;
