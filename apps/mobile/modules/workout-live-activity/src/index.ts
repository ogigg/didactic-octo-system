import { Platform } from "react-native";

import type { LiveActivityState } from "./types";

export type { LiveActivityState };

// Lazy-load native module to avoid crashing on Android / web
let _native: {
  areActivitiesEnabled(): Promise<boolean>;
  startActivity(
    workoutId: string,
    state: Record<string, unknown>
  ): Promise<string | null>;
  updateActivity(state: Record<string, unknown>): Promise<void>;
  endActivity(dismissImmediately: boolean): Promise<void>;
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
