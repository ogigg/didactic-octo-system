BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT plan(6);
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
VALUES ('97300000-0000-4000-8000-000000000001','trace-metrics-admin@example.test','{}','{}',now(),now()),
       ('97300000-0000-4000-8000-000000000002','trace-metrics-user@example.test','{}','{}',now(),now());
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
UPDATE profiles SET is_admin=true WHERE id='97300000-0000-4000-8000-000000000001';
INSERT INTO generation_attempts(user_id,request_id,function_name,trigger,status,stage,duration_ms)
VALUES ('97300000-0000-4000-8000-000000000002',gen_random_uuid(),'metrics-test','regeneration','succeeded_with_fallback','saved',100),
       ('97300000-0000-4000-8000-000000000002',gen_random_uuid(),'metrics-test','regeneration','failed','persistence',200),
       ('97300000-0000-4000-8000-000000000002',gen_random_uuid(),'metrics-test','regeneration','rejected','allowance',10);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"97300000-0000-4000-8000-000000000002"}',true);
SELECT is((generation_attempt_metrics(now()-interval '1 hour',null,'metrics-test')->>'total')::int,0,'ordinary users cannot aggregate private attempts');
SELECT set_config('request.jwt.claims','{"role":"authenticated","sub":"97300000-0000-4000-8000-000000000001"}',true);
SELECT is((generation_attempt_metrics(now()-interval '1 hour',null,'metrics-test')->>'total')::int,3,'admin sees every filtered attempt');
SELECT is((generation_attempt_metrics(now()-interval '1 hour',null,'metrics-test')->>'failures')::int,1,'expected rejection is not an operational failure');
SELECT is((generation_attempt_metrics(now()-interval '1 hour',null,'metrics-test')->>'fallbacks')::int,1,'fallback counted separately');
SELECT is((generation_attempt_metrics(now()-interval '1 hour',null,'metrics-test')->'stage_failures'->>'persistence')::int,1,'failure attributed to persistence');
SELECT is((generation_attempt_metrics(now()-interval '1 hour','rejected','metrics-test')->>'total')::int,1,'outcome filter applies to metrics');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
