import { Platform } from "react-native";

import type { LiveActivityState, PendingLiveActivityAction } from "./types";

export type { LiveActivityState, PendingLiveActivityAction };

// Lazy-load native module to avoid crashing on Android / web
let _native: {
  areActivitiesEnabled(): Promise<boolean>;
  startActivity(
    workoutId: string,
    state: Record<string, unknown>
  ): Promise<string | null>;
  updateActivity(state: Record<string, unknown>): Promise<void>;
  endActivity(dismissImmediately: boolean): Promise<void>;
  drainPendingActions(): Promise<Array<Record<string, unknown>>>;
} | null = null;

function getNative() {
  if (!_native && Platform.OS === "ios") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { requireNativeModule } = require("expo-modules-core");
    _native = requireNativeModule("WorkoutLiveActivity");
  }
  return _native;
}

export async function areActivitiesEnabled(): Promise<boolean> {
  return (await getNative()?.areActivitiesEnabled()) ?? false;
}

export async function startActivity(
  workoutId: string,
  state: LiveActivityState
): Promise<string | null> {
  return (
    (await getNative()?.startActivity(workoutId, stateToDict(state))) ?? null
  );
}

export async function updateActivity(state: LiveActivityState): Promise<void> {
  await getNative()?.updateActivity(stateToDict(state));
}

export async function endActivity(opts?: {
  dismissImmediately?: boolean;
}): Promise<void> {
  await getNative()?.endActivity(opts?.dismissImmediately ?? false);
}

/**
 * Atomically read & clear the App-Group pending-actions queue. Each entry is
 * a normalized {@link PendingLiveActivityAction}. Returns `[]` on non-iOS
 * platforms or when the App Group is unavailable.
 */
export async function drainPendingActions(): Promise<
  PendingLiveActivityAction[]
> {
  const raw = (await getNative()?.drainPendingActions()) ?? [];
  const out: PendingLiveActivityAction[] = [];
  for (const entry of raw) {
    const action = normalizeAction(entry);
    if (action) out.push(action);
  }
  return out;
}

function normalizeAction(
  entry: Record<string, unknown>
): PendingLiveActivityAction | null {
  const type = entry.type;
  const ts = typeof entry.timestamp === "number" ? entry.timestamp : Date.now();
  if (type === "skipRest") {
    return { type, timestamp: ts };
  }
  if (type === "adjustRest") {
    const delta = entry.deltaSeconds;
    if (typeof delta !== "number" || delta === 0) return null;
    return { type, deltaSeconds: delta, timestamp: ts };
  }
  return null;
}

function stateToDict(state: LiveActivityState): Record<string, unknown> {
  const dict: Record<string, unknown> = {
    exerciseName: state.exerciseName,
    setDisplay: state.setDisplay,
    proposalDisplay: state.proposalDisplay,
    exerciseId: state.exerciseId,
    setId: state.setId,
    currentSetNumber: state.currentSetNumber,
    totalSets: state.totalSets,
    workoutName: state.workoutName,
    workoutStartedAtMs: state.workoutStartedAtMs,
  };
  if (state.restStartedAtMs !== null && state.restEndsAtMs !== null) {
    dict.restStartedAtMs = state.restStartedAtMs;
    dict.restEndsAtMs = state.restEndsAtMs;
  }
  return dict;
}
