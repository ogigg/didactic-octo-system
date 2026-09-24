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
  /** Completed exercise sets across the whole workout. */
  completedSets: number;
  totalWorkoutSets: number;
  workoutName: string;
  workoutStartedAtMs: number;
  /** True while publishing the final state before the activity is dismissed. */
  isWorkoutComplete: boolean;
  restStartedAtMs: number | null;
  restEndsAtMs: number | null;
}

/**
 * Action emitted by a widget App Intent and parked in the shared App Group
 * UserDefaults until the main app foregrounds and drains it.
 */
export type PendingLiveActivityAction =
  | { type: "skipRest"; timestamp: number }
  | { type: "adjustRest"; deltaSeconds: number; timestamp: number };
