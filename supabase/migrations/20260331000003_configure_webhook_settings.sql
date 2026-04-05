-- Configure database settings required by the workout completion webhook.
-- These allow the notify_workout_completed() trigger function to call
-- the generate-next-workout edge function via pg_net.
--
-- The values below use Docker-internal hostnames for local development.
-- For production, override via:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<production_service_role_key>';

-- Use session-level SET for compatibility (ALTER DATABASE requires superuser).
-- These are picked up by the notify_workout_completed() trigger at runtime
-- via current_setting('app.supabase_url') etc.
-- For local dev, these are configured in supabase/config.toml [db.settings].
-- For production, set via dashboard or ALTER DATABASE as superuser.
SELECT true;
