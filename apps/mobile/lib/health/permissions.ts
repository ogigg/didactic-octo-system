import AsyncStorage from "@react-native-async-storage/async-storage";

import type { HealthPermissionStatus } from "./types";

const STORAGE_KEY = "@health-sync/status";

export async function getCachedPermissionStatus(): Promise<HealthPermissionStatus> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return "unknown";
    if (
      raw === "granted" ||
      raw === "denied" ||
      raw === "not-requested" ||
      raw === "restricted" ||
      raw === "skipped" ||
      raw === "unavailable"
    ) {
      return raw;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
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
