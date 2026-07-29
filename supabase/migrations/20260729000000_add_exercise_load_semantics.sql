-- Canonical load semantics used to validate generated workout prescriptions.
-- External-load movements require a positive kg target. Other semantics make
-- zero-load or duration prescriptions explicit at the exercise level.

ALTER TABLE exercises
  ADD COLUMN load_semantics TEXT NOT NULL DEFAULT 'external';

UPDATE exercises
SET load_semantics = 'bodyweight'
WHERE external_id IN (
  'curated-push-up',
  'curated-parallel-bar-dip',
  'curated-pull-up',
  'curated-chin-up',
  'curated-inverted-row',
  'curated-back-extension',
  'curated-bodyweight-squat',
  'curated-nordic-curl',
  'curated-bench-dip',
  'curated-plank-shoulder-tap',
  'curated-bird-dog',
  'curated-superman',
  'curated-crunch',
  'curated-reverse-crunch',
  'curated-hanging-knee-raise',
  'curated-hanging-leg-raise',
  'curated-lying-leg-raise',
  'curated-bicycle-crunch',
  'curated-ab-rollout'
);

UPDATE exercises
SET load_semantics = 'bodyweight_or_external'
WHERE external_id IN (
  'curated-bulgarian-split-squat',
  'curated-walking-lunge',
  'curated-reverse-lunge',
  'curated-box-squat',
  'curated-single-leg-romanian-deadlift',
  'curated-glute-bridge',
  'curated-standing-calf-raise',
  'curated-russian-twist'
);

UPDATE exercises
SET load_semantics = 'assisted'
WHERE external_id = 'curated-assisted-pull-up';

UPDATE exercises
SET load_semantics = 'variable_resistance'
WHERE external_id = 'curated-pallof-press';

UPDATE exercises
SET load_semantics = 'duration'
WHERE exercise_type = 'time';

ALTER TABLE exercises
  ADD CONSTRAINT exercises_load_semantics_valid
  CHECK (
    load_semantics IN (
      'external',
      'bodyweight',
      'bodyweight_or_external',
      'assisted',
      'variable_resistance',
      'duration'
    )
  ),
  ADD CONSTRAINT exercises_duration_semantics_match_type
  CHECK (
    (exercise_type = 'time' AND load_semantics = 'duration')
    OR (exercise_type = 'weight' AND load_semantics <> 'duration')
  );

COMMENT ON COLUMN exercises.load_semantics IS
  'Canonical prescription semantics: external loads require positive kg; bodyweight/assisted/variable movements may use zero; duration movements use seconds.';
