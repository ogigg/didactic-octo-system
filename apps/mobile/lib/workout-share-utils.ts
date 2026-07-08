import type { WorkoutExercise } from "@/stores/workout-store";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { getBestDurationSeconds, getTopSet } from "@/lib/workout-summary-utils";

export const WORKOUT_SHARE_HIGHLIGHT_LIMIT = 3;

export interface WorkoutShareHighlight {
  id: string;
  name: string;
  completedSets: number;
  totalSets: number;
  metric: string | null;
}

interface GetWorkoutShareHighlightsOptions {
  formatWeight: (kg: number) => string;
  getExerciseName?: (exercise: WorkoutExercise) => string;
  limit?: number;
}

export function getWorkoutShareHighlights(
  exercises: WorkoutExercise[],
  {
    formatWeight,
    getExerciseName,
    limit = WORKOUT_SHARE_HIGHLIGHT_LIMIT,
  }: GetWorkoutShareHighlightsOptions
): WorkoutShareHighlight[] {
  const highlights: WorkoutShareHighlight[] = [];

  for (const exercise of exercises) {
    const completedSets = exercise.sets.filter((set) => set.isCompleted).length;
    if (completedSets === 0) continue;

    let metric: string | null = null;
    if (exercise.exerciseType === "time") {
      const bestDuration = getBestDurationSeconds(exercise.sets);
      metric =
        bestDuration != null ? formatExerciseDuration(bestDuration) : null;
    } else {
      const topSet = getTopSet(exercise.sets);
      metric = topSet ? `${formatWeight(topSet.kg)} x ${topSet.reps}` : null;
    }

    highlights.push({
      id: exercise.id,
      name: getExerciseName?.(exercise) ?? exercise.name,
      completedSets,
      totalSets: exercise.sets.length,
      metric,
    });

    if (highlights.length >= limit) break;
  }

  return highlights;
}
