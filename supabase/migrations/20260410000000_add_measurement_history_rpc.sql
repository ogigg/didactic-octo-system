-- -----------------------------------------------------------------------------
-- RPC: get_measurement_history
-- Returns all measurement entries for a specific field, ordered by date desc.
-- p_field must be one of the whitelisted column names.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_measurement_history(p_field TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
  v_col     TEXT;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_col := p_field;
  IF v_col NOT IN (
    'weight_kg','body_fat_pct','muscle_mass_kg',
    'chest_cm','waist_cm','hips_cm','neck_cm','shoulders_cm',
    'biceps_left_cm','biceps_right_cm','forearm_left_cm','forearm_right_cm',
    'thigh_left_cm','thigh_right_cm','calf_left_cm','calf_right_cm'
  ) THEN
    RAISE EXCEPTION 'Invalid measurement field: %', p_field;
  END IF;

  EXECUTE format(
    'SELECT jsonb_agg(row_data ORDER BY row_data->>''logged_at'' DESC)
     FROM (
       SELECT jsonb_build_object(
         ''date'',     logged_at,
         ''value'',    %I,
         ''logged_at'', logged_at
       ) AS row_data
       FROM body_measurements
       WHERE user_id = $1
         AND %I IS NOT NULL
     ) sub',
    v_col, v_col
  ) USING v_user_id
  INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;
