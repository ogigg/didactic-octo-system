import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

export interface RestTimerProgress {
  durationSeconds: number;
  remainingSeconds: number;
  progress: number;
}

export function getRestTimerProgress(
  startedAtMs: number,
  durationSeconds: number,
  nowMs: number
): RestTimerProgress {
  const safeDurationSeconds = Math.max(1, durationSeconds);
  const elapsedSeconds = (nowMs - startedAtMs) / 1000;
  const remainingSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, safeDurationSeconds - elapsedSeconds)
  );

  return {
    durationSeconds: safeDurationSeconds,
    remainingSeconds,
    progress: remainingSeconds / safeDurationSeconds,
  };
}

export function formatRestCountdown(remainingSeconds: number): string {
  const clamped = Math.max(0, remainingSeconds);
  const minutes = Math.floor(clamped / 60);
  const seconds = Math.floor(clamped % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export type NextUp =
  | {
      kind: "set";
      exercise: WorkoutExercise;
      set: WorkoutSet;
      /** 1-based number among working sets; null for warmup sets */
      workingSetNumber: number | null;
    }
  | { kind: "exercise"; exercise: WorkoutExercise }
  | { kind: "done" };

/**
 * What the user should do once rest ends: the next incomplete set of the
 * resting exercise, otherwise the next exercise with work remaining.
 */
export function getNextUp(
  exercises: WorkoutExercise[],
  exerciseId: string
): NextUp {
  const index = exercises.findIndex((ex) => ex.id === exerciseId);
  if (index === -1) return { kind: "done" };

  const exercise = exercises[index];
  const nextSet = exercise.sets.find((set) => !set.isCompleted);
  if (nextSet) {
    const workingSetNumber =
      nextSet.type === "working"
        ? exercise.sets
            .filter((set) => set.type === "working")
            .indexOf(nextSet) + 1
        : null;
    return { kind: "set", exercise, set: nextSet, workingSetNumber };
  }

  const nextExercise = exercises
    .slice(index + 1)
    .find((ex) => ex.sets.some((set) => !set.isCompleted));
  if (nextExercise) return { kind: "exercise", exercise: nextExercise };

  return { kind: "done" };
}
