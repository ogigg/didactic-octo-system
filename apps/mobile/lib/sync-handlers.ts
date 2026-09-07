import { mapWorkoutStoreToDb } from "@/lib/api/workout-mappers";
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
import { syncQueue } from "@/lib/sync-queue";
import { trackCompletedWorkout } from "@/lib/workout-completion-analytics";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { queryClient } from "@/lib/query-client";
import { profileKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";

interface SaveWorkoutPayload {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
  weightUnit?: WeightUnit;
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
  ownerId: string
): Promise<void> {
  await ensureActiveUser(ownerId);
  const input = payload as SaveWorkoutPayload;
  const dbPayload = mapWorkoutStoreToDb(input.summary, {
    goalSnapshot: input.goalSnapshot,
    customGoalSnapshot: input.customGoalSnapshot,
    weightUnit: input.weightUnit,
  });

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
    completed_at: new Date(input.summary.finishedAtMs).toISOString(),
  });

  // Count an initially offline workout only once its retry is persisted.
  trackCompletedWorkout(input.summary, input.goalSnapshot);
}

export function registerSyncHandlers(): void {
  syncQueue.registerHandler("upsert_profile", async (payload, ownerId) => {
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
    async (payload: unknown, ownerId: string) => {
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
