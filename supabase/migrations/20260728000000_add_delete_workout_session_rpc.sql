-- Delete one completed workout owned by the authenticated user and return the
-- external health record linkage before cascading related workout data.

CREATE OR REPLACE FUNCTION public.delete_workout_session(p_session_id UUID)
RETURNS TABLE (
  id UUID,
  health_record_id TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  DELETE FROM public.workout_sessions AS ws
  WHERE ws.id = p_session_id
    AND ws.user_id = auth.uid()
    AND ws.status = 'completed'
  RETURNING ws.id, ws.health_record_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Completed workout not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_workout_session(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_workout_session(UUID) TO authenticated;
