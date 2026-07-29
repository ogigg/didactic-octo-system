import AppleHealthKit, { type HealthKitPermissions } from "react-native-health";

import type {
  HealthPermissionStatus,
  HealthWorkoutPayload,
  HealthWriteResult,
  HeartRateSample,
} from "./types";

const PERMISSIONS: HealthKitPermissions = {
  permissions: {
    read: [AppleHealthKit.Constants.Permissions.HeartRate],
    write: [AppleHealthKit.Constants.Permissions.Workout],
  },
};

let initialized = false;

function classifyHealthKitError(error: unknown): HealthPermissionStatus {
  const message = String(error).toLowerCase();
  if (message.includes("restricted")) return "restricted";
  if (message.includes("not available") || message.includes("unavailable")) {
    return "unavailable";
  }
  if (message.includes("not determined")) return "not-requested";
  if (message.includes("denied")) return "denied";
  return "unknown";
}

function isAvailable(): Promise<boolean> {
  if (typeof AppleHealthKit?.isAvailable !== "function") {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    AppleHealthKit.isAvailable((_error, available) => {
      resolve(available === true);
    });
  });
}

export async function getPermissionStatusIOS(): Promise<HealthPermissionStatus> {
  if (!(await isAvailable())) return "unavailable";
  if (typeof AppleHealthKit.getAuthStatus !== "function") return "unavailable";

  return new Promise((resolve) => {
    AppleHealthKit.getAuthStatus(PERMISSIONS, (error, result) => {
      if (error) {
        resolve(classifyHealthKitError(error));
        return;
      }

      // HealthKit intentionally hides read authorization. Workout is the only
      // write permission Sweaty requests, so its status is the reliable
      // indicator for whether completed workouts can sync.
      switch (result?.permissions.write[0]) {
        case 0:
          resolve("not-requested");
          break;
        case 1:
          resolve("denied");
          break;
        case 2:
          resolve("granted");
          break;
        default:
          resolve("unknown");
      }
    });
  });
}

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

export async function requestPermissionsIOS(): Promise<HealthPermissionStatus> {
  if (!(await isAvailable())) return "unavailable";

  try {
    await initOnce();
    return getPermissionStatusIOS();
  } catch (error) {
    return classifyHealthKitError(error);
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

export async function readHeartRateSamplesIOS(
  startedAt: Date,
  endedAt: Date
): Promise<HeartRateSample[]> {
  try {
    await initOnce();
  } catch {
    return [];
  }

  return new Promise((resolve) => {
    AppleHealthKit.getHeartRateSamples(
      {
        startDate: startedAt.toISOString(),
        endDate: endedAt.toISOString(),
        unit: AppleHealthKit.Constants.Units.bpm,
        ascending: true,
      },
      (error, results) => {
        if (error || !Array.isArray(results)) {
          resolve([]);
          return;
        }
        const samples: HeartRateSample[] = [];
        for (const r of results) {
          const bpm = Number(r?.value);
          const ts = r?.startDate ? new Date(r.startDate) : null;
          if (!Number.isFinite(bpm) || bpm <= 0 || !ts || isNaN(ts.getTime())) {
            continue;
          }
          samples.push({ timestamp: ts, bpm });
        }
        resolve(samples);
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
