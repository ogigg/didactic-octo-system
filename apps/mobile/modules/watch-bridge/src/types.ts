export const WATCH_SYNC_PROTOCOL_VERSION = 1;

export type RestWarningSeconds = 0 | 5 | 10 | 15 | 30;
export type RestAdjustmentSeconds = 10 | 15 | 30;
export type RestCompletionBehavior = "stayOnTimer" | "openNextSet";

/** Versioned preferences owned by the phone and consumed by the Watch. */
export interface WatchSettingsSnapshot {
  schemaVersion: 1;
  restWarningSeconds: RestWarningSeconds;
  restEndHapticsEnabled: boolean;
  restAdjustmentSeconds: RestAdjustmentSeconds;
  autoShowRestTimer: boolean;
  restCompletionBehavior: RestCompletionBehavior;
  setCompletionHapticsEnabled: boolean;
  confirmSkipRest: boolean;
  confirmEndWorkout: boolean;
  showHeartRate: boolean;
  showPreviousPerformance: boolean;
}

export interface WatchSettingsEnvelope {
  protocolVersion: number;
  kind: "watchSettings";
  settingsRevision: number;
  sentAt: string;
  /** JSON-encoded WatchSettingsSnapshot. */
  payload: string;
}

export interface WatchSyncEnvelope {
  protocolVersion: number;
  messageId: string;
  revision: number;
  sentAt: string;
  kind: "workoutState" | "workoutEnded";
  payload: string;
  acknowledgedCommandIDs: string[];
  /** Optional additive fields ignored by older Watch builds. */
  settingsRevision?: number;
  watchSettingsPayload?: string;
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
    | "finishWorkout";
  payload: string;
}

export interface WatchActionPayload {
  workoutId?: string;
  exerciseId?: string;
  setId?: string;
  loadKg?: number;
  reps?: number;
  deltaSeconds?: number;
  restId?: string;
  completedAt?: string;
  healthWorkoutUUID?: string;
}
