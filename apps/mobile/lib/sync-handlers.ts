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
import { trackCompletedWorkout } from "@/lib/workout-completion-analytics";
import { invalidateAfterWorkoutSave } from "@/lib/workout-save-invalidation";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { queryClient } from "@/lib/query-client";
import { profileKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";

type GoalSnapshot =
  | "build_strength"
  | "build_muscle"
  | "lose_weight"
  | "improve_fitness"
  | "custom";

interface LegacySaveWorkoutPayload {
  summary: WorkoutSummary;
  goalSnapshot: GoalSnapshot;
  customGoalSnapshot?: string;
  weightUnit?: WeightUnit;
}

/**
 * Queued workout write with stable IDs frozen before the first attempt. The
 * summary and goal travel along so completion analytics can still be sent
 * once an initially failed save is replayed.
 */
export type QueuedSaveWorkoutPayload = WorkoutDbPayload & {
  summary?: WorkoutSummary;
  goalSnapshot?: GoalSnapshot;
};

function isWorkoutDbPayload(
  payload: unknown
): payload is QueuedSaveWorkoutPayload {
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
): QueuedSaveWorkoutPayload {
  if (isWorkoutDbPayload(payload)) return payload;

  const legacy = payload as LegacySaveWorkoutPayload;
  const migrated: QueuedSaveWorkoutPayload = {
    ...mapWorkoutStoreToDb(legacy.summary, {
      goalSnapshot: legacy.goalSnapshot,
      customGoalSnapshot: legacy.customGoalSnapshot,
      weightUnit: legacy.weightUnit,
    }),
    summary: legacy.summary,
    goalSnapshot: legacy.goalSnapshot,
  };

  // Freeze generated identifiers before the first recovery attempt. If a
  // partial write fails, the persisted queue item remains safe to replay.
  item.id = migrated.session.id;
  item.payload = migrated;
  return migrated;
}

function requireOwner(item: SyncQueueItem): string {
  if (!item.ownerId) {
    throw new Error("Queued write has no owning account");
  }
  return item.ownerId;
}

async function ensureActiveUser(ownerId: string): Promise<void> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user || user.id !== ownerId) {
    throw new Error("Queued write belongs to a different account");
  }
}

async function handleSaveWorkout(
  payload: unknown,
  item: SyncQueueItem
): Promise<void> {
  const ownerId = requireOwner(item);
  await ensureActiveUser(ownerId);
  const dbPayload = migrateLegacySaveWorkoutPayload(payload, item);

  const session = await createWorkoutSession(dbPayload.session, ownerId);

  for (const ex of dbPayload.exercises) {
    await ensureActiveUser(ownerId);
    await upsertSessionExercises(session.id, [ex.sessionExercise]);
    await ensureActiveUser(ownerId);
    await upsertSessionSets(
      ex.sessionExercise.id,
      ex.sets.map((s) => s.sessionSet)
    );

    for (const set of ex.sets) {
      await ensureActiveUser(ownerId);
      await upsertSetLog(set.sessionSet.id, set.log);
    }
  }

  await ensureActiveUser(ownerId);
  await updateWorkoutSession(session.id, {
    status: "completed",
    completed_at: dbPayload.completedAt,
  });

  // Count an initially offline workout only once its retry is persisted.
  if (dbPayload.summary && dbPayload.goalSnapshot) {
    trackCompletedWorkout(dbPayload.summary, dbPayload.goalSnapshot);
  }
  invalidateAfterWorkoutSave(queryClient);
}

export function registerSyncHandlers(): void {
  syncQueue.registerHandler("upsert_profile", async (payload, item) => {
    const ownerId = requireOwner(item);
    await ensureActiveUser(ownerId);
    await upsertProfile(payload as OnboardingData, ownerId);
    if (useOnboardingStore.getState().ownerUserId === ownerId) {
      useOnboardingStore.getState().complete();
    }
    await queryClient.invalidateQueries({
      queryKey: profileKeys.detail(ownerId),
    });
  });
  syncQueue.registerHandler("save_workout", handleSaveWorkout);
  syncQueue.registerHandler(
    "upsert_measurement",
    async (payload: unknown, item: SyncQueueItem) => {
      const ownerId = requireOwner(item);
      await ensureActiveUser(ownerId);
      const { loggedAt, fields, originalLoggedAt } = payload as {
        loggedAt: string;
        fields: MeasurementInput;
        originalLoggedAt?: string;
      };
      return upsertMeasurement(loggedAt, fields, originalLoggedAt, ownerId);
    }
  );
}
