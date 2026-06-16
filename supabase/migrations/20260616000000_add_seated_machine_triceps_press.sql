-- -----------------------------------------------------------------------------
-- Migration: add_seated_machine_triceps_press
-- Adds a seated selectorized triceps press machine to the curated catalog.
-- -----------------------------------------------------------------------------

INSERT INTO exercises (
  name,
  external_id,
  exercise_type,
  primary_muscles,
  secondary_muscles,
  equipment,
  difficulty_level,
  instructions,
  image_url,
  video_url,
  catalog_status,
  retired_at,
  replacement_exercise_id
)
VALUES (
  'Seated Machine Triceps Press',
  'curated-seated-machine-triceps-press',
  'weight',
  ARRAY['Triceps brachii'],
  ARRAY['Anterior deltoid', 'Pectoralis major'],
  ARRAY['Triceps press machine'],
  'beginner',
  'Sit with your back against the pad, grip the side handles, and keep your elbows close to your body. Press the handles down by extending your elbows, squeeze your triceps, then return with control.',
  NULL,
  NULL,
  'active',
  NULL,
  NULL
)
ON CONFLICT (external_id) DO UPDATE SET
  name = EXCLUDED.name,
  exercise_type = EXCLUDED.exercise_type,
  primary_muscles = EXCLUDED.primary_muscles,
  secondary_muscles = EXCLUDED.secondary_muscles,
  equipment = EXCLUDED.equipment,
  difficulty_level = EXCLUDED.difficulty_level,
  instructions = EXCLUDED.instructions,
  image_url = EXCLUDED.image_url,
  video_url = EXCLUDED.video_url,
  catalog_status = 'active',
  retired_at = NULL,
  replacement_exercise_id = NULL;

INSERT INTO catalog_label_translations (
  label_type,
  label_key,
  language_code,
  display_name,
  source
)
VALUES
  ('equipment', 'Triceps press machine', 'en', 'Triceps press machine', 'canonical'),
  ('equipment', 'Triceps press machine', 'pl', 'Maszyna do wyciskania na triceps', 'curated')
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  source = EXCLUDED.source;
