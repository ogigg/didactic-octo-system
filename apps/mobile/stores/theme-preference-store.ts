import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance, Platform } from "react-native";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type PersistOptions,
} from "zustand/middleware";

export const THEME_PREFERENCE_STORAGE_KEY = "app-theme-preference";

export const themePreferences = ["system", "light", "dark"] as const;

export type ThemePreference = (typeof themePreferences)[number];

export function isThemePreference(value: unknown): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

/**
 * Overrides the app color scheme for every `useColorScheme()` reader and the
 * native UI (alerts, pickers, keyboard). `system` hands control back to the
 * device setting. react-native-web has no override, so the web
 * `useColorScheme` reads the preference from this store instead.
 */
export function applyThemePreference(preference: ThemePreference) {
  if (Platform.OS === "web") return;
  Appearance.setColorScheme(preference === "system" ? null : preference);
}

interface ThemePreferenceState {
  preference: ThemePreference;
  /** Set once the persisted preference has been read (or failed to load). */
  hasHydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
}

interface PersistedThemePreference {
  preference: ThemePreference;
}

export const themePreferencePersistOptions: PersistOptions<
  ThemePreferenceState,
  PersistedThemePreference
> = {
  name: THEME_PREFERENCE_STORAGE_KEY,
  version: 1,
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (state) => ({ preference: state.preference }),
  // Ignore a malformed stored value instead of forcing an unknown scheme.
  merge: (persisted, current) => {
    const preference = (persisted as { preference?: unknown } | null)
      ?.preference;
    return isThemePreference(preference) ? { ...current, preference } : current;
  },
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.warn(
        "[theme-preference-store] hydration failed; following the system"
      );
    }
    try {
      applyThemePreference(state?.preference ?? "system");
    } finally {
      // The splash waits for hydration, so this must run on every path: a
      // failed read (where `state` is undefined) or a throwing native call.
      useThemePreferenceStore.setState({ hasHydrated: true });
    }
  },
};

export const useThemePreferenceStore = create<ThemePreferenceState>()(
  persist(
    (set) => ({
      preference: "system",
      hasHydrated: false,
      setPreference: (preference) => {
        applyThemePreference(preference);
        set({ preference });
      },
    }),
    themePreferencePersistOptions
  )
);
