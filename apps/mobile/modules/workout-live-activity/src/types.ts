export interface LiveActivityState {
  exerciseName: string;
  /** Formatted like "60 kg × 8" or "Bodyweight × 12" */
  setDisplay: string;
  exerciseId: string;
  setId: string;
  workoutStartedAtMs: number;
  restStartedAtMs: number | null;
  restEndsAtMs: number | null;
}
