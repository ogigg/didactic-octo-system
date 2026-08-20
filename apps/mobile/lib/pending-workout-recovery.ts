import { fetchExercises, type Exercise } from "@/lib/api/exercises";
import type { GenerateWorkoutResponse } from "@/lib/api/generate-workout";
import type { FocusArea, PendingWorkout } from "@/lib/api/pending-workouts";

export const STALE_PENDING_WORKOUT_MS = 5 * 60 * 1000;
export const MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS = 3;

export function buildPendingWorkoutSupportReference(
  userId: string,
  workoutId: string
): string {
  return `GEN-${userId.slice(0, 8).toUpperCase()}-${workoutId
    .slice(0, 8)
    .toUpperCase()}`;
}

export type PendingWorkoutRecoveryAction =
  | "ready"
  | "wait"
  | "retry"
  | "fallback";

export interface FallbackWorkoutCopy {
  workoutName: (focusArea: string) => string;
  muscleGroups: (focusArea: string) => string;
  trainingStrategy: string;
  notes: string;
  exerciseMuscles: (
    exerciseName: string,
    muscles: string,
    focusArea: string
  ) => string;
  exerciseSelection: string;
}

export function shouldTrackRecoveryExposure(
  previousAction: "retry" | "fallback" | undefined,
  nextAction: PendingWorkoutRecoveryAction
): nextAction is "retry" | "fallback" {
  return (
    (nextAction === "retry" || nextAction === "fallback") &&
    previousAction !== nextAction
  );
}

export function getRecoveryTiming(
  exposedAt: number,
  returnedToReadyAt: number
): { returnedToReadyAt: number; returnToReadyMs: number } {
  return {
    returnedToReadyAt,
    returnToReadyMs: Math.max(0, returnedToReadyAt - exposedAt),
  };
}

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
  exerciseName: string,
  exerciseType: "weight" | "time"
): {
  set_type: "warmup" | "working";
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
}[] {
  const lowerName = exerciseName.toLowerCase();
  const compound =
    lowerName.includes("press") ||
    lowerName.includes("squat") ||
    lowerName.includes("deadlift") ||
    lowerName.includes("row") ||
    lowerName.includes("pulldown");

  const workingCount = compound ? 4 : 3;

  if (exerciseType === "time") {
    return Array.from({ length: workingCount }, () => ({
      set_type: "working" as const,
      target_duration_seconds: 40,
    }));
  }

  const workingReps =
    focusArea === "legs" || focusArea === "lower"
      ? compound
        ? 8
        : 12
      : compound
        ? 10
        : 12;

  const working = Array.from({ length: workingCount }, () => ({
    set_type: "working" as const,
    target_load_kg: 0,
    target_reps: workingReps,
  }));

  return [
    { set_type: "warmup" as const, target_load_kg: 0, target_reps: 10 },
    ...working,
  ];
}

export function isPendingWorkoutStale(
  workout: PendingWorkout,
  now = Date.now()
): boolean {
  if (
    workout.status === "ready" &&
    (workout.workout_data === null || workout.workout_data_corrupt === true)
  ) {
    return true;
  }

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
  if (
    workout.status === "ready" &&
    workout.workout_data !== null &&
    workout.workout_data_corrupt !== true
  ) {
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
  copy: FallbackWorkoutCopy;
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

  const focusLabel = formatFocusLabel(focusArea);

  return {
    workout_name: params.copy.workoutName(focusLabel),
    reasoning: {
      muscle_groups: params.copy.muscleGroups(focusLabel),
      training_strategy: params.copy.trainingStrategy,
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
      notes: params.copy.notes,
      reasoning: {
        muscle_groups: params.copy.exerciseMuscles(
          exercise.name,
          formatMuscleList(exercise.primary_muscles),
          focusLabel
        ),
        exercise_selection: params.copy.exerciseSelection,
      },
      sets: getSetTargets(focusArea, exercise.name, exercise.exercise_type),
    })),
  };
}
