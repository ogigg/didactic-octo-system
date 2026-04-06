ALTER TABLE pending_workouts
  DROP CONSTRAINT pending_workouts_status_check;

ALTER TABLE pending_workouts
  ADD CONSTRAINT pending_workouts_status_check
  CHECK (status IN ('queued', 'generating', 'regenerating', 'ready', 'failed'));
