import type { GenerateWorkoutResponse } from "@/lib/api/generate-workout";
import { fetchExercises, type Exercise } from "@/lib/api/exercises";
import type { FocusArea, PendingWorkout } from "@/lib/api/pending-workouts";

export const STALE_PENDING_WORKOUT_MS = 5 * 60 * 1000;
export const MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS = 3;

const EQUIPMENT_FILTERS: Record<
  "bodyweight" | "dumbbells" | "barbell" | "full_gym",
  string[]
> = {
  bodyweight: ["bodyweight"],
  dumbbells: ["bodyweight", "dumbbell"],
  barbell: ["bodyweight", "barbell"],
  full_gym: [],
};

const FALLBACK_SEARCHES: Record<FocusArea, string[]> = {
  push: [
    "Bench Press",
    "Push Up",
    "Overhead Press",
    "Lateral Raise",
    "Triceps Extension",
  ],
  pull: ["Row", "Lat Pulldown", "Pull Up", "Face Pull", "Biceps Curl"],
  legs: ["Squat", "Romanian Deadlift", "Lunge", "Leg Press", "Calf Raise"],
  upper: ["Bench Press", "Row", "Overhead Press", "Lat Pulldown", "Curl"],
  lower: [
    "Squat",
    "Romanian Deadlift",
    "Leg Curl",
    "Split Squat",
    "Calf Raise",
  ],
  full_body: ["Squat", "Bench Press", "Row", "Deadlift", "Overhead Press"],
};

function getExerciseMatches(
  search: string,
  exercises: Exercise[],
  usedIds: Set<string>
): Exercise | null {
  const normalizedSearch = search.toLowerCase();

  return (
    exercises.find((exercise) => {
      if (usedIds.has(exercise.id)) return false;
      return exercise.name.toLowerCase().includes(normalizedSearch);
    }) ?? null
  );
}

function getSetTargets(
  focusArea: FocusArea,
  exerciseName: string
): { target_load_kg: number; target_reps: number; set_type: "working" }[] {
  const lowerName = exerciseName.toLowerCase();
  const compound =
    lowerName.includes("press") ||
    lowerName.includes("squat") ||
    lowerName.includes("deadlift") ||
    lowerName.includes("row") ||
    lowerName.includes("pulldown");

  if (focusArea === "legs" || focusArea === "lower") {
    return Array.from({ length: compound ? 4 : 3 }, () => ({
      set_type: "working",
      target_load_kg: 0,
      target_reps: compound ? 8 : 12,
    }));
  }

  return Array.from({ length: compound ? 4 : 3 }, () => ({
    set_type: "working",
    target_load_kg: 0,
    target_reps: compound ? 10 : 12,
  }));
}

export function isPendingWorkoutStale(workout: PendingWorkout): boolean {
  if (!["queued", "generating", "failed"].includes(workout.status)) {
    return false;
  }

  return (
    Date.now() - new Date(workout.updated_at).getTime() >
    STALE_PENDING_WORKOUT_MS
  );
}

export async function buildFallbackPendingWorkoutData(params: {
  focusArea: FocusArea | null;
  equipment: "bodyweight" | "dumbbells" | "barbell" | "full_gym";
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot: string | null;
}): Promise<GenerateWorkoutResponse | null> {
  const focusArea = params.focusArea ?? "full_body";
  const searchTerms = FALLBACK_SEARCHES[focusArea];
  const equipmentFilter = EQUIPMENT_FILTERS[params.equipment];
  const exercises = await fetchExercises(
    equipmentFilter.length > 0 ? { equipment: equipmentFilter } : undefined
  );

  const usedIds = new Set<string>();
  const selected = searchTerms
    .map((term) => getExerciseMatches(term, exercises, usedIds))
    .filter((exercise): exercise is Exercise => exercise !== null)
    .slice(0, 5);

  for (const exercise of selected) {
    usedIds.add(exercise.id);
  }

  if (selected.length < 3) {
    return null;
  }

  const workoutName =
    focusArea === "full_body"
      ? "Recovery Full Body"
      : `${focusArea.replace("_", " ")} Recovery`.replace(/\b\w/g, (letter) =>
          letter.toUpperCase()
        );

  return {
    workout_name: workoutName,
    generation_source: "fallback_template",
    goal_snapshot: params.goalSnapshot,
    custom_goal_snapshot: params.customGoalSnapshot,
    exercises: selected.map((exercise) => ({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      exercise_type: "weight" as const,
      rest_duration_seconds: 90,
      notes: "Fallback template generated after repeated recovery attempts.",
      sets: getSetTargets(focusArea, exercise.name),
    })),
  };
}
