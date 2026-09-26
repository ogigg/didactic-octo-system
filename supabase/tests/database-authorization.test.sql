BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(31);

-- Fixtures: user A, user B, an admin, and an account whose deletion grace
-- period has elapsed. Everything is rolled back at the end.
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
SELECT
  fixture.id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  fixture.email,
  '',
  NOW(),
  '{}',
  '{}',
  NOW(),
  NOW()
FROM (
  VALUES
    ('a5000000-0000-0000-0000-00000000000a'::UUID, 'authz-a@example.com'),
    ('a5000000-0000-0000-0000-00000000000b'::UUID, 'authz-b@example.com'),
    ('a5000000-0000-0000-0000-0000000000ad'::UUID, 'authz-admin@example.com'),
    ('a5000000-0000-0000-0000-0000000000de'::UUID, 'authz-expired@example.com')
) AS fixture(id, email);

UPDATE public.profiles
SET is_admin = TRUE
WHERE id = 'a5000000-0000-0000-0000-0000000000ad';

UPDATE public.profiles
SET deletion_scheduled_at = NOW() - INTERVAL '1 day'
WHERE id = 'a5000000-0000-0000-0000-0000000000de';

INSERT INTO public.workout_sessions (id, user_id, name, status, goal_snapshot)
VALUES (
  'a5000000-0000-0000-0000-0000000005e5',
  'a5000000-0000-0000-0000-00000000000a',
  'Owner session',
  'completed',
  'build_strength'
);

-- ---------------------------------------------------------------------------
-- Grants and routine inventory
-- ---------------------------------------------------------------------------

SELECT ok(
  NOT has_function_privilege('anon', 'public.purge_expired_deletions()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.purge_expired_deletions()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.purge_expired_deletions()', 'EXECUTE'),
  'purge_expired_deletions is service-only'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_login_provider_hint(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.get_login_provider_hint(text)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_login_provider_hint(text)', 'EXECUTE'),
  'get_login_provider_hint is service-only'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.get_workout_session_detail(uuid)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.get_workout_session_detail(uuid)', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.get_workout_session_detail(uuid)', 'EXECUTE'),
  'get_workout_session_detail is not executable by anon'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.update_body_measurement_date(uuid, date, date)', 'EXECUTE')
  AND has_function_privilege('authenticated', 'public.update_body_measurement_date(uuid, date, date)', 'EXECUTE'),
  'update_body_measurement_date is authenticated-only'
);

SELECT hasnt_function(
  'public',
  'update_body_measurement_date',
  ARRAY['uuid', 'text', 'text'],
  'the text-typed measurement date overload is gone'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.request_account_deletion(integer)', 'EXECUTE')
  AND NOT has_function_privilege('anon', 'public.cancel_account_deletion()', 'EXECUTE'),
  'account deletion RPCs are not executable by anon'
);

SELECT ok(
  NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.notify_workout_completed()', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.guard_profile_server_owned_fields()', 'EXECUTE'),
  'trigger functions are not directly executable by clients'
);

SELECT is(
  (
    SELECT COUNT(*)
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, '{}')) AS setting
        WHERE setting LIKE 'search_path=%'
      )
  ),
  0::BIGINT,
  'every public SECURITY DEFINER routine pins search_path'
);

