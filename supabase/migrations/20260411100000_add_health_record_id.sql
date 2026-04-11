-- ============================================================
-- Apple Health / Health Connect mirror linkage
-- Stores the external record UUID when a workout_session has
-- been successfully written to HealthKit (iOS) or Health Connect
-- (Android). Null = not yet mirrored (or sync disabled).
-- ============================================================

ALTER TABLE workout_sessions
  ADD COLUMN IF NOT EXISTS health_record_id TEXT;
