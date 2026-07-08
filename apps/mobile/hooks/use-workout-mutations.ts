import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { recordComebackEvent } from "@/lib/api/streak-protection";
import { mapWorkoutStoreToDb } from "@/lib/api/workout-mappers";
import type { SetLogInput } from "@/lib/api/workouts";
import {
  createWorkoutSession,
  updateWorkoutSession,
  upsertSessionExercises,
  upsertSessionSets,
  upsertSetLog,
} from "@/lib/api/workouts";
import { consumeComebackWorkoutMarker } from "@/lib/comeback-workout";
import { promptAndSyncWorkout } from "@/lib/health/prompt";
import {
  calendarKeys,
  statsKeys,
  streakProtectionKeys,
  workoutKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";
import { trackEvent } from "@/lib/track-event";
import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";

interface SaveWorkoutInput {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
  weightUnit?: WeightUnit;
}

export function useSaveCompletedWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: SaveWorkoutInput) => {
      const payload = mapWorkoutStoreToDb(input.summary, {
        goalSnapshot: input.goalSnapshot,
        customGoalSnapshot: input.customGoalSnapshot,
        weightUnit: input.weightUnit,
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
    onSuccess: (session, variables) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
      queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });

      // Mirror to Apple Health / Health Connect (write-only, best-effort).
      // Prompts the user on first run, no-ops if denied or unavailable.
      const { finishedAtMs, durationMs } = variables.summary;
      promptAndSyncWorkout(session.id, {
        startedAt: new Date(finishedAtMs - durationMs),
        endedAt: new Date(finishedAtMs),
        type: "strength",
      }).catch((error) => {
        // Never surfaces to user — Health sync is best-effort.
        console.warn("Health sync failed:", error);
      });

      consumeComebackWorkoutMarker()
        .then((marker) => {
          if (!marker) return;

          const comebackPayload = {
            prompt_state: marker.promptState,
            had_ready_workout: marker.hadReadyWorkout,
            time_since_comeback_started_ms: Math.max(
              0,
              Date.now() - marker.startedAtMs
            ),
            duration_seconds: Math.round(durationMs / 1000),
          };

          trackEvent("comeback_workout_completed", comebackPayload);
          return recordComebackEvent("comeback_completed", comebackPayload);
        })
        .catch((error) => {
          console.warn("Comeback completion tracking failed:", error);
        });
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
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });
    },
  });
}