-- New SECURITY DEFINER functions inherit anon EXECUTE from Supabase default
-- privileges. Anything anon can run must be a catalog reader or a user-scoped
-- RPC that derives the caller from auth.uid() and returns nothing for anon.
SELECT set_eq(
  $$
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  ARRAY[
    -- catalog readers
    'get_localized_catalog_labels(text)',
    'get_localized_exercise(uuid,text)',
    'get_localized_exercise_filter_options(text)',
    'get_localized_exercises(text,text,text[],text[],uuid[])',
    'localized_label_array(text,text[],text)',
    -- user-scoped by auth.uid()
    'delete_completed_session_exercise(uuid)',
    'delete_workout_session(uuid)',
    'get_editable_exercise_history(uuid)',
    'get_exercise_detail(uuid)',
    'get_exercise_progression_history(uuid,uuid[])',
    'get_latest_measurements()',
    'get_measurement_history(text)',
    'get_measurement_trend(text,timestamp with time zone)',
    'get_stats_heatmap()',
    'get_stats_muscle_distribution(timestamp with time zone)',
    'get_stats_personal_records()',
    'get_stats_volume_over_time(timestamp with time zone)',
    'get_workout_history_for_day_range(timestamp with time zone,timestamp with time zone)',
    'get_workout_history_page(integer,timestamp with time zone)',
    'update_completed_exercise_sets(uuid,jsonb)'
  ],
  'anon-executable SECURITY DEFINER routines are the reviewed set'
);

SELECT is(
  (SELECT username FROM cron.job WHERE jobname = 'purge-expired-account-deletions'),
  'postgres',
  'the purge cron job runs as postgres, unaffected by client revokes'
);

-- ---------------------------------------------------------------------------
-- Server-owned profile fields
-- ---------------------------------------------------------------------------

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-00000000000a","role":"authenticated"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ UPDATE public.profiles SET is_admin = TRUE WHERE id = 'a5000000-0000-0000-0000-00000000000a' $$,
  '42501',
  'profile fields are server managed: is_admin',
  'a user cannot set is_admin'
);

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET weight_unit = 'lbs', subscription_tier = 'pro', subscription_expires_at = NULL
    WHERE id = 'a5000000-0000-0000-0000-00000000000a'
  $$,
  '42501',
  'profile fields are server managed: subscription_tier',
  'a mixed payload cannot grant Pro'
);

SELECT throws_ok(
  $$
    INSERT INTO public.profiles (id, weight_unit, is_admin)
    VALUES ('a5000000-0000-0000-0000-00000000000a', 'lbs', TRUE)
    ON CONFLICT (id) DO UPDATE SET weight_unit = EXCLUDED.weight_unit, is_admin = EXCLUDED.is_admin
  $$,
  '42501',
  NULL,
  'an upsert cannot set is_admin'
);

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET queue_generation_request_id = gen_random_uuid()
    WHERE id = 'a5000000-0000-0000-0000-00000000000a'
  $$,
  '42501',
  NULL,
  'queue generation claims stay server managed'
);

SELECT throws_ok(
  $$
    UPDATE public.profiles
    SET deletion_scheduled_at = NOW() - INTERVAL '1 day'
    WHERE id = 'a5000000-0000-0000-0000-00000000000a'
  $$,
  '42501',
  NULL,
  'deletion scheduling goes through the RPC and Edge Function'
);

SELECT lives_ok(
  $$
    UPDATE public.profiles
    SET weight_unit = 'lbs', training_split = 'full_body', training_setup_completed = TRUE,
        subscription_tier = 'free', is_admin = FALSE
    WHERE id = 'a5000000-0000-0000-0000-00000000000a'
  $$,
  'ordinary edits that echo unchanged server fields still work'
);

SELECT lives_ok(
  $$ SELECT public.request_account_deletion(14) $$,
  'SECURITY DEFINER RPCs can still write server-owned fields'
);

SELECT is(
  public.is_admin(),
  FALSE,
  'user A is still not an admin'
);

-- ---------------------------------------------------------------------------
-- Comments, measurement dates, workout detail
-- ---------------------------------------------------------------------------

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-00000000000b","role":"authenticated"}',
  TRUE
);

SELECT throws_ok(
  $$
    INSERT INTO public.workout_session_comments (user_id, workout_session_id, comment)
    VALUES ('a5000000-0000-0000-0000-00000000000b', 'a5000000-0000-0000-0000-0000000005e5', 'cross-owner')
  $$,
  '42501',
  NULL,
  'a user cannot comment on another user''s session'
);

