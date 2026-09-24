import type { WorkoutExercise } from "@/stores/workout-store";
import { toKg, type WeightUnit } from "@/lib/unit-conversion";

export interface ExerciseChartProgress {
  completed: number;
  forecast: number;
  completedSets: number;
  totalSets: number;
}

/** Forecast uses current set targets; checking a set moves its load into completed. */
export function getExerciseChartProgress(
  exercises: WorkoutExercise[],
  exerciseId: string,
  weightUnit: WeightUnit
): ExerciseChartProgress | undefined {
  const matching = exercises.filter((exercise) => exercise.id === exerciseId);
  if (!matching.some((exercise) => exercise.sets.length > 0)) return undefined;

  const progress = {
    completed: 0,
    forecast: 0,
    completedSets: 0,
    totalSets: 0,
  };
  const positiveNumber = (value: string | number | null) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  };
  for (const exercise of matching) {
    for (const set of exercise.sets) {
      const value =
        exercise.exerciseType === "time"
          ? positiveNumber(set.durationSeconds)
          : toKg(positiveNumber(set.kg), weightUnit) * positiveNumber(set.reps);
      progress.totalSets += 1;
      progress.forecast += value;
      if (set.isCompleted) {
        progress.completedSets += 1;
        progress.completed += value;
      }
    }
  }
  return progress;
}
