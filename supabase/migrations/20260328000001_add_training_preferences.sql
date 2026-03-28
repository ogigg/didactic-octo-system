ALTER TABLE profiles
  ADD COLUMN training_split TEXT CHECK (training_split IN ('full_body', 'upper_lower', 'push_pull_legs')),
  ADD COLUMN session_duration_minutes SMALLINT CHECK (session_duration_minutes IN (15, 30, 45, 60, 90)),
  ADD COLUMN equipment_level TEXT CHECK (equipment_level IN ('bodyweight', 'dumbbells', 'barbell', 'full_gym')),
  ADD COLUMN training_style TEXT CHECK (training_style IN ('strength', 'hypertrophy', 'endurance', 'circuit')),
  ADD COLUMN difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
  ADD COLUMN training_custom_prompt TEXT CHECK (training_custom_prompt IS NULL OR char_length(training_custom_prompt) <= 200),
  ADD COLUMN training_setup_completed BOOLEAN NOT NULL DEFAULT FALSE;
