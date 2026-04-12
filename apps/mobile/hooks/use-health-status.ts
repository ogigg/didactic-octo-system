import { useCallback, useEffect, useState } from "react";
import { AppState, Linking, Platform } from "react-native";

import {
  getCachedPermissionStatus,
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
  /** Re-read cached status (e.g. after returning from settings). */
  refresh: () => Promise<void>;
}

export function useHealthStatus(): HealthStatus {
  const [status, setStatus] = useState<HealthPermissionStatus>("unknown");
  const [loading, setLoading] = useState(true);
  const available = isHealthSyncAvailable();

  const refresh = useCallback(async () => {
    const cached = await getCachedPermissionStatus();
    setStatus(cached);
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
      Linking.openSettings();
    } else if (Platform.OS === "android") {
      // Deep-link into Health Connect's permission screen for this app
      Linking.openURL("content://com.google.android.apps.healthdata").catch(
        () => {
          // Fallback: open app settings
          Linking.openSettings();
        }
      );
    }
  }, []);

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
