import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, Linking, Platform } from "react-native";

import {
  getCurrentHealthPermissionStatus,
  getHealthSyncPreference,
  isHealthSyncAvailable,
  requestHealthPermissions,
  setHealthSyncEnabled,
} from "@/lib/health";
import type { HealthPermissionStatus } from "@/lib/health";

interface HealthStatus {
  /** Current cached permission status. */
  status: HealthPermissionStatus;
  /** Whether the platform supports health integration at all. */
  available: boolean;
  /** Whether the user has enabled syncing inside Sweaty. */
  syncEnabled: boolean;
  /** True while we're reading from cache or requesting permissions. */
  loading: boolean;
  /** Request native health permissions. Updates status on completion. */
  requestPermission: () => Promise<HealthPermissionStatus>;
  /** Open the platform-specific settings where the user can grant access. */
  openSettings: () => void;
  /** Mark health sync as skipped (user tapped "Not Now"). */
  skip: () => Promise<void>;
  /** Enable sync without changing native Health authorization. */
  enable: () => Promise<void>;
  /** Disable sync without changing native Health authorization. */
  disable: () => Promise<void>;
  /** Re-read the native status (e.g. after returning from settings). */
  refresh: () => Promise<void>;
}

export function useHealthStatus(): HealthStatus {
  const { t } = useTranslation("healthSync");
  const [status, setStatus] = useState<HealthPermissionStatus>("unknown");
  const [available, setAvailable] = useState(isHealthSyncAvailable());
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // Read the app preference first so legacy `skipped` state can migrate
    // before the native authorization cache is refreshed.
    const preference = await getHealthSyncPreference();
    const current = await getCurrentHealthPermissionStatus();
    setStatus(current);
    setAvailable(current !== "unavailable");
    setSyncEnabled(preference ?? current === "granted");
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Re-check when returning from settings
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh();
      }
    });
    return () => sub.remove();
  }, [refresh]);

  const requestPermission = useCallback(async () => {
    setLoading(true);
    const result = await requestHealthPermissions();
    setStatus(result);
    setSyncEnabled(true);
    setLoading(false);
    return result;
  }, []);

  const openSettings = useCallback(() => {
    if (Platform.OS === "ios") {
      // iOS does not provide a supported deep link to an app's Health
      // permissions. App settings often contain no Health controls, so give
      // users the precise path in the Health app instead.
      Alert.alert(
        t("settings.recoveryTitle"),
        t("settings.recoveryInstructions"),
        [{ text: t("settings.recoveryDismiss") }]
      );
    } else if (Platform.OS === "android") {
      // Deep-link into Health Connect's permission screen for this app
      Linking.openURL("content://com.google.android.apps.healthdata").catch(
        () => {
          // Fallback: open app settings
          Linking.openSettings();
        }
      );
    }
  }, [t]);

  const skip = useCallback(async () => {
    await setHealthSyncEnabled(false);
    setSyncEnabled(false);
  }, []);

  const enable = useCallback(async () => {
    await setHealthSyncEnabled(true);
    setSyncEnabled(true);
  }, []);

  const disable = useCallback(async () => {
    await setHealthSyncEnabled(false);
    setSyncEnabled(false);
  }, []);

  return {
    status,
    available,
    syncEnabled,
    loading,
    requestPermission,
    openSettings,
    skip,
    enable,
    disable,
    refresh,
  };
}
