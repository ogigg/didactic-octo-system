export interface WatchWorkoutState {
  workout: string; // JSON-encoded WatchWorkout
  currentExerciseIndex: number;
  currentSetIndex: number;
  restTimer?: string; // JSON-encoded RestTimerState
}

export interface WatchSetCompletion {
  exerciseId: string;
  setIndex: number;
  loadKg: number;
  reps: number;
  completedAt: string; // ISO date
}
