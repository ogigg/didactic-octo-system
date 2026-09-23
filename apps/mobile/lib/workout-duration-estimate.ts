interface EstimatableExercise {
  rest_duration_seconds: number;
  sets: readonly unknown[];
}

interface EstimatableWarmup {
  duration_seconds: number;
}

/**
 * Rough session length shared by the workout preview and the home widgets:
 * 45 s per set, the first exercise's rest between sets, plus the warm-up.
 * Never negative, even for a workout without sets.
 */
export function estimateWorkoutMinutes(
  exercises: readonly EstimatableExercise[],
  warmup: EstimatableWarmup | null | undefined
): number {
  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const avgRest =
    exercises.length > 0 ? exercises[0].rest_duration_seconds : 90;
  const exerciseSeconds = totalSets * 45 + Math.max(0, totalSets - 1) * avgRest;
  return Math.max(
    0,
    Math.round((exerciseSeconds + (warmup?.duration_seconds ?? 0)) / 60)
  );
}
