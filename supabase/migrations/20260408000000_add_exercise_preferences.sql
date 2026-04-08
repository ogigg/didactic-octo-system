-- exercise_preferences: Per-exercise preference for workout generation
CREATE TABLE exercise_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  preference TEXT NOT NULL CHECK (preference IN ('preferred', 'soft_dislike', 'hard_dislike')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, exercise_id)
);

-- Index
CREATE INDEX idx_exercise_preferences_user_id ON exercise_preferences(user_id);

-- Trigger for updated_at
CREATE TRIGGER exercise_preferences_updated_at
  BEFORE UPDATE ON exercise_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE exercise_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_preferences_select_own ON exercise_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY exercise_preferences_insert_own ON exercise_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY exercise_preferences_update_own ON exercise_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY exercise_preferences_delete_own ON exercise_preferences
  FOR DELETE USING (auth.uid() = user_id);
