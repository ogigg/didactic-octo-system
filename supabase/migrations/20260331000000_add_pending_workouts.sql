-- pending_workouts: Pre-generated workout queue for weekly plan
CREATE TABLE pending_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  queue_position INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'generating', 'ready', 'failed')),
  workout_data JSONB,
  generation_source TEXT CHECK (generation_source IN ('llm', 'fallback_template', 'fallback_substitution')),
  focus_area TEXT CHECK (focus_area IN ('push', 'pull', 'legs', 'upper', 'lower', 'full_body')),
  generated_at TIMESTAMPTZ,
  last_regenerated_at TIMESTAMPTZ,
  regeneration_count INTEGER DEFAULT 0,
  user_edits JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, queue_position)
);

-- Indexes
CREATE INDEX idx_pending_workouts_user_id ON pending_workouts(user_id);
CREATE INDEX idx_pending_workouts_user_status ON pending_workouts(user_id, status);

-- Trigger for updated_at
CREATE TRIGGER pending_workouts_updated_at
  BEFORE UPDATE ON pending_workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Row-Level Security
ALTER TABLE pending_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY pending_workouts_select_own ON pending_workouts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY pending_workouts_insert_own ON pending_workouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY pending_workouts_update_own ON pending_workouts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY pending_workouts_delete_own ON pending_workouts
  FOR DELETE USING (auth.uid() = user_id);

-- Enable Supabase Realtime for live queue updates
ALTER PUBLICATION supabase_realtime ADD TABLE pending_workouts;
