-- Enable pg_net extension for HTTP calls from PostgreSQL triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Function to notify the generate-next-workout edge function
-- when a workout session is marked as completed.
--
-- Requires database settings to be configured:
--   ALTER DATABASE postgres SET app.supabase_url = 'https://<project>.supabase.co';
--   ALTER DATABASE postgres SET app.service_role_key = '<service_role_key>';
--
-- For local development:
--   ALTER DATABASE postgres SET app.supabase_url = 'http://127.0.0.1:54321';
--   ALTER DATABASE postgres SET app.service_role_key = '<local_service_role_key>';
CREATE OR REPLACE FUNCTION notify_workout_completed()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
BEGIN
  -- Only trigger on new completions (not updates to already-completed sessions)
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_supabase_url := current_setting('app.supabase_url', true);
    v_service_role_key := current_setting('app.service_role_key', true);

    IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/generate-next-workout',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || v_service_role_key,
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'user_id', NEW.user_id,
          'completed_session_id', NEW.id
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on workout_sessions status change
CREATE TRIGGER on_workout_completed
  AFTER UPDATE ON workout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION notify_workout_completed();
