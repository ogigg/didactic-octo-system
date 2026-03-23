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
import { syncQueue } from "@/lib/sync-queue";

import type { WorkoutSummary } from "@/stores/workout-store";

interface SaveWorkoutPayload {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
}

async function handleSaveWorkout(payload: unknown): Promise<void> {
  const input = payload as SaveWorkoutPayload;
  const dbPayload = mapWorkoutStoreToDb(input.summary, {
    goalSnapshot: input.goalSnapshot,
    customGoalSnapshot: input.customGoalSnapshot,
  });

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
    completed_at: new Date(input.summary.finishedAtMs).toISOString(),
  });
}

export function registerSyncHandlers(): void {
  syncQueue.registerHandler("upsert_profile", (payload) =>
    upsertProfile(payload as OnboardingData)
  );
  syncQueue.registerHandler("save_workout", handleSaveWorkout);
}
