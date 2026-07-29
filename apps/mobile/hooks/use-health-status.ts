import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AppState, Linking, Platform } from "react-native";

import {
  getCurrentHealthPermissionStatus,
  isHealthSyncAvailable,
  requestHealthPermissions,
  setCachedPermissionStatus,
} from "@/lib/health";
import type { HealthPermissionStatus } from "@/lib/health";

interface HealthStatus {
  /** Current cached permission status. */
  status: HealthPermissionStatus;
  /** Whether the platform supports health integration at all. */
  available: boolean;
  /** True while we're reading from cache or requesting permissions. */
  loading: boolean;
  /** Request native health permissions. Updates status on completion. */
  requestPermission: () => Promise<HealthPermissionStatus>;
  /** Open the platform-specific settings where the user can grant access. */
  openSettings: () => void;
  /** Mark health sync as skipped (user tapped "Not Now"). */
  skip: () => Promise<void>;
  /** Re-read the native status (e.g. after returning from settings). */
  refresh: () => Promise<void>;
}

export function useHealthStatus(): HealthStatus {
  const { t } = useTranslation("healthSync");
  const [status, setStatus] = useState<HealthPermissionStatus>("unknown");
  const [available, setAvailable] = useState(isHealthSyncAvailable());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const current = await getCurrentHealthPermissionStatus();
    setStatus(current);
    setAvailable(current !== "unavailable");
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
    await setCachedPermissionStatus("skipped");
    setStatus("skipped");
  }, []);

  return {
    status,
    available,
    loading,
    requestPermission,
    openSettings,
    skip,
    refresh,
  };
}
