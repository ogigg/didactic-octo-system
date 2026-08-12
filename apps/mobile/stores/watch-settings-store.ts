import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";

import type {
  RestCompletionBehavior,
  WatchSettingsSnapshot,
} from "@/modules/watch-bridge/src";

export type {
  RestCompletionBehavior,
  WatchSettingsSnapshot,
} from "@/modules/watch-bridge/src";

export const WATCH_SETTINGS_STORAGE_KEY = "watch-app-settings-storage";
export const WATCH_SETTINGS_STORE_VERSION = 1;

/** Safe first-install values shared by the phone UI and the Watch decoder. */
export const WATCH_SETTINGS_DEFAULTS: Readonly<WatchSettingsSnapshot> =
  Object.freeze({
    schemaVersion: 1,
    restWarningSeconds: 10,
    restEndHapticsEnabled: true,
    restAdjustmentSeconds: 15,
    autoShowRestTimer: true,
    restCompletionBehavior: "stayOnTimer" as RestCompletionBehavior,
    setCompletionHapticsEnabled: true,
    confirmSkipRest: true,
    confirmEndWorkout: true,
    showHeartRate: true,
    showPreviousPerformance: true,
  });

export interface WatchSettingsState extends WatchSettingsSnapshot {
  hasHydrated: boolean;
  setRestWarningSeconds: (
    value: WatchSettingsSnapshot["restWarningSeconds"]
  ) => void;
  setRestEndHapticsEnabled: (value: boolean) => void;
  setRestAdjustmentSeconds: (
    value: WatchSettingsSnapshot["restAdjustmentSeconds"]
  ) => void;
  setAutoShowRestTimer: (value: boolean) => void;
  setRestCompletionBehavior: (value: RestCompletionBehavior) => void;
  setSetCompletionHapticsEnabled: (value: boolean) => void;
  setConfirmSkipRest: (value: boolean) => void;
  setConfirmEndWorkout: (value: boolean) => void;
  setShowHeartRate: (value: boolean) => void;
  setShowPreviousPerformance: (value: boolean) => void;
  setHasHydrated: (value: boolean) => void;
  reset: () => void;
}

type PersistedWatchSettings = Partial<WatchSettingsSnapshot> | null | undefined;

const REST_WARNING_VALUES: readonly WatchSettingsSnapshot["restWarningSeconds"][] =
  [0, 5, 10, 15, 30];
const REST_ADJUSTMENT_VALUES: readonly WatchSettingsSnapshot["restAdjustmentSeconds"][] =
  [10, 15, 30];

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isRestWarningSeconds(
  value: unknown
): value is WatchSettingsSnapshot["restWarningSeconds"] {
  return (
    typeof value === "number" &&
    REST_WARNING_VALUES.includes(
      value as WatchSettingsSnapshot["restWarningSeconds"]
    )
  );
}

function isRestAdjustmentSeconds(
  value: unknown
): value is WatchSettingsSnapshot["restAdjustmentSeconds"] {
  return (
    typeof value === "number" &&
    REST_ADJUSTMENT_VALUES.includes(
      value as WatchSettingsSnapshot["restAdjustmentSeconds"]
    )
  );
}

function isRestCompletionBehavior(
  value: unknown
): value is RestCompletionBehavior {
  return value === "stayOnTimer" || value === "openNextSet";
}

/**
 * Merge persisted values one field at a time. A malformed field must not
 * invalidate otherwise useful sibling preferences.
 */
export function sanitizeWatchSettings(
  persisted: PersistedWatchSettings
): WatchSettingsSnapshot {
  const value = persisted ?? {};
  return {
    schemaVersion: 1,
    restWarningSeconds: isRestWarningSeconds(value.restWarningSeconds)
      ? value.restWarningSeconds
      : WATCH_SETTINGS_DEFAULTS.restWarningSeconds,
    restEndHapticsEnabled: isBoolean(value.restEndHapticsEnabled)
      ? value.restEndHapticsEnabled
      : WATCH_SETTINGS_DEFAULTS.restEndHapticsEnabled,
    restAdjustmentSeconds: isRestAdjustmentSeconds(value.restAdjustmentSeconds)
      ? value.restAdjustmentSeconds
      : WATCH_SETTINGS_DEFAULTS.restAdjustmentSeconds,
    autoShowRestTimer: isBoolean(value.autoShowRestTimer)
      ? value.autoShowRestTimer
      : WATCH_SETTINGS_DEFAULTS.autoShowRestTimer,
    restCompletionBehavior: isRestCompletionBehavior(
      value.restCompletionBehavior
    )
      ? value.restCompletionBehavior
      : WATCH_SETTINGS_DEFAULTS.restCompletionBehavior,
    setCompletionHapticsEnabled: isBoolean(value.setCompletionHapticsEnabled)
      ? value.setCompletionHapticsEnabled
      : WATCH_SETTINGS_DEFAULTS.setCompletionHapticsEnabled,
    confirmSkipRest: isBoolean(value.confirmSkipRest)
      ? value.confirmSkipRest
      : WATCH_SETTINGS_DEFAULTS.confirmSkipRest,
    confirmEndWorkout: isBoolean(value.confirmEndWorkout)
      ? value.confirmEndWorkout
      : WATCH_SETTINGS_DEFAULTS.confirmEndWorkout,
    showHeartRate: isBoolean(value.showHeartRate)
      ? value.showHeartRate
      : WATCH_SETTINGS_DEFAULTS.showHeartRate,
    showPreviousPerformance: isBoolean(value.showPreviousPerformance)
      ? value.showPreviousPerformance
      : WATCH_SETTINGS_DEFAULTS.showPreviousPerformance,
  };
}

