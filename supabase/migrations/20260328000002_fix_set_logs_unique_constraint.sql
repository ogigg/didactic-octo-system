-- -----------------------------------------------------------------------------
-- Migration: fix_set_logs_unique_constraint
-- Replaces the non-unique index on set_logs.session_set_id with a unique
-- constraint so that upsert (ON CONFLICT session_set_id) works correctly.
-- Each session_set should have exactly one log entry.
-- -----------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_set_logs_session_set_id;

ALTER TABLE set_logs
  ADD CONSTRAINT set_logs_session_set_id_unique UNIQUE (session_set_id);
