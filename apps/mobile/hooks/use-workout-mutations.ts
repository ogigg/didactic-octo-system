import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { mapWorkoutStoreToDb } from "@/lib/api/workout-mappers";
import type { SetLogInput } from "@/lib/api/workouts";
import {
  createWorkoutSession,
  updateWorkoutSession,
  upsertSessionExercises,
  upsertSessionSets,
  upsertSetLog,
} from "@/lib/api/workouts";
import { workoutKeys } from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";
import type { WorkoutSummary } from "@/stores/workout-store";

interface SaveWorkoutInput {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
}

export function useSaveCompletedWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SaveWorkoutInput) => {
      const payload = mapWorkoutStoreToDb(input.summary, {
        goalSnapshot: input.goalSnapshot,
        customGoalSnapshot: input.customGoalSnapshot,
      });

      const session = await createWorkoutSession(payload.session);

      for (const ex of payload.exercises) {
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

      return session;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
    onError: (_error: unknown, variables: SaveWorkoutInput) => {
      if (user) {
        syncQueue
          .enqueue("save_workout", user.id, variables)
          .catch(console.warn);
      }
    },
  });
}

export function useLogSet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sessionSetId: string; log: SetLogInput }) =>
      upsertSetLog(input.sessionSetId, input.log),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}

export function useUpdateWorkoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      sessionId: string;
      updates: Parameters<typeof updateWorkoutSession>[1];
    }) => updateWorkoutSession(input.sessionId, input.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
    },
  });
}
