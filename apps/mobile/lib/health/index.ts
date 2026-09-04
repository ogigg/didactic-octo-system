import { Platform } from "react-native";

import { updateWorkoutSession } from "@/lib/api/workouts";

import {
  getCachedPermissionStatus,
  getHealthSyncPreference,
  isHealthSyncEnabled,
  setCachedPermissionStatus,
  setHealthSyncEnabled,
} from "./permissions";
import { drainQueue, enqueueRetry } from "./retry-queue";
import type {
  HealthPermissionStatus,
  HealthWorkoutPayload,
  HealthWriteResult,
  HeartRateSample,
} from "./types";

export type {
  HealthPermissionStatus,
  HealthWorkoutPayload,
  HealthWriteResult,
  HeartRateSample,
} from "./types";
export {
  getCachedPermissionStatus,
  getHealthSyncPreference,
  isHealthSyncEnabled,
  setCachedPermissionStatus,
  setHealthSyncEnabled,
};
export { cancelRetry as cancelWorkoutHealthRetry } from "./retry-queue";

/**
 * Returns true when this OS has a native Health integration. Device-level
 * support (for example, HealthKit on iPhone versus iPad) is checked
 * asynchronously by `getCurrentHealthPermissionStatus`.
 */
export function isHealthSyncAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function requestHealthPermissions(): Promise<HealthPermissionStatus> {
  if (Platform.OS === "ios") {
    const { requestPermissionsIOS } = await import("./ios");
    const result = await requestPermissionsIOS();
    if (result !== "unknown") await setCachedPermissionStatus(result);
    await setHealthSyncEnabled(true);
    return result;
  }
  if (Platform.OS === "android") {
    const { requestPermissionsAndroid } = await import("./android");
    const result = await requestPermissionsAndroid();
    await setCachedPermissionStatus(result);
    await setHealthSyncEnabled(true);
    return result;
  }
  await setCachedPermissionStatus("unavailable");
  return "unavailable";
}

/**
 * Reads the platform's current authorization state. On iOS this queries
 * HealthKit directly so permission changes made outside the app are reflected.
 */
export async function getCurrentHealthPermissionStatus(): Promise<HealthPermissionStatus> {
  if (Platform.OS === "ios") {
    const { getPermissionStatusIOS } = await import("./ios");
    const result = await getPermissionStatusIOS();
    if (result !== "unknown") await setCachedPermissionStatus(result);
    return result;
  }

  if (Platform.OS === "android") {
    return getCachedPermissionStatus();
  }

  await setCachedPermissionStatus("unavailable");
  return "unavailable";
}

export async function writeWorkout(
  payload: HealthWorkoutPayload
): Promise<HealthWriteResult> {
  if (Platform.OS === "ios") {
    const { writeWorkoutIOS } = await import("./ios");
    return writeWorkoutIOS(payload);
  }
  if (Platform.OS === "android") {
    const { writeWorkoutAndroid } = await import("./android");
    return writeWorkoutAndroid(payload);
  }
  return { ok: false, reason: "unavailable" };
}

/**
 * Read heart rate samples recorded in the platform health store within the
 * given window. iOS-only for now — Android returns an empty array. Never
 * throws; returns `[]` on permission errors or missing data.
 */
export async function readHeartRateSamples(
  startedAt: Date,
  endedAt: Date
): Promise<HeartRateSample[]> {
  if (Platform.OS === "ios") {
    const { readHeartRateSamplesIOS } = await import("./ios");
    return readHeartRateSamplesIOS(startedAt, endedAt);
  }
  return [];
}

export async function deleteWorkout(
  externalId: string
): Promise<HealthWriteResult> {
  if (Platform.OS === "ios") {
    const { deleteWorkoutIOS } = await import("./ios");
    return deleteWorkoutIOS(externalId);
  }
  if (Platform.OS === "android") {
    const { deleteWorkoutAndroid } = await import("./android");
    return deleteWorkoutAndroid(externalId);
  }
  return { ok: false, reason: "unavailable" };
}

/**
 * Best-effort: mirror a completed workout session to the platform Health
 * store. Never throws. On success, patches the row with the external record
 * ID. On failure, enqueues for a one-shot foreground retry.
 *
 * Requires both the user's app-level sync preference and native authorization
 * to be enabled. This function is a no-op otherwise.
 */
export async function syncWorkoutToHealth(
  sessionId: string,
  payload: HealthWorkoutPayload
): Promise<void> {
  if (!isHealthSyncAvailable()) return;

  if (!(await isHealthSyncEnabled())) return;

  const status = await getCachedPermissionStatus();
  if (status !== "granted") return;

  const result = await writeWorkout(payload);
  if (!result.ok) {
    if (result.reason === "error") {
      // Transient — queue for retry on next foreground.
      await enqueueRetry(sessionId, payload);
    }
    return;
  }

  try {
    await updateWorkoutSession(sessionId, {
      health_record_id: result.externalId,
    });
  } catch {
    // Row patch failed — the HKWorkout / ExerciseSession is still written.
    // We won't retry the patch; the next delete/update flow will just skip it.
  }
}

/**
 * Drain the retry queue once (call from AppState active transition).
 * Best-effort — failed entries are dropped (not re-queued) so we never loop.
 */
export async function flushHealthRetryQueue(): Promise<void> {
  if (!isHealthSyncAvailable()) return;
  if (!(await isHealthSyncEnabled())) return;

  const status = await getCachedPermissionStatus();
  if (status !== "granted") return;

  const pending = await drainQueue();
  for (const entry of pending) {
    const result = await writeWorkout(entry.payload);
    if (result.ok) {
      try {
        await updateWorkoutSession(entry.sessionId, {
          health_record_id: result.externalId,
        });
      } catch {
        // Ignore — workout is written to Health, row patch is best-effort.
      }
    }
  }
}
