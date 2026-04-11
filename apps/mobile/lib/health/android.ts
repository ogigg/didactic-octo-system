import {
  ExerciseType,
  deleteRecordsByUuids,
  getSdkStatus,
  initialize,
  insertRecords,
  requestPermission,
} from "react-native-health-connect";

import type { HealthWorkoutPayload, HealthWriteResult } from "./types";

const SDK_AVAILABLE = 3; // SdkAvailabilityStatus.SDK_AVAILABLE

const WRITE_PERMISSIONS = [
  { accessType: "write" as const, recordType: "ExerciseSession" as const },
];

let initPromise: Promise<boolean> | null = null;

async function ensureInitialized(): Promise<boolean> {
  if (!initPromise) {
    initPromise = (async () => {
      const status = await getSdkStatus();
      if (status !== SDK_AVAILABLE) return false;
      return initialize();
    })();
  }
  return initPromise;
}

export async function requestPermissionsAndroid(): Promise<
  "granted" | "denied" | "unavailable"
> {
  const ready = await ensureInitialized();
  if (!ready) return "unavailable";

  try {
    const granted = await requestPermission(WRITE_PERMISSIONS);
    const hasWrite = granted.some(
      (p) =>
        "recordType" in p &&
        p.recordType === "ExerciseSession" &&
        p.accessType === "write"
    );
    return hasWrite ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

export async function writeWorkoutAndroid(
  payload: HealthWorkoutPayload
): Promise<HealthWriteResult> {
  const ready = await ensureInitialized();
  if (!ready) return { ok: false, reason: "unavailable" };

  if (payload.type !== "strength") {
    // Only strength is mapped for now — cardio is reserved for a future phase.
    return { ok: false, reason: "unavailable" };
  }
  const exerciseType = ExerciseType.STRENGTH_TRAINING;

  try {
    const ids = await insertRecords([
      {
        recordType: "ExerciseSession",
        startTime: payload.startedAt.toISOString(),
        endTime: payload.endedAt.toISOString(),
        exerciseType,
      },
    ]);
    const externalId = ids[0];
    if (!externalId) {
      return { ok: false, reason: "error" };
    }
    return { ok: true, externalId };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}

export async function deleteWorkoutAndroid(
  externalId: string
): Promise<HealthWriteResult> {
  const ready = await ensureInitialized();
  if (!ready) return { ok: false, reason: "unavailable" };

  try {
    await deleteRecordsByUuids("ExerciseSession", [externalId], []);
    return { ok: true, externalId };
  } catch (error) {
    return { ok: false, reason: "error", error };
  }
}
