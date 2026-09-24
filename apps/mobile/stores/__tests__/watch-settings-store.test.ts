import { act } from "@testing-library/react-native";

import {
  sanitizeWatchSettings,
  WATCH_SETTINGS_DEFAULTS,
  useWatchSettingsStore,
} from "../watch-settings-store";

beforeEach(() => {
  useWatchSettingsStore.getState().reset();
});

describe("watch settings store", () => {
  it("starts with the documented defaults", () => {
    const state = useWatchSettingsStore.getState();
    expect({
      schemaVersion: state.schemaVersion,
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
    }).toEqual(WATCH_SETTINGS_DEFAULTS);
  });

  it("updates each setting independently", () => {
    const state = useWatchSettingsStore.getState();
    act(() => {
      state.setRestWarningSeconds(30);
      state.setRestEndHapticsEnabled(false);
      state.setRestAdjustmentSeconds(10);
      state.setAutoShowRestTimer(false);
      state.setRestCompletionBehavior("openNextSet");
      state.setSetCompletionHapticsEnabled(false);
      state.setConfirmSkipRest(false);
      state.setConfirmEndWorkout(false);
      state.setShowHeartRate(false);
      state.setShowPreviousPerformance(false);
    });

    expect(useWatchSettingsStore.getState()).toMatchObject({
      restWarningSeconds: 30,
      restEndHapticsEnabled: false,
      restAdjustmentSeconds: 10,
      autoShowRestTimer: false,
      restCompletionBehavior: "openNextSet",
      setCompletionHapticsEnabled: false,
      confirmSkipRest: false,
      confirmEndWorkout: false,
      showHeartRate: false,
      showPreviousPerformance: false,
    });
  });

  it("recovers each missing or malformed persisted field independently", () => {
    expect(
      sanitizeWatchSettings({
        restWarningSeconds: 7 as unknown as 0 | 5 | 10 | 15 | 30,
        restEndHapticsEnabled: "yes" as unknown as boolean,
        restAdjustmentSeconds: 20 as unknown as 10 | 15 | 30,
        autoShowRestTimer: false,
        restCompletionBehavior: "invalid" as never,
        setCompletionHapticsEnabled: false,
      })
    ).toEqual({
      ...WATCH_SETTINGS_DEFAULTS,
      autoShowRestTimer: false,
      setCompletionHapticsEnabled: false,
    });
  });

  it("marks hydration complete even when the caller handles an error", () => {
    const state = useWatchSettingsStore.getState();
    expect(state.hasHydrated).toBe(true);
    act(() => state.setHasHydrated(false));
    expect(useWatchSettingsStore.getState().hasHydrated).toBe(false);
    act(() => state.setHasHydrated(true));
    expect(useWatchSettingsStore.getState().hasHydrated).toBe(true);
  });
});
