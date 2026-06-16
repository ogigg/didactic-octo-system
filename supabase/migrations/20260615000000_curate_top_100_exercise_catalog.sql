-- -----------------------------------------------------------------------------
-- Migration: curate_top_100_exercise_catalog
-- Replaces the broad imported exercise source with the reviewed top-100 catalog.
-- Old exercises are retired rather than deleted so workout history remains safe.
-- -----------------------------------------------------------------------------

ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS catalog_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS retired_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS replacement_exercise_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_catalog_status_valid'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_catalog_status_valid
      CHECK (catalog_status IN ('active', 'retired'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_retired_requires_retired_at'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_retired_requires_retired_at
      CHECK (catalog_status = 'active' OR retired_at IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercises_replacement_exercise_fk'
  ) THEN
    ALTER TABLE exercises
      ADD CONSTRAINT exercises_replacement_exercise_fk
      FOREIGN KEY (replacement_exercise_id) REFERENCES exercises(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_exercises_catalog_status
  ON exercises(catalog_status);

WITH reviewed_catalog AS (
  SELECT *
  FROM jsonb_to_recordset($catalog$
[
  {
    "name": "Barbell Bench Press",
    "external_id": "curated-barbell-bench-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Barbell",
      "Bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using barbell, bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Bench Press",
    "external_id": "curated-dumbbell-bench-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells",
      "Bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using dumbbells, bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Incline Barbell Bench Press",
    "external_id": "curated-incline-barbell-bench-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Barbell",
      "Incline bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using barbell, incline bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Incline Dumbbell Press",
    "external_id": "curated-incline-dumbbell-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells",
      "Incline bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using dumbbells, incline bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Decline Bench Press",
    "external_id": "curated-decline-bench-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Barbell",
      "Dumbbells",
      "Decline bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using barbell, dumbbells, decline bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Machine Chest Press",
    "external_id": "curated-machine-chest-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Chest press machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using chest press machine. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Push-up",
    "external_id": "curated-push-up",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using body weight. Move through a controlled range of motion, and focus on steady tension through chest while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Parallel Bar Dip",
    "external_id": "curated-parallel-bar-dip",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Dip bars"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Chest Fly",
    "external_id": "curated-cable-chest-fly",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Use a slight elbow bend, open your arms until you feel a chest stretch, then bring your hands together while keeping the movement smooth and controlled.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Chest Fly",
    "external_id": "curated-dumbbell-chest-fly",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells",
      "Bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Use a slight elbow bend, open your arms until you feel a chest stretch, then bring your hands together while keeping the movement smooth and controlled.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Pec Deck Fly",
    "external_id": "curated-pec-deck-fly",
    "exercise_type": "weight",
    "primary_muscles": [
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid",
      "Triceps brachii"
    ],
    "equipment": [
      "Pec deck machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Use a slight elbow bend, open your arms until you feel a chest stretch, then bring your hands together while keeping the movement smooth and controlled.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Pull-up",
    "external_id": "curated-pull-up",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Pull-up bar"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Chin-up",
    "external_id": "curated-chin-up",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Pull-up bar"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Assisted Pull-up",
    "external_id": "curated-assisted-pull-up",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Assisted pull-up machine",
      "Resistance band"
    ],
    "difficulty_level": "beginner",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Lat Pulldown",
    "external_id": "curated-lat-pulldown",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Single-Arm Lat Pulldown",
    "external_id": "curated-single-arm-lat-pulldown",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Straight-Arm Pulldown",
    "external_id": "curated-straight-arm-pulldown",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Start from a controlled stretch, pull your elbows down toward your sides, pause briefly near the top or chest, then return with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Barbell Bent-Over Row",
    "external_id": "curated-barbell-bent-over-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi",
      "Rhomboids"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "One-Arm Dumbbell Row",
    "external_id": "curated-one-arm-dumbbell-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi",
      "Rhomboids"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Dumbbell",
      "Bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Chest-Supported Dumbbell Row",
    "external_id": "curated-chest-supported-dumbbell-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rhomboids",
      "Trapezius"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Dumbbells",
      "Incline bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Seated Cable Row",
    "external_id": "curated-seated-cable-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi",
      "Rhomboids"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Machine Row",
    "external_id": "curated-machine-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi",
      "Rhomboids"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Row machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "T-Bar Row",
    "external_id": "curated-t-bar-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rhomboids",
      "Trapezius"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "T-bar or landmine"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Inverted Row",
    "external_id": "curated-inverted-row",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rhomboids",
      "Trapezius"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your torso, pull your elbows back until your shoulder blades squeeze together, then return the weight with control instead of rounding forward.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Pullover",
    "external_id": "curated-dumbbell-pullover",
    "exercise_type": "weight",
    "primary_muscles": [
      "Latissimus dorsi",
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Posterior deltoid"
    ],
    "equipment": [
      "Dumbbell",
      "Bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using dumbbell, bench. Move through a controlled range of motion, and focus on steady tension through lats, chest while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Back Extension",
    "external_id": "curated-back-extension",
    "exercise_type": "weight",
    "primary_muscles": [
      "Erector spinae",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps"
    ],
    "equipment": [
      "Back extension bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using back extension bench. Move through a controlled range of motion, and focus on steady tension through erectors, glutes while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Barbell Overhead Press",
    "external_id": "curated-barbell-overhead-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Anterior deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using barbell. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Shoulder Press",
    "external_id": "curated-dumbbell-shoulder-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Anterior deltoid",
      "Lateral deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using dumbbells. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Machine Shoulder Press",
    "external_id": "curated-machine-shoulder-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Anterior deltoid",
      "Lateral deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Shoulder press machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using shoulder press machine. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Arnold Press",
    "external_id": "curated-arnold-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Anterior deltoid",
      "Lateral deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using dumbbells. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Lateral Raise",
    "external_id": "curated-dumbbell-lateral-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Lateral deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Lateral Raise",
    "external_id": "curated-cable-lateral-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Lateral deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Rear Delt Fly",
    "external_id": "curated-rear-delt-fly",
    "exercise_type": "weight",
    "primary_muscles": [
      "Posterior deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells",
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Use a slight elbow bend, open your arms until you feel a chest stretch, then bring your hands together while keeping the movement smooth and controlled.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Reverse Pec Deck",
    "external_id": "curated-reverse-pec-deck",
    "exercise_type": "weight",
    "primary_muscles": [
      "Posterior deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Reverse fly machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Use a slight elbow bend, open your arms until you feel a chest stretch, then bring your hands together while keeping the movement smooth and controlled.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Face Pull",
    "external_id": "curated-face-pull",
    "exercise_type": "weight",
    "primary_muscles": [
      "Posterior deltoid",
      "Rhomboids"
    ],
    "secondary_muscles": [
      "Biceps brachii",
      "Triceps brachii"
    ],
    "equipment": [
      "Cable machine",
      "Rope attachment"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using cable machine, rope attachment. Move through a controlled range of motion, and focus on steady tension through rear delts, upper back while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Front Raise",
    "external_id": "curated-dumbbell-front-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Anterior deltoid"
    ],
    "secondary_muscles": [
      "Triceps brachii"
    ],
    "equipment": [
      "Dumbbells",
      "Weight plate"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Barbell Shrug",
    "external_id": "curated-barbell-shrug",
    "exercise_type": "weight",
    "primary_muscles": [
      "Trapezius"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using barbell. Move through a controlled range of motion, and focus on steady tension through traps while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Shrug",
    "external_id": "curated-dumbbell-shrug",
    "exercise_type": "weight",
    "primary_muscles": [
      "Trapezius"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using dumbbells. Move through a controlled range of motion, and focus on steady tension through traps while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Barbell Back Squat",
    "external_id": "curated-barbell-back-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Barbell",
      "Squat rack"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up for the barbell back squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Front Squat",
    "external_id": "curated-front-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up for the front squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Bodyweight Squat",
    "external_id": "curated-bodyweight-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up for the bodyweight squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Goblet Squat",
    "external_id": "curated-goblet-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Dumbbell",
      "Kettlebell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up for the goblet squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Smith Machine Squat",
    "external_id": "curated-smith-machine-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Smith machine"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up for the smith machine squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hack Squat",
    "external_id": "curated-hack-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "equipment": [
      "Hack squat machine"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up for the hack squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Leg Press",
    "external_id": "curated-leg-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Leg press machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using leg press machine. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Bulgarian Split Squat",
    "external_id": "curated-bulgarian-split-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Dumbbells",
      "Bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up for the bulgarian split squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Walking Lunge",
    "external_id": "curated-walking-lunge",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Dumbbells",
      "Body weight"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Step into position with control, lower until both legs share the work, then drive through the front foot while keeping your torso steady.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Reverse Lunge",
    "external_id": "curated-reverse-lunge",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Dumbbells",
      "Barbell",
      "Body weight"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Step into position with control, lower until both legs share the work, then drive through the front foot while keeping your torso steady.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Box Squat",
    "external_id": "curated-box-squat",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings"
    ],
    "equipment": [
      "Box",
      "Barbell",
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up for the box squat with a braced torso, lower to a controlled depth, then drive back up through your midfoot while keeping your knees tracking over your toes.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Leg Extension",
    "external_id": "curated-leg-extension",
    "exercise_type": "weight",
    "primary_muscles": [
      "Quadriceps"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "equipment": [
      "Leg extension machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set the machine so your knees align with the pivot, extend your legs under control, squeeze your quads, then lower without dropping the weight.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Conventional Deadlift",
    "external_id": "curated-conventional-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus",
      "Erector spinae",
      "Hamstrings"
    ],
    "secondary_muscles": [
      "Quadriceps"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "advanced",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Sumo Deadlift",
    "external_id": "curated-sumo-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus",
      "Quadriceps",
      "Hamstrings"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Rack Deadlift",
    "external_id": "curated-rack-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Erector spinae",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps"
    ],
    "equipment": [
      "Barbell",
      "Squat rack"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Romanian Deadlift",
    "external_id": "curated-romanian-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Quadriceps"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Romanian Deadlift",
    "external_id": "curated-dumbbell-romanian-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Quadriceps"
    ],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Single-Leg Romanian Deadlift",
    "external_id": "curated-single-leg-romanian-deadlift",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Quadriceps"
    ],
    "equipment": [
      "Dumbbell",
      "Body weight"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hip Thrust",
    "external_id": "curated-hip-thrust",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps"
    ],
    "equipment": [
      "Barbell",
      "Bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set your upper back or shoulders securely, drive your hips up, squeeze your glutes at the top, then lower with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Glute Bridge",
    "external_id": "curated-glute-bridge",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps"
    ],
    "equipment": [
      "Body weight",
      "Barbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set your upper back or shoulders securely, drive your hips up, squeeze your glutes at the top, then lower with control.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Pull-Through",
    "external_id": "curated-cable-pull-through",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus",
      "Hamstrings"
    ],
    "secondary_muscles": [
      "Quadriceps"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using cable machine. Move through a controlled range of motion, and focus on steady tension through glutes, hamstrings while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Good Morning",
    "external_id": "curated-good-morning",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings",
      "Erector spinae"
    ],
    "secondary_muscles": [
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "advanced",
    "instructions": "Brace your torso, hinge at the hips with a neutral spine, keep the load close, then stand tall by driving through your hips and legs.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Lying Leg Curl",
    "external_id": "curated-lying-leg-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings"
    ],
    "secondary_muscles": [
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Lying leg curl machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Seated Leg Curl",
    "external_id": "curated-seated-leg-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings"
    ],
    "secondary_muscles": [
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Seated leg curl machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Nordic Curl",
    "external_id": "curated-nordic-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Hamstrings"
    ],
    "secondary_muscles": [
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "advanced",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Glute Kickback Machine",
    "external_id": "curated-glute-kickback-machine",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps"
    ],
    "equipment": [
      "Glute kickback machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using glute kickback machine. Move through a controlled range of motion, and focus on steady tension through glutes while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hip Abduction Machine",
    "external_id": "curated-hip-abduction-machine",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gluteus medius"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Hip abduction machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using hip abduction machine. Move through a controlled range of motion, and focus on steady tension through glute medius while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hip Adduction Machine",
    "external_id": "curated-hip-adduction-machine",
    "exercise_type": "weight",
    "primary_muscles": [
      "Adductors"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Gluteus maximus",
      "Quadriceps"
    ],
    "equipment": [
      "Hip adduction machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using hip adduction machine. Move through a controlled range of motion, and focus on steady tension through adductors while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Standing Calf Raise",
    "external_id": "curated-standing-calf-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gastrocnemius"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Calf raise machine",
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Seated Calf Raise",
    "external_id": "curated-seated-calf-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Soleus"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Seated calf raise machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Calf Press on Leg Press",
    "external_id": "curated-calf-press-on-leg-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Gastrocnemius"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Leg press machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using leg press machine. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Barbell Curl",
    "external_id": "curated-barbell-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Barbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Curl",
    "external_id": "curated-dumbbell-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hammer Curl",
    "external_id": "curated-hammer-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii",
      "Brachialis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Incline Dumbbell Curl",
    "external_id": "curated-incline-dumbbell-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Dumbbells",
      "Incline bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Preacher Curl",
    "external_id": "curated-preacher-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Preacher bench",
      "EZ-bar",
      "Dumbbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Curl",
    "external_id": "curated-cable-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "EZ-Bar Curl",
    "external_id": "curated-ez-bar-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "EZ-bar"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Concentration Curl",
    "external_id": "curated-concentration-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Biceps brachii"
    ],
    "secondary_muscles": [
      "Brachialis"
    ],
    "equipment": [
      "Dumbbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Reverse Curl",
    "external_id": "curated-reverse-curl",
    "exercise_type": "weight",
    "primary_muscles": [
      "Brachialis",
      "Forearms"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Barbell",
      "EZ-bar",
      "Dumbbells"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your upper arms steady, curl through a full comfortable range, squeeze briefly at the top, then lower slowly without swinging.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Triceps Pushdown",
    "external_id": "curated-cable-triceps-pushdown",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Overhead Cable Triceps Extension",
    "external_id": "curated-overhead-cable-triceps-extension",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Dumbbell Overhead Triceps Extension",
    "external_id": "curated-dumbbell-overhead-triceps-extension",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Dumbbell"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Skull Crusher",
    "external_id": "curated-skull-crusher",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Barbell",
      "Dumbbells"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Close-Grip Bench Press",
    "external_id": "curated-close-grip-bench-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii",
      "Pectoralis major"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Barbell",
      "Bench"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Set up securely using barbell, bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Bench Dip",
    "external_id": "curated-bench-dip",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Bench"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using bench. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Machine Triceps Extension",
    "external_id": "curated-machine-triceps-extension",
    "exercise_type": "weight",
    "primary_muscles": [
      "Triceps brachii"
    ],
    "secondary_muscles": [
      "Anterior deltoid"
    ],
    "equipment": [
      "Triceps machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your shoulders stable, bend and extend your elbows through a comfortable range, and control the lowering phase on every rep.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Plank",
    "external_id": "curated-plank",
    "exercise_type": "time",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your abs and glutes, keep a straight line from shoulders to ankles, and hold the position without letting your hips sag or rotate.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Side Plank",
    "external_id": "curated-side-plank",
    "exercise_type": "time",
    "primary_muscles": [
      "Obliques"
    ],
    "secondary_muscles": [
      "Rectus abdominis"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your abs and glutes, keep a straight line from shoulders to ankles, and hold the position without letting your hips sag or rotate.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Plank Shoulder Tap",
    "external_id": "curated-plank-shoulder-tap",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis",
      "Anterior deltoid"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Brace your abs and glutes, keep a straight line from shoulders to ankles, and hold the position without letting your hips sag or rotate.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Bird Dog",
    "external_id": "curated-bird-dog",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis",
      "Gluteus maximus"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using body weight. Move through a controlled range of motion, and focus on steady tension through core, glutes while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Superman",
    "external_id": "curated-superman",
    "exercise_type": "weight",
    "primary_muscles": [
      "Erector spinae",
      "Gluteus maximus"
    ],
    "secondary_muscles": [
      "Hamstrings",
      "Quadriceps",
      "Rectus abdominis"
    ],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up using body weight. Move through a controlled range of motion, and focus on steady tension through back, glutes while keeping your technique consistent.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Crunch",
    "external_id": "curated-crunch",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight",
      "Mat"
    ],
    "difficulty_level": "beginner",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Cable Crunch",
    "external_id": "curated-cable-crunch",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Cable machine"
    ],
    "difficulty_level": "beginner",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Reverse Crunch",
    "external_id": "curated-reverse-crunch",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hanging Knee Raise",
    "external_id": "curated-hanging-knee-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Pull-up bar"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Hanging Leg Raise",
    "external_id": "curated-hanging-leg-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Pull-up bar"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Lying Leg Raise",
    "external_id": "curated-lying-leg-raise",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight",
      "Mat"
    ],
    "difficulty_level": "beginner",
    "instructions": "Keep your torso steady, raise the weight smoothly to about shoulder height, then lower slowly while keeping tension on the target muscles.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Bicycle Crunch",
    "external_id": "curated-bicycle-crunch",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis",
      "Obliques"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Body weight"
    ],
    "difficulty_level": "beginner",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Russian Twist",
    "external_id": "curated-russian-twist",
    "exercise_type": "weight",
    "primary_muscles": [
      "Obliques"
    ],
    "secondary_muscles": [
      "Rectus abdominis"
    ],
    "equipment": [
      "Body weight",
      "Dumbbell",
      "Medicine ball"
    ],
    "difficulty_level": "beginner",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Pallof Press",
    "external_id": "curated-pallof-press",
    "exercise_type": "weight",
    "primary_muscles": [
      "Obliques",
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Cable machine",
      "Resistance band"
    ],
    "difficulty_level": "beginner",
    "instructions": "Set up securely using cable machine, resistance band. Brace your torso, then press with control, then lower until you reach a comfortable range without losing shoulder position.",
    "image_url": null,
    "video_url": null
  },
  {
    "name": "Ab Rollout",
    "external_id": "curated-ab-rollout",
    "exercise_type": "weight",
    "primary_muscles": [
      "Rectus abdominis"
    ],
    "secondary_muscles": [],
    "equipment": [
      "Ab wheel",
      "Barbell"
    ],
    "difficulty_level": "intermediate",
    "instructions": "Move from your trunk with control, keep your lower back comfortable, and focus on steady tension through your abs and obliques.",
    "image_url": null,
    "video_url": null
  }
]
$catalog$::jsonb) AS row(
    name TEXT,
    external_id TEXT,
    exercise_type TEXT,
    primary_muscles TEXT[],
    secondary_muscles TEXT[],
    equipment TEXT[],
    difficulty_level TEXT,
    instructions TEXT,
    image_url TEXT,
    video_url TEXT
  )
), upserted AS (
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
  SELECT
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
    'active',
    NULL,
    NULL
  FROM reviewed_catalog
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
    replacement_exercise_id = NULL
  RETURNING external_id
)
UPDATE exercises e
SET
  catalog_status = 'retired',
  retired_at = COALESCE(e.retired_at, NOW()),
  replacement_exercise_id = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM reviewed_catalog rc
  WHERE rc.external_id = e.external_id
);

INSERT INTO catalog_label_translations (
  label_type,
  label_key,
  language_code,
  display_name,
  source
)
VALUES
  ('muscle', 'Adductors', 'en', 'Adductors', 'canonical'),
  ('muscle', 'Anterior deltoid', 'en', 'Anterior deltoid', 'canonical'),
  ('muscle', 'Biceps brachii', 'en', 'Biceps brachii', 'canonical'),
  ('muscle', 'Brachialis', 'en', 'Brachialis', 'canonical'),
  ('muscle', 'Erector spinae', 'en', 'Erector spinae', 'canonical'),
  ('muscle', 'Forearms', 'en', 'Forearms', 'canonical'),
  ('muscle', 'Gastrocnemius', 'en', 'Gastrocnemius', 'canonical'),
  ('muscle', 'Gluteus maximus', 'en', 'Gluteus maximus', 'canonical'),
  ('muscle', 'Gluteus medius', 'en', 'Gluteus medius', 'canonical'),
  ('muscle', 'Hamstrings', 'en', 'Hamstrings', 'canonical'),
  ('muscle', 'Lateral deltoid', 'en', 'Lateral deltoid', 'canonical'),
  ('muscle', 'Latissimus dorsi', 'en', 'Latissimus dorsi', 'canonical'),
  ('muscle', 'Obliques', 'en', 'Obliques', 'canonical'),
  ('muscle', 'Pectoralis major', 'en', 'Pectoralis major', 'canonical'),
  ('muscle', 'Posterior deltoid', 'en', 'Posterior deltoid', 'canonical'),
  ('muscle', 'Quadriceps', 'en', 'Quadriceps', 'canonical'),
  ('muscle', 'Rectus abdominis', 'en', 'Rectus abdominis', 'canonical'),
  ('muscle', 'Rhomboids', 'en', 'Rhomboids', 'canonical'),
  ('muscle', 'Soleus', 'en', 'Soleus', 'canonical'),
  ('muscle', 'Trapezius', 'en', 'Trapezius', 'canonical'),
  ('muscle', 'Triceps brachii', 'en', 'Triceps brachii', 'canonical'),
  ('equipment', 'Ab wheel', 'en', 'Ab wheel', 'canonical'),
  ('equipment', 'Assisted pull-up machine', 'en', 'Assisted pull-up machine', 'canonical'),
  ('equipment', 'Back extension bench', 'en', 'Back extension bench', 'canonical'),
  ('equipment', 'Barbell', 'en', 'Barbell', 'canonical'),
  ('equipment', 'Bench', 'en', 'Bench', 'canonical'),
  ('equipment', 'Body weight', 'en', 'Body weight', 'canonical'),
  ('equipment', 'Box', 'en', 'Box', 'canonical'),
  ('equipment', 'Cable machine', 'en', 'Cable machine', 'canonical'),
  ('equipment', 'Calf raise machine', 'en', 'Calf raise machine', 'canonical'),
  ('equipment', 'Chest press machine', 'en', 'Chest press machine', 'canonical'),
  ('equipment', 'Decline bench', 'en', 'Decline bench', 'canonical'),
  ('equipment', 'Dip bars', 'en', 'Dip bars', 'canonical'),
  ('equipment', 'Dumbbell', 'en', 'Dumbbell', 'canonical'),
  ('equipment', 'Dumbbells', 'en', 'Dumbbells', 'canonical'),
  ('equipment', 'EZ-bar', 'en', 'EZ-bar', 'canonical'),
  ('equipment', 'Glute kickback machine', 'en', 'Glute kickback machine', 'canonical'),
  ('equipment', 'Hack squat machine', 'en', 'Hack squat machine', 'canonical'),
  ('equipment', 'Hip abduction machine', 'en', 'Hip abduction machine', 'canonical'),
  ('equipment', 'Hip adduction machine', 'en', 'Hip adduction machine', 'canonical'),
  ('equipment', 'Incline bench', 'en', 'Incline bench', 'canonical'),
  ('equipment', 'Kettlebell', 'en', 'Kettlebell', 'canonical'),
  ('equipment', 'Leg extension machine', 'en', 'Leg extension machine', 'canonical'),
  ('equipment', 'Leg press machine', 'en', 'Leg press machine', 'canonical'),
  ('equipment', 'Lying leg curl machine', 'en', 'Lying leg curl machine', 'canonical'),
  ('equipment', 'Mat', 'en', 'Mat', 'canonical'),
  ('equipment', 'Medicine ball', 'en', 'Medicine ball', 'canonical'),
  ('equipment', 'Pec deck machine', 'en', 'Pec deck machine', 'canonical'),
  ('equipment', 'Preacher bench', 'en', 'Preacher bench', 'canonical'),
  ('equipment', 'Pull-up bar', 'en', 'Pull-up bar', 'canonical'),
  ('equipment', 'Resistance band', 'en', 'Resistance band', 'canonical'),
  ('equipment', 'Reverse fly machine', 'en', 'Reverse fly machine', 'canonical'),
  ('equipment', 'Rope attachment', 'en', 'Rope attachment', 'canonical'),
  ('equipment', 'Row machine', 'en', 'Row machine', 'canonical'),
  ('equipment', 'Seated calf raise machine', 'en', 'Seated calf raise machine', 'canonical'),
  ('equipment', 'Seated leg curl machine', 'en', 'Seated leg curl machine', 'canonical'),
  ('equipment', 'Shoulder press machine', 'en', 'Shoulder press machine', 'canonical'),
  ('equipment', 'Smith machine', 'en', 'Smith machine', 'canonical'),
  ('equipment', 'Squat rack', 'en', 'Squat rack', 'canonical'),
  ('equipment', 'T-bar or landmine', 'en', 'T-bar or landmine', 'canonical'),
  ('equipment', 'Triceps machine', 'en', 'Triceps machine', 'canonical'),
  ('equipment', 'Weight plate', 'en', 'Weight plate', 'canonical'),
  ('difficulty', 'beginner', 'en', 'beginner', 'canonical'),
  ('difficulty', 'intermediate', 'en', 'intermediate', 'canonical'),
  ('difficulty', 'advanced', 'en', 'advanced', 'canonical')
ON CONFLICT (label_type, label_key, language_code) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  source = EXCLUDED.source;

CREATE OR REPLACE FUNCTION get_localized_exercises(
  p_language TEXT DEFAULT 'en',
  p_search TEXT DEFAULT NULL,
  p_muscles TEXT[] DEFAULT NULL,
  p_equipment TEXT[] DEFAULT NULL,
  p_ids UUID[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH search_input AS (
    SELECT NULLIF(trim(p_search), '') AS query
  ),
  localized AS (
    SELECT
      e.id,
      e.name AS canonical_name,
      e.external_id,
      e.exercise_type,
      e.primary_muscles,
      e.secondary_muscles,
      e.equipment,
      e.difficulty_level,
      e.instructions AS canonical_instructions,
      e.image_url,
      e.video_url,
      primary_image.public_url AS primary_image_url,
      primary_image.width AS primary_image_width,
      primary_image.height AS primary_image_height,
      primary_image.blurhash AS primary_image_blurhash,
      primary_image.alt_text AS primary_image_alt_text,
      primary_image.source AS primary_image_source,
      thumbnail_image.public_url AS thumbnail_image_url,
      thumbnail_image.width AS thumbnail_image_width,
      thumbnail_image.height AS thumbnail_image_height,
      COALESCE(req.name, en.name, e.name) AS localized_name,
      COALESCE(req.instructions, en.instructions, e.instructions) AS localized_instructions,
      en.name AS english_name
    FROM exercises e
    LEFT JOIN exercise_translations req
      ON req.exercise_id = e.id
     AND req.language_code = COALESCE(NULLIF(p_language, ''), 'en')
    LEFT JOIN exercise_translations en
      ON en.exercise_id = e.id
     AND en.language_code = 'en'
    LEFT JOIN LATERAL (
      SELECT ema.*
      FROM exercise_media_assets ema
      WHERE ema.exercise_id = e.id
        AND ema.kind = 'image'
        AND ema.status = 'active'
      ORDER BY
        CASE ema.purpose WHEN 'hero' THEN 0 WHEN 'thumbnail' THEN 1 ELSE 2 END,
        ema.sort_order,
        ema.created_at
      LIMIT 1
    ) primary_image ON true
    LEFT JOIN LATERAL (
      SELECT ema.*
      FROM exercise_media_assets ema
      WHERE ema.exercise_id = e.id
        AND ema.kind = 'image'
        AND ema.purpose = 'thumbnail'
        AND ema.status = 'active'
      ORDER BY ema.sort_order, ema.created_at
      LIMIT 1
    ) thumbnail_image ON true
    WHERE (p_ids IS NOT NULL OR e.catalog_status = 'active')
      AND (p_ids IS NULL OR e.id = ANY(p_ids))
      AND (p_muscles IS NULL OR e.primary_muscles && p_muscles)
      AND (p_equipment IS NULL OR e.equipment && p_equipment)
  ),
  ranked AS (
    SELECT
      l.*,
      lower(si.query) AS normalized_query,
      lower(l.localized_name) AS normalized_localized_name,
      lower(l.canonical_name) AS normalized_canonical_name,
      lower(COALESCE(l.english_name, '')) AS normalized_english_name
    FROM localized l
    CROSS JOIN search_input si
  ),
  matches AS (
    SELECT
      r.*,
      CASE
        WHEN r.normalized_query IS NULL THEN 0
        WHEN r.normalized_localized_name = r.normalized_query THEN 100
        WHEN r.normalized_canonical_name = r.normalized_query THEN 95
        WHEN r.normalized_english_name = r.normalized_query THEN 90
        WHEN r.normalized_localized_name LIKE (r.normalized_query || '%') THEN 80
        WHEN r.normalized_canonical_name LIKE (r.normalized_query || '%') THEN 76
        WHEN r.normalized_english_name LIKE (r.normalized_query || '%') THEN 72
        WHEN r.normalized_localized_name LIKE ('%' || r.normalized_query || '%') THEN 60
        WHEN r.normalized_canonical_name LIKE ('%' || r.normalized_query || '%') THEN 56
        WHEN r.normalized_english_name LIKE ('%' || r.normalized_query || '%') THEN 52
        ELSE GREATEST(
          similarity(r.normalized_localized_name, r.normalized_query),
          similarity(r.normalized_canonical_name, r.normalized_query),
          similarity(r.normalized_english_name, r.normalized_query),
          word_similarity(r.normalized_query, r.normalized_localized_name),
          word_similarity(r.normalized_query, r.normalized_canonical_name),
          word_similarity(r.normalized_query, r.normalized_english_name)
        ) * 40
      END AS search_rank
    FROM ranked r
    WHERE r.normalized_query IS NULL
      OR r.normalized_localized_name LIKE ('%' || r.normalized_query || '%')
      OR r.normalized_canonical_name LIKE ('%' || r.normalized_query || '%')
      OR r.normalized_english_name LIKE ('%' || r.normalized_query || '%')
      OR (
        char_length(r.normalized_query) >= 3
        AND GREATEST(
          similarity(r.normalized_localized_name, r.normalized_query),
          similarity(r.normalized_canonical_name, r.normalized_query),
          similarity(r.normalized_english_name, r.normalized_query),
          word_similarity(r.normalized_query, r.normalized_localized_name),
          word_similarity(r.normalized_query, r.normalized_canonical_name),
          word_similarity(r.normalized_query, r.normalized_english_name)
        ) >= 0.35
      )
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.localized_name,
        'external_id', m.external_id,
        'exercise_type', m.exercise_type,
        'primary_muscles', m.primary_muscles,
        'primary_muscle_labels', localized_label_array('muscle', m.primary_muscles, p_language),
        'secondary_muscles', m.secondary_muscles,
        'secondary_muscle_labels', localized_label_array('muscle', m.secondary_muscles, p_language),
        'equipment', m.equipment,
        'equipment_labels', localized_label_array('equipment', m.equipment, p_language),
        'difficulty_level', m.difficulty_level,
        'difficulty_label', CASE
          WHEN m.difficulty_level IS NULL THEN NULL
          ELSE (
            SELECT COALESCE(req_label.display_name, en_label.display_name, m.difficulty_level)
            FROM (SELECT m.difficulty_level AS label_key) dl
            LEFT JOIN catalog_label_translations req_label
              ON req_label.label_type = 'difficulty'
             AND req_label.label_key = dl.label_key
             AND req_label.language_code = COALESCE(NULLIF(p_language, ''), 'en')
            LEFT JOIN catalog_label_translations en_label
              ON en_label.label_type = 'difficulty'
             AND en_label.label_key = dl.label_key
             AND en_label.language_code = 'en'
          )
        END,
        'instructions', m.localized_instructions,
        'image', CASE
          WHEN COALESCE(m.primary_image_url, m.image_url) IS NULL THEN NULL
          ELSE jsonb_build_object(
            'url', COALESCE(m.primary_image_url, m.image_url),
            'thumbnail_url', m.thumbnail_image_url,
            'width', m.primary_image_width,
            'height', m.primary_image_height,
            'thumbnail_width', m.thumbnail_image_width,
            'thumbnail_height', m.thumbnail_image_height,
            'alt_text', m.primary_image_alt_text,
            'blurhash', m.primary_image_blurhash,
            'source', m.primary_image_source
          )
        END,
        'image_url', COALESCE(m.primary_image_url, m.image_url),
        'video_url', m.video_url
      )
      ORDER BY m.search_rank DESC, m.localized_name
    ),
    '[]'::jsonb
  )
  FROM matches m;
$$;


CREATE OR REPLACE FUNCTION get_localized_exercise(
  p_exercise_id UUID,
  p_language TEXT DEFAULT 'en'
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (get_localized_exercises(p_language, NULL, NULL, NULL, ARRAY[p_exercise_id])->0),
    '{}'::jsonb
  );
$$;
