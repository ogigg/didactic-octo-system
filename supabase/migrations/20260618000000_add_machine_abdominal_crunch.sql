-- -----------------------------------------------------------------------------
-- Migration: add_machine_abdominal_crunch
-- Adds a selectorized abdominal crunch machine to the curated catalog.
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
  'Machine Abdominal Crunch',
  'curated-machine-abdominal-crunch',
  'weight',
  ARRAY['Rectus abdominis'],
  ARRAY['Obliques'],
  ARRAY['Abdominal crunch machine'],
  'beginner',
  'Sit in the machine with your hips anchored and hold the handles lightly. Curl your ribs toward your pelvis without pulling with your arms or neck, then return upright with control.',
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

WITH target_exercise AS (
  SELECT id
  FROM exercises
  WHERE external_id = 'curated-machine-abdominal-crunch'
)
INSERT INTO exercise_translations (
  exercise_id,
  language_code,
  name,
  instructions,
  source
)
SELECT
  target_exercise.id,
  source.language_code,
  source.name,
  source.instructions,
  source.source
FROM target_exercise
CROSS JOIN (
  VALUES
    (
      'en',
      'Machine Abdominal Crunch',
      'Sit in the machine with your hips anchored and hold the handles lightly. Curl your ribs toward your pelvis without pulling with your arms or neck, then return upright with control.',
      'canonical'
    ),
    (
      'pl',
      'Brzuszki na maszynie',
      'Usiądź na maszynie z biodrami stabilnie opartymi i lekko trzymaj uchwyty. Zegnij tułów, kierując żebra w stronę miednicy bez ciągnięcia rękami ani szyją, a potem wróć kontrolowanie.',
      'curated'
    )
) AS source(language_code, name, instructions, source)
ON CONFLICT (exercise_id, language_code) DO UPDATE
SET
  name = EXCLUDED.name,
  instructions = EXCLUDED.instructions,
  source = EXCLUDED.source;

INSERT INTO catalog_label_translations (
  label_type,
  label_key,
  language_code,
  display_name,
  source
)
VALUES
  ('equipment', 'Abdominal crunch machine', 'en', 'Abdominal crunch machine', 'canonical'),
  ('equipment', 'Abdominal crunch machine', 'pl', 'Maszyna do brzuszków', 'curated')
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  source = EXCLUDED.source;
