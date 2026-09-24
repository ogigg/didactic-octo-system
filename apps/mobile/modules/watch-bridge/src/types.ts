export const WATCH_SYNC_PROTOCOL_VERSION = 1;

export interface WatchSyncEnvelope {
  protocolVersion: number;
  messageId: string;
  revision: number;
  sentAt: string;
  kind: "workoutState" | "workoutEnded";
  payload: string;
  acknowledgedCommandIDs: string[];
}

export interface WatchActionEnvelope {
  protocolVersion: number;
  commandID: string;
  baseRevision: number;
  sentAt: string;
  type:
    | "selectExercise"
    | "updateSet"
    | "completeSet"
    | "adjustRest"
    | "pauseRest"
    | "resumeRest"
    | "skipRest"
    | "healthWorkoutStarted"
    | "finishWorkout"
    | "requestState"
    | "reopenSet"
    | "healthWorkoutSaved"
    | "healthWorkoutFailed"
    | "setWarmupComplete";
  payload: string;
}

export interface WatchActionPayload {
  workoutId?: string;
  exerciseId?: string;
  setId?: string;
  loadKg?: number;
  reps?: number;
  durationSeconds?: number;
  deltaSeconds?: number;
  restId?: string;
  endDate?: string | null;
  pausedRemainingSeconds?: number | null;
  completedAt?: string;
  finishedAt?: string;
  isCompleted?: boolean;
  healthWorkoutUUID?: string;
}