function persistedSettingsFromState(
  state: WatchSettingsState
): WatchSettingsSnapshot {
  return {
    schemaVersion: 1,
    restWarningSeconds: state.restWarningSeconds,
    restEndHapticsEnabled: state.restEndHapticsEnabled,
    restAdjustmentSeconds: state.restAdjustmentSeconds,
    autoShowRestTimer: state.autoShowRestTimer,
    restCompletionBehavior: state.restCompletionBehavior,
    setCompletionHapticsEnabled: state.setCompletionHapticsEnabled,
    confirmSkipRest: state.confirmSkipRest,
    confirmEndWorkout: state.confirmEndWorkout,
    showHeartRate: state.showHeartRate,
    showPreviousPerformance: state.showPreviousPerformance,
  };
}

const initialState: WatchSettingsSnapshot & { hasHydrated: boolean } = {
  ...WATCH_SETTINGS_DEFAULTS,
  hasHydrated: false,
};

export const useWatchSettingsStore = create<WatchSettingsState>()(
  subscribeWithSelector(
    persist(
      (set) => ({
        ...initialState,
        setRestWarningSeconds: (value) => set({ restWarningSeconds: value }),
        setRestEndHapticsEnabled: (value) =>
          set({ restEndHapticsEnabled: value }),
        setRestAdjustmentSeconds: (value) =>
          set({ restAdjustmentSeconds: value }),
        setAutoShowRestTimer: (value) => set({ autoShowRestTimer: value }),
        setRestCompletionBehavior: (value) =>
          set({ restCompletionBehavior: value }),
        setSetCompletionHapticsEnabled: (value) =>
          set({ setCompletionHapticsEnabled: value }),
        setConfirmSkipRest: (value) => set({ confirmSkipRest: value }),
        setConfirmEndWorkout: (value) => set({ confirmEndWorkout: value }),
        setShowHeartRate: (value) => set({ showHeartRate: value }),
        setShowPreviousPerformance: (value) =>
          set({ showPreviousPerformance: value }),
        setHasHydrated: (value) => set({ hasHydrated: value }),
        reset: () =>
          set({
            ...WATCH_SETTINGS_DEFAULTS,
            hasHydrated: true,
          }),
      }),
      {
        name: WATCH_SETTINGS_STORAGE_KEY,
        version: WATCH_SETTINGS_STORE_VERSION,
        storage: createJSONStorage(() => AsyncStorage),
        partialize: (state) => persistedSettingsFromState(state),
        migrate: (persistedState, version) =>
          (version > WATCH_SETTINGS_STORE_VERSION
            ? WATCH_SETTINGS_DEFAULTS
            : sanitizeWatchSettings(
                persistedState as PersistedWatchSettings
              )) as unknown as WatchSettingsState,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.warn(
              "[watch-settings-store] hydration failed; retaining defaults"
            );
            state?.reset();
            state?.setHasHydrated(true);
            return;
          }
          if (state) {
            const sanitized = sanitizeWatchSettings(state);
            state.restWarningSeconds = sanitized.restWarningSeconds;
            state.restEndHapticsEnabled = sanitized.restEndHapticsEnabled;
            state.restAdjustmentSeconds = sanitized.restAdjustmentSeconds;
            state.autoShowRestTimer = sanitized.autoShowRestTimer;
            state.restCompletionBehavior = sanitized.restCompletionBehavior;
            state.setCompletionHapticsEnabled =
              sanitized.setCompletionHapticsEnabled;
            state.confirmSkipRest = sanitized.confirmSkipRest;
            state.confirmEndWorkout = sanitized.confirmEndWorkout;
            state.showHeartRate = sanitized.showHeartRate;
            state.showPreviousPerformance = sanitized.showPreviousPerformance;
            state.schemaVersion = 1;
            state.setHasHydrated(true);
          }
        },
      }
    )
  )
);

/** Return only the wire fields, excluding Zustand actions and hydration state. */
export function getWatchSettingsSnapshot(): WatchSettingsSnapshot {
  return persistedSettingsFromState(useWatchSettingsStore.getState());
}
