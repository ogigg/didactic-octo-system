import {
  mapWorkoutStoreToDb,
  type WorkoutDbPayload,
} from "@/lib/api/workout-mappers";
import {
  createWorkoutSession,
  updateWorkoutSession,
  upsertSessionExercises,
  upsertSessionSets,
  upsertSetLog,
} from "@/lib/api/workouts";
import { upsertProfile } from "@/lib/api/profiles";
import type { OnboardingData } from "@/lib/api/profiles";
import { upsertMeasurement } from "@/lib/api/body-measurements";
import type { MeasurementInput } from "@/lib/api/body-measurements";
import { syncQueue, type SyncQueueItem } from "@/lib/sync-queue";

import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";

interface LegacySaveWorkoutPayload {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
  weightUnit?: WeightUnit;
}

function isWorkoutDbPayload(payload: unknown): payload is WorkoutDbPayload {
  if (!payload || typeof payload !== "object") return false;
  const candidate = payload as Partial<WorkoutDbPayload>;
  return (
    typeof candidate.session?.id === "string" &&
    typeof candidate.completedAt === "string" &&
    Array.isArray(candidate.exercises)
  );
}

function migrateLegacySaveWorkoutPayload(
  payload: unknown,
  item: SyncQueueItem
): WorkoutDbPayload {
  if (isWorkoutDbPayload(payload)) return payload;

  const legacy = payload as LegacySaveWorkoutPayload;
  const migrated = mapWorkoutStoreToDb(legacy.summary, {
    goalSnapshot: legacy.goalSnapshot,
    customGoalSnapshot: legacy.customGoalSnapshot,
    weightUnit: legacy.weightUnit,
  });

  // Freeze generated identifiers before the first recovery attempt. If a
  // partial write fails, the persisted queue item remains safe to replay.
  item.id = migrated.session.id;
  item.payload = migrated;
  return migrated;
}

async function handleSaveWorkout(
  payload: unknown,
  item: SyncQueueItem
): Promise<void> {
  const dbPayload = migrateLegacySaveWorkoutPayload(payload, item);

  const session = await createWorkoutSession(dbPayload.session);

  for (const ex of dbPayload.exercises) {
    await upsertSessionExercises(session.id, [ex.sessionExercise]);
    await upsertSessionSets(
      ex.sessionExercise.id,
      ex.sets.map((s) => s.sessionSet)
    );

    for (const set of ex.sets) {
      await upsertSetLog(set.sessionSet.id, set.log);
    }
  }

  await updateWorkoutSession(session.id, {
    status: "completed",
    completed_at: dbPayload.completedAt,
  });
}

export function registerSyncHandlers(): void {
  syncQueue.registerHandler("upsert_profile", (payload) =>
    upsertProfile(payload as OnboardingData)
  );
  syncQueue.registerHandler("save_workout", handleSaveWorkout);
  syncQueue.registerHandler("upsert_measurement", (payload: unknown) => {
    const { loggedAt, fields, originalLoggedAt } = payload as {
      loggedAt: string;
      fields: MeasurementInput;
      originalLoggedAt?: string;
    };
    return upsertMeasurement(loggedAt, fields, originalLoggedAt);
  });
}
