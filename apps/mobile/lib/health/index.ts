import { Platform } from "react-native";

import { updateWorkoutSession } from "@/lib/api/workouts";

import {
  getCachedPermissionStatus,
  setCachedPermissionStatus,
} from "./permissions";
import { drainQueue, enqueueRetry } from "./retry-queue";
import type {
  HealthPermissionStatus,
  HealthWorkoutPayload,
  HealthWriteResult,
} from "./types";

export type {
  HealthPermissionStatus,
  HealthWorkoutPayload,
  HealthWriteResult,
} from "./types";
export { getCachedPermissionStatus, setCachedPermissionStatus };

/**
 * Returns true when a native Health integration is available for this
 * platform. Web, Expo Go, and unsupported OSes return false.
 */
export function isHealthSyncAvailable(): boolean {
  return Platform.OS === "ios" || Platform.OS === "android";
}

export async function requestHealthPermissions(): Promise<HealthPermissionStatus> {
  if (Platform.OS === "ios") {
    const { requestPermissionsIOS } = await import("./ios");
    const result = await requestPermissionsIOS();
    await setCachedPermissionStatus(result);
    return result;
  }
  if (Platform.OS === "android") {
    const { requestPermissionsAndroid } = await import("./android");
    const result = await requestPermissionsAndroid();
    await setCachedPermissionStatus(result);
    return result;
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
 * Assumes the caller has already checked `getCachedPermissionStatus()` is
 * `"granted"` — this function is a no-op otherwise.
 */
export async function syncWorkoutToHealth(
  sessionId: string,
  payload: HealthWorkoutPayload
): Promise<void> {
  if (!isHealthSyncAvailable()) return;

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
