import { fetchExercises, type Exercise } from "@/lib/api/exercises";
import type { GenerateWorkoutResponse } from "@/lib/api/generate-workout";
import type { FocusArea, PendingWorkout } from "@/lib/api/pending-workouts";

export const STALE_PENDING_WORKOUT_MS = 5 * 60 * 1000;
export const MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS = 3;

export type PendingWorkoutRecoveryAction =
  | "ready"
  | "wait"
  | "retry"
  | "fallback";

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

function formatFocusLabel(value: FocusArea): string {
  return value
    .replace("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatMuscleList(muscles: string[]): string {
  return muscles.map((muscle) => muscle.replace(/_/g, " ")).join(", ");
}

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

export function isPendingWorkoutStale(
  workout: PendingWorkout,
  now = Date.now()
): boolean {
  if (workout.status === "failed") {
    return true;
  }

  if (!["queued", "generating", "regenerating"].includes(workout.status)) {
    return false;
  }

  return (
    now - new Date(workout.updated_at).getTime() > STALE_PENDING_WORKOUT_MS
  );
}

export function getPendingWorkoutRecoveryAction(
  workout: PendingWorkout,
  attemptCount: number,
  now = Date.now()
): PendingWorkoutRecoveryAction {
  if (workout.status === "ready") {
    return "ready";
  }

  if (!isPendingWorkoutStale(workout, now)) {
    return "wait";
  }

  return attemptCount >= MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS
    ? "fallback"
    : "retry";
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
    reasoning: {
      muscle_groups: `This recovery plan keeps attention on ${formatFocusLabel(focusArea)} so the weekly queue can stay usable.`,
      training_strategy:
        "It uses familiar movements with conservative targets after repeated generation recovery attempts.",
    },
    warmup: { duration_seconds: 300 },
    generation_source: "fallback_template",
    goal_snapshot: params.goalSnapshot,
    custom_goal_snapshot: params.customGoalSnapshot,
    exercises: selected.map((exercise) => ({
      exercise_id: exercise.id,
      exercise_name: exercise.name,
      exercise_type: exercise.exercise_type,
      image: exercise.image,
      rest_duration_seconds: 90,
      notes: "Fallback template generated after repeated recovery attempts.",
      reasoning: {
        muscle_groups: `${exercise.name} targets ${formatMuscleList(exercise.primary_muscles)} for this ${focusArea.replace("_", " ")} session.`,
        exercise_selection:
          "It was selected from the available exercise catalog as a dependable fallback option.",
      },
      sets: getSetTargets(focusArea, exercise.name),
    })),
  };
}
