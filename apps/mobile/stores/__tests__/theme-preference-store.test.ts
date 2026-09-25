import { act } from "@testing-library/react-native";
import { Appearance } from "react-native";

import {
  THEME_PREFERENCE_STORAGE_KEY,
  isThemePreference,
  themePreferencePersistOptions,
  useThemePreferenceStore,
} from "../theme-preference-store";

// Jest maps `zustand/middleware` to a pass-through mock, so the persist
// options are exercised directly the way zustand calls them on launch.
const { merge, partialize, onRehydrateStorage } = themePreferencePersistOptions;
const setColorScheme = jest.spyOn(Appearance, "setColorScheme");

function finishHydration(error?: unknown) {
  const state = useThemePreferenceStore.getState();
  onRehydrateStorage?.(state)?.(error ? undefined : state, error);
}

beforeEach(() => {
  useThemePreferenceStore.setState({
    preference: "system",
    hasHydrated: false,
  });
  setColorScheme.mockClear();
});

describe("theme preference store", () => {
  it("follows the system appearance by default", () => {
    expect(useThemePreferenceStore.getState().preference).toBe("system");
  });

  it("overrides the app appearance when a scheme is chosen", () => {
    act(() => useThemePreferenceStore.getState().setPreference("dark"));

    expect(useThemePreferenceStore.getState().preference).toBe("dark");
    expect(setColorScheme).toHaveBeenLastCalledWith("dark");
  });

  it("hands the appearance back to the device when set to system", () => {
    act(() => useThemePreferenceStore.getState().setPreference("light"));
    act(() => useThemePreferenceStore.getState().setPreference("system"));

    expect(setColorScheme).toHaveBeenLastCalledWith(null);
  });

  it("saves only the preference under its own storage key", () => {
    act(() => useThemePreferenceStore.getState().setPreference("dark"));

    expect(themePreferencePersistOptions.name).toBe(
      THEME_PREFERENCE_STORAGE_KEY
    );
    expect(partialize?.(useThemePreferenceStore.getState())).toEqual({
      preference: "dark",
    });
  });

  it("restores a saved preference and ignores a malformed one", () => {
    const current = useThemePreferenceStore.getState();

    expect(merge?.({ preference: "light" }, current).preference).toBe("light");
    expect(merge?.({ preference: "sepia" }, current).preference).toBe("system");
    expect(merge?.(undefined, current).preference).toBe("system");
  });

  it("applies the restored preference and marks hydration complete", () => {
    useThemePreferenceStore.setState({ preference: "light" });

    act(() => finishHydration());

    expect(setColorScheme).toHaveBeenLastCalledWith("light");
    expect(useThemePreferenceStore.getState().hasHydrated).toBe(true);
  });

  it("marks hydration complete when the saved preference can't be read", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    act(() => finishHydration(new Error("disk unavailable")));

    expect(setColorScheme).toHaveBeenLastCalledWith(null);
    expect(useThemePreferenceStore.getState().hasHydrated).toBe(true);
    warn.mockRestore();
  });

  it("marks hydration complete even if applying the scheme throws", () => {
    setColorScheme.mockImplementationOnce(() => {
      throw new Error("unsupported scheme");
    });

    expect(() => act(() => finishHydration())).toThrow("unsupported scheme");
    expect(useThemePreferenceStore.getState().hasHydrated).toBe(true);
  });

  it("recognises only the supported preferences", () => {
    expect(["system", "light", "dark"].every(isThemePreference)).toBe(true);
    expect(isThemePreference("auto")).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
