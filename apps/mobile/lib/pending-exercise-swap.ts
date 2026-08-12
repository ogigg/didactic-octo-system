import {
  countWorkingSets,
  normalizeGeneratedExerciseSets,
} from "@/lib/exercise-set-structure";
import type { ExerciseImageData } from "@/lib/exercise-media";
import type { WorkoutExerciseReasoning } from "@/stores/workout-store";

export interface PendingPreviewSet {
  set_type: "warmup" | "working";
  target_load_kg: number | null;
  target_reps: number | null;
  target_duration_seconds?: number | null;
}

export interface PendingPreviewExercise {
  exercise_id: string;
  exercise_name: string;
  exercise_type?: "weight" | "time";
  image?: ExerciseImageData | null;
  rest_duration_seconds: number;
  notes: string | null;
  reasoning?: WorkoutExerciseReasoning | null;
  sets: PendingPreviewSet[];
  progression_type?:
    | "weight_up"
    | "reps_up"
    | "maintained"
    | "new_exercise"
    | null;
  previous_display?: string | null;
}

export interface PendingSwapResult {
  id: string;
  name: string;
  image?: ExerciseImageData | null;
  exerciseType?: "weight" | "time";
}

/** Rebuild destination sets and clear history fields that belong to the old exercise. */
export function applyPendingExerciseSwap(
  current: PendingPreviewExercise,
  swap: PendingSwapResult
): PendingPreviewExercise {
  const exerciseType = swap.exerciseType ?? current.exercise_type ?? "weight";
  const workingCount = Math.max(1, countWorkingSets(current.sets));
  const workingPlaceholders = Array.from({ length: workingCount }, () => ({
    set_type: "working" as const,
    target_load_kg: null as number | null,
    target_reps: null as number | null,
    target_duration_seconds: null as number | null,
  }));

  const sets = normalizeGeneratedExerciseSets(
    exerciseType,
    workingPlaceholders
  ).map((set) => ({
    set_type: set.set_type,
    target_load_kg: set.target_load_kg ?? null,
    target_reps: set.target_reps ?? null,
    target_duration_seconds: set.target_duration_seconds ?? null,
  }));

  return {
    ...current,
    exercise_id: swap.id,
    exercise_name: swap.name,
    exercise_type: exerciseType,
    image: swap.image ?? null,
    reasoning: null,
    previous_display: null,
    progression_type: null,
    sets,
  };
}
