export interface LiveActivityState {
  exerciseName: string;
  /** Formatted like "60 kg × 8" or "Bodyweight × 12" */
  setDisplay: string;
  /** Shown on expanded Dynamic Island, e.g. "60 kg × 12 reps" */
  proposalDisplay: string;
  exerciseId: string;
  setId: string;
  /** 1-based index of the current set within the exercise */
  currentSetNumber: number;
  totalSets: number;
  workoutName: string;
  workoutStartedAtMs: number;
  restStartedAtMs: number | null;
  restEndsAtMs: number | null;
}
