import type { WorkoutExercise } from "@/stores/workout-store";

export function hasLoggedWorkoutData(exercises: WorkoutExercise[]): boolean {
  return countLoggedWorkoutSets(exercises) > 0;
}

export function countLoggedWorkoutSets(exercises: WorkoutExercise[]): number {
  return exercises.reduce(
    (count, exercise) =>
      count +
      exercise.sets.filter(
        (set) =>
          set.isCompleted ||
          set.kg.trim().length > 0 ||
          set.reps.trim().length > 0 ||
          set.durationSeconds !== null ||
          set.rpe !== null
      ).length,
    0
  );
}