SELECT throws_ok(
  $$
    SELECT public.update_body_measurement_date(
      'a5000000-0000-0000-0000-00000000000a', DATE '2026-09-01', DATE '2026-09-02'
    )
  $$,
  '42501',
  'not allowed to update measurements for this user',
  'a user cannot move another user''s measurements'
);

SELECT throws_ok(
  $$ SELECT public.get_workout_session_detail('a5000000-0000-0000-0000-0000000005e5') $$,
  'P0001',
  'Not found or not authorized',
  'a foreign user cannot read the workout detail'
);

RESET ROLE;

-- Anonymous callers are denied by EXECUTE; the body also rejects a NULL uid
-- when reached through an authenticated-role session without a subject.
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', TRUE);
SET LOCAL ROLE authenticated;

SELECT throws_ok(
  $$ SELECT public.get_workout_session_detail('a5000000-0000-0000-0000-0000000005e5') $$,
  'P0001',
  'Not found or not authorized',
  'a NULL auth.uid() cannot read the workout detail'
);

RESET ROLE;

SELECT set_config('request.jwt.claims', '{"role":"anon"}', TRUE);
SET LOCAL ROLE anon;

SELECT throws_ok(
  $$ SELECT public.get_workout_session_detail('a5000000-0000-0000-0000-0000000005e5') $$,
  '42501',
  NULL,
  'anon cannot execute get_workout_session_detail'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-00000000000a","role":"authenticated"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT is(
  public.get_workout_session_detail('a5000000-0000-0000-0000-0000000005e5') ->> 'name',
  'Owner session',
  'the owner can read the workout detail'
);

-- ---------------------------------------------------------------------------
-- Storage: exercise-media writes are admin/service only
-- ---------------------------------------------------------------------------

SELECT throws_ok(
  $$
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('exercise-media', 'authz/forged.png', 'a5000000-0000-0000-0000-00000000000a')
  $$,
  '42501',
  NULL,
  'a regular user cannot write exercise media'
);

RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"a5000000-0000-0000-0000-0000000000ad","role":"authenticated"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT lives_ok(
  $$
    INSERT INTO storage.objects (bucket_id, name, owner_id)
    VALUES ('exercise-media', 'authz/admin.png', 'a5000000-0000-0000-0000-0000000000ad')
  $$,
  'an admin can write exercise media'
);

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Service role keeps its paths (rolled back with the transaction)
-- ---------------------------------------------------------------------------

SELECT set_config('request.jwt.claims', '{"role":"service_role"}', TRUE);
SET LOCAL ROLE service_role;

SELECT is(
  public.get_workout_session_detail('a5000000-0000-0000-0000-0000000005e5') ->> 'name',
  'Owner session',
  'the service role can read workout detail for generation'
);

SELECT lives_ok(
  $$ UPDATE public.profiles SET subscription_tier = 'pro' WHERE id = 'a5000000-0000-0000-0000-00000000000b' $$,
  'the service role can still write entitlement fields'
);

-- Only purge when the fixture is the sole expired account, so unrelated
-- local accounts are never swept, even inside this rolled-back transaction.
SELECT is(
  (
    SELECT COUNT(*)
    FROM public.profiles
    WHERE deletion_scheduled_at <= NOW()
      AND id <> 'a5000000-0000-0000-0000-0000000000de'
  ),
  0::BIGINT,
  'no unrelated account is past its deletion date'
);

SELECT is(
  CASE
    WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE deletion_scheduled_at <= NOW()
        AND id <> 'a5000000-0000-0000-0000-0000000000de'
    ) THEN public.purge_expired_deletions()
  END,
  1,
  'the service role can still run the purge'
);

RESET ROLE;

SELECT is(
  (SELECT COUNT(*) FROM auth.users WHERE id = 'a5000000-0000-0000-0000-0000000000de'),
  0::BIGINT,
  'the expired fixture account was purged inside this transaction'
);

SELECT * FROM finish();
ROLLBACK;
