/**
 * Curated exercise seeding script.
 *
 * This intentionally keeps the catalog compact so workout generation and
 * exercise swapping feel focused instead of cluttered with near-duplicates.
 *
 * Usage:
 *   npx tsx supabase/seed-exercises-trimmed.ts
 *
 * Requires environment variables:
 *   SUPABASE_URL          - Supabase project URL
 *   SUPABASE_SERVICE_KEY  - service_role key (bypasses RLS)
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface ExerciseRow {
  name: string;
  external_id: string;
  exercise_type: "weight";
  primary_muscles: string[];
  secondary_muscles: string[];
  equipment: string[];
  difficulty_level: "beginner" | "intermediate" | "advanced";
  instructions: string;
  image_url: null;
  video_url: null;
}

const CURATED_EXERCISES: ExerciseRow[] = [
  {
    name: "Barbell Bench Press",
    external_id: "curated-barbell-bench-press",
    exercise_type: "weight",
    primary_muscles: ["Pectoralis major"],
    secondary_muscles: ["Anterior deltoid", "Triceps brachii"],
    equipment: ["Barbell", "Bench"],
    difficulty_level: "intermediate",
    instructions:
      "Lie on a flat bench, grip the bar slightly wider than shoulder-width, lower it to your chest, then press back up with control.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Incline Dumbbell Press",
    external_id: "curated-incline-dumbbell-press",
    exercise_type: "weight",
    primary_muscles: ["Pectoralis major"],
    secondary_muscles: ["Anterior deltoid", "Triceps brachii"],
    equipment: ["Dumbbells", "Incline Bench"],
    difficulty_level: "intermediate",
    instructions:
      "Set the bench to a low incline, press the dumbbells from chest level, and lower them until your elbows are slightly below your shoulders.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Push-ups",
    external_id: "curated-push-ups",
    exercise_type: "weight",
    primary_muscles: ["Pectoralis major"],
    secondary_muscles: [
      "Anterior deltoid",
      "Triceps brachii",
      "Rectus abdominis",
    ],
    equipment: ["Body weight"],
    difficulty_level: "beginner",
    instructions:
      "Keep your body in a straight line, lower your chest toward the floor, then press back up without letting your hips sag.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Barbell Squat",
    external_id: "curated-barbell-squat",
    exercise_type: "weight",
    primary_muscles: ["Quadriceps"],
    secondary_muscles: ["Gluteus maximus", "Hamstrings", "Erector spinae"],
    equipment: ["Barbell", "Squat rack"],
    difficulty_level: "intermediate",
    instructions:
      "Set the bar on your upper back, brace your torso, squat to a comfortable depth, then drive back up through your midfoot.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Leg Press",
    external_id: "curated-leg-press",
    exercise_type: "weight",
    primary_muscles: ["Quadriceps"],
    secondary_muscles: ["Gluteus maximus", "Hamstrings"],
    equipment: ["Leg press machine"],
    difficulty_level: "beginner",
    instructions:
      "Place your feet about shoulder-width on the platform, lower with control, then press back up without locking your knees hard.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Bulgarian Split Squat",
    external_id: "curated-bulgarian-split-squat",
    exercise_type: "weight",
    primary_muscles: ["Quadriceps", "Gluteus maximus"],
    secondary_muscles: ["Hamstrings", "Adductors"],
    equipment: ["Dumbbells", "Bench"],
    difficulty_level: "intermediate",
    instructions:
      "Place your rear foot on a bench, lower your back knee toward the floor, then stand by driving through the front foot.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Romanian Deadlift",
    external_id: "curated-romanian-deadlift",
    exercise_type: "weight",
    primary_muscles: ["Hamstrings"],
    secondary_muscles: ["Gluteus maximus", "Erector spinae"],
    equipment: ["Barbell"],
    difficulty_level: "intermediate",
    instructions:
      "Hold the bar at hip height, hinge back with a flat back, lower until you feel your hamstrings stretch, then stand tall.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Conventional Deadlift",
    external_id: "curated-conventional-deadlift",
    exercise_type: "weight",
    primary_muscles: ["Erector spinae", "Gluteus maximus"],
    secondary_muscles: ["Hamstrings", "Quadriceps", "Trapezius"],
    equipment: ["Barbell"],
    difficulty_level: "advanced",
    instructions:
      "Stand with the bar over your midfoot, brace, grip outside your knees, and push the floor away while keeping the bar close.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Hip Thrust",
    external_id: "curated-hip-thrust",
    exercise_type: "weight",
    primary_muscles: ["Gluteus maximus"],
    secondary_muscles: ["Hamstrings", "Quadriceps"],
    equipment: ["Barbell", "Bench"],
    difficulty_level: "intermediate",
    instructions:
      "Rest your upper back on a bench, place the bar over your hips, drive your hips up, and squeeze your glutes at the top.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Pull-ups",
    external_id: "curated-pull-ups",
    exercise_type: "weight",
    primary_muscles: ["Latissimus dorsi"],
    secondary_muscles: ["Biceps brachii", "Rhomboids", "Trapezius"],
    equipment: ["Pull-up bar"],
    difficulty_level: "intermediate",
    instructions:
      "Grip the bar overhand, start from a controlled hang, pull until your chin clears the bar, then lower fully.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Lat Pulldown",
    external_id: "curated-lat-pulldown",
    exercise_type: "weight",
    primary_muscles: ["Latissimus dorsi"],
    secondary_muscles: ["Biceps brachii", "Rhomboids"],
    equipment: ["Cable machine"],
    difficulty_level: "beginner",
    instructions:
      "Grip the bar wider than shoulder-width, pull it toward your upper chest, and keep your shoulders down as you return.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Barbell Row",
    external_id: "curated-barbell-row",
    exercise_type: "weight",
    primary_muscles: ["Latissimus dorsi", "Rhomboids"],
    secondary_muscles: [
      "Biceps brachii",
      "Posterior deltoid",
      "Erector spinae",
    ],
    equipment: ["Barbell"],
    difficulty_level: "intermediate",
    instructions:
      "Hinge forward with a flat back, pull the bar toward your lower ribs, pause briefly, then lower with control.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Seated Cable Row",
    external_id: "curated-seated-cable-row",
    exercise_type: "weight",
    primary_muscles: ["Rhomboids", "Latissimus dorsi"],
    secondary_muscles: ["Biceps brachii", "Posterior deltoid"],
    equipment: ["Cable machine"],
    difficulty_level: "beginner",
    instructions:
      "Sit tall, pull the handle toward your torso, squeeze your shoulder blades, then return without rounding forward.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Overhead Press",
    external_id: "curated-overhead-press",
    exercise_type: "weight",
    primary_muscles: ["Anterior deltoid"],
    secondary_muscles: ["Lateral deltoid", "Triceps brachii", "Trapezius"],
    equipment: ["Barbell"],
    difficulty_level: "intermediate",
    instructions:
      "Start with the bar at shoulder height, brace your torso, press overhead, then lower back to the front rack.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Dumbbell Shoulder Press",
    external_id: "curated-dumbbell-shoulder-press",
    exercise_type: "weight",
    primary_muscles: ["Anterior deltoid"],
    secondary_muscles: ["Lateral deltoid", "Triceps brachii"],
    equipment: ["Dumbbells"],
    difficulty_level: "beginner",
    instructions:
      "Press the dumbbells from shoulder height until your arms are overhead, then lower with control.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Lateral Raises",
    external_id: "curated-lateral-raises",
    exercise_type: "weight",
    primary_muscles: ["Lateral deltoid"],
    secondary_muscles: ["Anterior deltoid"],
    equipment: ["Dumbbells"],
    difficulty_level: "beginner",
    instructions:
      "Hold dumbbells at your sides, raise them out until your arms are near shoulder height, then lower slowly.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Face Pull",
    external_id: "curated-face-pull",
    exercise_type: "weight",
    primary_muscles: ["Posterior deltoid", "Rhomboids"],
    secondary_muscles: ["Trapezius", "Rotator cuff"],
    equipment: ["Cable machine"],
    difficulty_level: "beginner",
    instructions:
      "Set a rope attachment near face height, pull toward your face with elbows high, and squeeze your upper back.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Barbell Curl",
    external_id: "curated-barbell-curl",
    exercise_type: "weight",
    primary_muscles: ["Biceps brachii"],
    secondary_muscles: ["Brachialis", "Brachioradialis"],
    equipment: ["Barbell"],
    difficulty_level: "beginner",
    instructions:
      "Stand tall, curl the bar without swinging your torso, squeeze briefly at the top, then lower fully.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Hammer Curl",
    external_id: "curated-hammer-curl",
    exercise_type: "weight",
    primary_muscles: ["Biceps brachii", "Brachialis"],
    secondary_muscles: ["Brachioradialis"],
    equipment: ["Dumbbells"],
    difficulty_level: "beginner",
    instructions:
      "Hold dumbbells with neutral grips, curl without rotating your wrists, then lower until your arms are straight.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Tricep Pushdown",
    external_id: "curated-tricep-pushdown",
    exercise_type: "weight",
    primary_muscles: ["Triceps brachii"],
    secondary_muscles: [],
    equipment: ["Cable machine"],
    difficulty_level: "beginner",
    instructions:
      "Keep your elbows pinned near your sides, press the handle down until your arms are straight, then return with control.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Dips",
    external_id: "curated-dips",
    exercise_type: "weight",
    primary_muscles: ["Triceps brachii", "Pectoralis major"],
    secondary_muscles: ["Anterior deltoid"],
    equipment: ["Dip bars"],
    difficulty_level: "intermediate",
    instructions:
      "Support yourself on dip bars, lower until your shoulders are comfortable, then press back up without bouncing.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Leg Curl",
    external_id: "curated-leg-curl",
    exercise_type: "weight",
    primary_muscles: ["Hamstrings"],
    secondary_muscles: ["Gastrocnemius"],
    equipment: ["Leg curl machine"],
    difficulty_level: "beginner",
    instructions:
      "Set the pad just above your heels, curl through a full comfortable range, then lower slowly.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Leg Extension",
    external_id: "curated-leg-extension",
    exercise_type: "weight",
    primary_muscles: ["Quadriceps"],
    secondary_muscles: [],
    equipment: ["Leg extension machine"],
    difficulty_level: "beginner",
    instructions:
      "Set the pad above your ankles, extend your knees under control, pause briefly, then lower without dropping the weight.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Calf Raise",
    external_id: "curated-calf-raise",
    exercise_type: "weight",
    primary_muscles: ["Gastrocnemius", "Soleus"],
    secondary_muscles: [],
    equipment: ["Calf raise machine"],
    difficulty_level: "beginner",
    instructions:
      "Rise onto the balls of your feet, pause at the top, then lower until you feel a calf stretch.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Plank",
    external_id: "curated-plank",
    exercise_type: "weight",
    primary_muscles: ["Rectus abdominis"],
    secondary_muscles: ["Obliques", "Transverse abdominis", "Gluteus maximus"],
    equipment: ["Body weight"],
    difficulty_level: "beginner",
    instructions:
      "Hold a straight line from head to heels, brace your abs, and keep breathing without letting your hips drop.",
    image_url: null,
    video_url: null,
  },
  {
    name: "Cable Crunch",
    external_id: "curated-cable-crunch",
    exercise_type: "weight",
    primary_muscles: ["Rectus abdominis"],
    secondary_muscles: ["Obliques"],
    equipment: ["Cable machine"],
    difficulty_level: "beginner",
    instructions:
      "Kneel under a cable rope, curl your ribs toward your pelvis, pause, then return without pulling with your arms.",
    image_url: null,
    video_url: null,
  },
];

async function main(): Promise<void> {
  const { error } = await supabase
    .from("exercises")
    .upsert(CURATED_EXERCISES, { onConflict: "external_id" });

  if (error) {
    console.error("Curated exercise seed failed:", error.message);
    throw error;
  }

  console.log(`Successfully upserted ${CURATED_EXERCISES.length} exercises.`);
}

main().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
