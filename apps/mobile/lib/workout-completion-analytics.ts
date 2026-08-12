import { trackEvent } from "@/lib/track-event";
import {
  computeSessionStats,
  computeTotalVolume,
} from "@/lib/workout-summary-utils";
import type { WorkoutSummary } from "@/stores/workout-store";

export type GoalSnapshot =
  | "build_strength"
  | "lose_weight"
  | "improve_fitness"
  | "custom";

/** Emit the persisted-workout north-star event without free-text fields. */
export function trackCompletedWorkout(
  summary: WorkoutSummary,
  goalSnapshot: GoalSnapshot
): void {
  const stats = computeSessionStats(summary.exercises);

  trackEvent("workout_completed", {
    workout_session_id: summary.workoutSessionId ?? null,
    workout_source: summary.workoutSource ?? null,
    workout_id: summary.workoutId ?? null,
    generation_source: summary.generationSource ?? null,
    exercise_count: stats.exerciseCount,
    total_sets: stats.totalSets,
    completed_sets: stats.completedSets,
    completion_rate: stats.completionRate,
    total_volume_kg: computeTotalVolume(summary.exercises),
    duration_seconds: Math.floor(summary.durationMs / 1000),
    goal_snapshot: goalSnapshot,
    is_partial: stats.completionRate < 100,
  });
}
