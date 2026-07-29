import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HealthPermissionStatus } from "./types";

const STORAGE_KEY = "@health-sync/status";
const SYNC_PREFERENCE_KEY = "@health-sync/enabled";

export async function getCachedPermissionStatus(): Promise<HealthPermissionStatus> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return "unknown";
    if (
      raw === "granted" ||
      raw === "denied" ||
      raw === "not-requested" ||
      raw === "restricted" ||
      raw === "unavailable"
    ) {
      return raw;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Returns the user's app-level sync preference. `null` means they have not
 * explicitly chosen yet. The legacy `skipped` native-status value migrates to
 * a disabled preference without pretending HealthKit authorization changed.
 */
export async function getHealthSyncPreference(): Promise<boolean | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_PREFERENCE_KEY);
    if (raw === "enabled") return true;
    if (raw === "disabled") return false;

    const legacyStatus = await AsyncStorage.getItem(STORAGE_KEY);
    if (legacyStatus === "skipped") {
      await AsyncStorage.setItem(SYNC_PREFERENCE_KEY, "disabled");
      return false;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setHealthSyncEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(
      SYNC_PREFERENCE_KEY,
      enabled ? "enabled" : "disabled"
    );
  } catch {
    // Best-effort — non-fatal
  }
}

export async function isHealthSyncEnabled(): Promise<boolean> {
  const preference = await getHealthSyncPreference();
  if (preference != null) return preference;
  return (await getCachedPermissionStatus()) === "granted";
}

export async function setCachedPermissionStatus(
  status: Exclude<HealthPermissionStatus, "unknown">
): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, status);
  } catch {
    // Best-effort — non-fatal
  }
}
