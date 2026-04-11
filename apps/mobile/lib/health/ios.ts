import AppleHealthKit, { type HealthKitPermissions } from "react-native-health";

import type { HealthWorkoutPayload, HealthWriteResult } from "./types";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [],
    write: [AppleHealthKit.Constants.Permissions.Workout],
  },
};

let initialized = false;

function initOnce(): Promise<void> {
  if (initialized) return Promise.resolve();
  return new Promise((resolve, reject) => {
    AppleHealthKit.initHealthKit(PERMISSIONS, (error) => {
      if (error) {
        reject(new Error(error));
        return;
      }
      initialized = true;
      resolve();
    });
  });
}

export async function requestPermissionsIOS(): Promise<"granted" | "denied"> {
  try {
    await initOnce();
    // HealthKit does not expose per-type grant state for write-only. If
    // initHealthKit resolves without error, we treat it as granted — a
    // denied write will surface as an error on the first saveWorkout call
    // and be caught there.
    return "granted";
  } catch {
    return "denied";
  }
}

export async function writeWorkoutIOS(
  payload: HealthWorkoutPayload
): Promise<HealthWriteResult> {
  try {
    await initOnce();
  } catch (error) {
    return { ok: false, reason: "no-permission", error };
  }

  if (payload.type !== "strength") {
    // Only strength is mapped for now — cardio is reserved for a future phase.
    return { ok: false, reason: "unavailable" };
  }
  const activityType =
    AppleHealthKit.Constants.Activities.TraditionalStrengthTraining;

  return new Promise((resolve) => {
    AppleHealthKit.saveWorkout(
      {
        type: activityType,
        startDate: payload.startedAt.toISOString(),
        endDate: payload.endedAt.toISOString(),
      },
      (error, result) => {
        if (error) {
          resolve({ ok: false, reason: "error", error });
          return;
        }
        // result is the UUID string of the inserted HKWorkout
        resolve({ ok: true, externalId: String(result) });
      }
    );
  });
}

export async function deleteWorkoutIOS(
  _externalId: string
): Promise<HealthWriteResult> {
  // react-native-health does not expose a delete-by-UUID API for workouts.
  // Best-effort no-op — the stale HKWorkout will remain in Apple Health.
  // Flagged for a future phase.
  return { ok: false, reason: "unavailable" };
}
