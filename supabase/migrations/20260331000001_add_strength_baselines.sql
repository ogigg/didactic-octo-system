-- strength_baselines: User's current strength levels for load programming
CREATE TABLE strength_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_key TEXT NOT NULL CHECK (exercise_key IN ('pushups', 'pullups', 'db_bench', 'db_row', 'bb_bench', 'bb_squat', 'deadlift')),
  load_kg NUMERIC,
  reps INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, exercise_key)
);

-- Index
CREATE INDEX idx_strength_baselines_user_id ON strength_baselines(user_id);

-- Trigger for updated_at
CREATE TRIGGER strength_baselines_updated_at
  BEFORE UPDATE ON strength_baselines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE strength_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY strength_baselines_select_own ON strength_baselines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY strength_baselines_insert_own ON strength_baselines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY strength_baselines_update_own ON strength_baselines
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY strength_baselines_delete_own ON strength_baselines
  FOR DELETE USING (auth.uid() = user_id);
