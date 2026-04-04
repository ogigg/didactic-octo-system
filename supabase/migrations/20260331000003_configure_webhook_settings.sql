-- Configure database settings required by the workout completion webhook.
-- These allow the notify_workout_completed() trigger function to call
-- the generate-next-workout edge function via pg_net.
--
-- The values below use Docker-internal hostnames for local development.
-- For production, override via:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<production_service_role_key>';

ALTER DATABASE postgres SET app.supabase_url = 'http://kong:8000';
ALTER DATABASE postgres SET app.service_role_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';
