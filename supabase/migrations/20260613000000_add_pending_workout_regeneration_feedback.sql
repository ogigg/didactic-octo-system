ALTER TABLE pending_workouts
  ADD COLUMN regeneration_feedback JSONB NOT NULL DEFAULT '[]'::jsonb;
