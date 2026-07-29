import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { recordComebackEvent } from "@/lib/api/streak-protection";
import { mapWorkoutStoreToDb } from "@/lib/api/workout-mappers";
import type {
  CalendarSessionRow,
  SetLogInput,
  WorkoutHistoryItem,
} from "@/lib/api/workouts";
import {
  createWorkoutSession,
  deleteSessionExercise,
  deleteWorkoutSession,
  updateExerciseDifficultyFeedback,
  updateWorkoutSession,
  upsertSessionExercises,
  upsertSessionSets,
  upsertSetLog,
} from "@/lib/api/workouts";
import { consumeComebackWorkoutMarker } from "@/lib/comeback-workout";
import {
  cancelWorkoutHealthRetry,
  deleteWorkout as deleteHealthWorkout,
} from "@/lib/health";
import { promptAndSyncWorkout } from "@/lib/health/prompt";
import {
  calendarKeys,
  exerciseDetailKeys,
  statsKeys,
  streakProtectionKeys,
  workoutKeys,
  workoutSessionCommentKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";
import { trackEvent } from "@/lib/track-event";
import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";
import {
  logWorkoutDeletionError,
  logWorkoutDeletionTrace,
} from "@/lib/workout-deletion-logger";

interface SaveWorkoutInput {
  summary: WorkoutSummary;
  goalSnapshot: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
  customGoalSnapshot?: string;
  weightUnit?: WeightUnit;
}

export interface SavedExerciseOccurrence {
  exerciseId: string;
  sessionExerciseId: string;
  orderIndex: number;
}

export interface SavedWorkoutResult {
  id: string;
  exerciseOccurrences: SavedExerciseOccurrence[];
}

interface DeleteWorkoutMutationContext {
  workoutQueries: [QueryKey, unknown][];
  calendarQueries: [QueryKey, unknown][];
}

export function useSaveCompletedWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (
      input: SaveWorkoutInput
    ): Promise<SavedWorkoutResult> => {
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

      return {
        id: session.id,
        exerciseOccurrences: payload.exercises.map((ex) => ({
          exerciseId: ex.sessionExercise.exercise_id,
          sessionExerciseId: ex.sessionExercise.id,
          orderIndex: ex.sessionExercise.order_index,
        })),
      };
    },
    onSuccess: (saved, variables) => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
      queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });

      // Mirror to Apple Health / Health Connect (write-only, best-effort).
      // Prompts the user on first run, no-ops if denied or unavailable.
      const { finishedAtMs, durationMs } = variables.summary;
      if (!variables.summary.healthWorkoutRecordedOnWatch) {
        promptAndSyncWorkout(saved.id, {
          startedAt: new Date(finishedAtMs - durationMs),
          endedAt: new Date(finishedAtMs),
          type: "strength",
        }).catch((error) => {
          // Never surfaces to user — Health sync is best-effort.
          console.warn("Health sync failed:", error);
        });
      }

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
        const stableWorkoutId = `${user.id}-${
          variables.summary.finishedAtMs - variables.summary.durationMs
        }`;
        syncQueue
          .enqueue("save_workout", stableWorkoutId, variables)
          .catch(console.warn);
      }
    },
  });
}

export function useUpdateExerciseDifficultyFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    // Preserve tap order when the user changes their rating quickly so the
    // last selection is also the final value persisted in the database.
    scope: { id: "exercise-difficulty-feedback" },
    mutationFn: (input: {
      sessionExerciseId: string;
      feedback: "too_easy" | "ok" | "too_hard";
    }) =>
      updateExerciseDifficultyFeedback(input.sessionExerciseId, input.feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: exerciseDetailKeys.all });
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

export function useDeleteSessionExercise() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSessionExercise,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: exerciseDetailKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
      queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });
    },
  });
}

export function useDeleteWorkoutSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      logWorkoutDeletionTrace("mutation:start", { sessionId });
      const deleted = await deleteWorkoutSession(sessionId);

      logWorkoutDeletionTrace("database:deleted", {
        sessionId,
        hasHealthRecord: deleted.health_record_id !== null,
      });

      await cancelWorkoutHealthRetry(sessionId);
      logWorkoutDeletionTrace("health-retry:cancelled", { sessionId });

      if (deleted.health_record_id) {
        try {
          const result = await deleteHealthWorkout(deleted.health_record_id);
          logWorkoutDeletionTrace("health-record:delete-result", {
            sessionId,
            healthResult: result.ok ? "deleted" : result.reason,
          });
        } catch (error) {
          // Platform health cleanup is best-effort and must not resurrect or
          // block deletion of the app's canonical workout record.
          logWorkoutDeletionError("health-record:error", error, {
            sessionId,
          });
        }
      }

      logWorkoutDeletionTrace("mutation:success", { sessionId });
      return deleted;
    },
    onMutate: async (sessionId): Promise<DeleteWorkoutMutationContext> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: workoutKeys.all }),
        queryClient.cancelQueries({ queryKey: calendarKeys.all }),
      ]);

      const context = {
        workoutQueries: queryClient.getQueriesData({
          queryKey: workoutKeys.all,
        }),
        calendarQueries: queryClient.getQueriesData({
          queryKey: calendarKeys.all,
        }),
      };

      logWorkoutDeletionTrace("cache:optimistic-remove", {
        sessionId,
        workoutQueryCount: context.workoutQueries.length,
        calendarQueryCount: context.calendarQueries.length,
      });

      queryClient.setQueriesData<
        InfiniteData<WorkoutHistoryItem[]> | undefined
      >({ queryKey: [...workoutKeys.all, "list"] }, (history) =>
        history
          ? {
              ...history,
              pages: history.pages.map((page) =>
                page.filter((workout) => workout.id !== sessionId)
              ),
            }
          : history
      );

      queryClient.setQueriesData<WorkoutHistoryItem[] | undefined>(
        { queryKey: [...workoutKeys.all, "forDay"] },
        (workouts) =>
          workouts?.filter((workout) => workout.id !== sessionId) ?? workouts
      );

      queryClient.setQueriesData<CalendarSessionRow[] | undefined>(
        { queryKey: calendarKeys.all },
        (entries) =>
          entries?.filter((entry) => entry.id !== sessionId) ?? entries
      );

      return context;
    },
    onError: (error, sessionId, context) => {
      context?.workoutQueries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      context?.calendarQueries.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      logWorkoutDeletionError("cache:rollback", error, { sessionId });
    },
    onSuccess: (_deleted, sessionId) => {
      queryClient.removeQueries({
        queryKey: [...workoutKeys.all, "detail"],
        predicate: (query) =>
          query.queryKey[query.queryKey.length - 1] === sessionId,
      });
    },
    onSettled: (_data, _error, sessionId) => {
      logWorkoutDeletionTrace("cache:invalidate", { sessionId });
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: exerciseDetailKeys.all });
      queryClient.invalidateQueries({ queryKey: calendarKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
      queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });
      queryClient.invalidateQueries({
        queryKey: workoutSessionCommentKeys.all,
      });
    },
  });
}
