-- body_measurements: User body composition and circumference tracking
-- One row per date. Nullable columns allow partial logging.
CREATE TABLE body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  logged_at DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Body composition
  weight_kg          NUMERIC(6,2),
  body_fat_pct       NUMERIC(4,1),
  muscle_mass_kg     NUMERIC(6,2),

  -- Upper body circumferences (cm)
  chest_cm           NUMERIC(6,1),
  waist_cm           NUMERIC(6,1),
  hips_cm            NUMERIC(6,1),
  neck_cm            NUMERIC(6,1),
  shoulders_cm       NUMERIC(6,1),
  biceps_left_cm     NUMERIC(6,1),
  biceps_right_cm    NUMERIC(6,1),
  forearm_left_cm    NUMERIC(6,1),
  forearm_right_cm   NUMERIC(6,1),

  -- Lower body circumferences (cm)
  thigh_left_cm      NUMERIC(6,1),
  thigh_right_cm     NUMERIC(6,1),
  calf_left_cm       NUMERIC(6,1),
  calf_right_cm      NUMERIC(6,1),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One entry per user per date (upsert on conflict)
CREATE UNIQUE INDEX idx_body_measurements_user_date
  ON body_measurements (user_id, logged_at);

-- Index for chart queries ordered by date
CREATE INDEX idx_body_measurements_user_logged_at
  ON body_measurements (user_id, logged_at ASC);

-- Trigger for updated_at
CREATE TRIGGER body_measurements_updated_at
  BEFORE UPDATE ON body_measurements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY body_measurements_select_own ON body_measurements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY body_measurements_insert_own ON body_measurements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY body_measurements_update_own ON body_measurements
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY body_measurements_delete_own ON body_measurements
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RPC: get_measurement_trend
-- Returns time-series data [{date, value}] for a single measurement field.
-- p_field must be one of the whitelisted column names.
-- p_from_date is an optional lower bound (null = all time).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_measurement_trend(
  p_field TEXT,
  p_from_date TIMESTAMPTZ DEFAULT NULL
)
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
    'SELECT jsonb_agg(row_data ORDER BY row_data->>''date'' ASC)
     FROM (
       SELECT jsonb_build_object(
         ''date'',  logged_at,
         ''value'', %I
       ) AS row_data
       FROM body_measurements
       WHERE user_id = $1
         AND %I IS NOT NULL
         AND ($2::timestamptz IS NULL OR logged_at >= $2::date)
     ) sub',
    v_col, v_col
  ) USING v_user_id, p_from_date
  INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- -----------------------------------------------------------------------------
-- RPC: get_latest_measurements
-- Returns the most recent row with all non-null values for the list view.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_latest_measurements()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result  JSONB;
BEGIN
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT to_jsonb(r) INTO v_result
  FROM (
    SELECT
      weight_kg, body_fat_pct, muscle_mass_kg,
      chest_cm, waist_cm, hips_cm, neck_cm, shoulders_cm,
      biceps_left_cm, biceps_right_cm,
      forearm_left_cm, forearm_right_cm,
      thigh_left_cm, thigh_right_cm,
      calf_left_cm, calf_right_cm,
      logged_at
    FROM body_measurements
    WHERE user_id = v_user_id
    ORDER BY logged_at DESC
    LIMIT 1
  ) r;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;
