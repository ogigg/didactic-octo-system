-- Add function to update measurement date (move entry to new date)
CREATE OR REPLACE FUNCTION update_body_measurement_date(
  p_user_id UUID,
  p_old_logged_at TEXT,
  p_new_logged_at TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE body_measurements
  SET logged_at = p_new_logged_at,
      updated_at = NOW()
  WHERE user_id = p_user_id
    AND logged_at = p_old_logged_at
    AND p_old_logged_at != p_new_logged_at;
END;
$$;