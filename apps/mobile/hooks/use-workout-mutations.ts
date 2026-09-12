import {
  type InfiniteData,
  type QueryKey,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect } from "react";

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
  updateCompletedSessionExerciseSets,
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
import { normalizeAnalyticsError } from "@/lib/analytics-errors";
import type { WeightUnit } from "@/lib/unit-conversion";
import type { WorkoutSummary } from "@/stores/workout-store";
import { useWorkoutStore } from "@/stores/workout-store";
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

type WatchHealthFailureListener = (workoutId: string) => void;
const pendingWatchHealthFailures = new Set<string>();
const watchHealthFailureListeners = new Set<WatchHealthFailureListener>();
const watchHealthFallbacksInFlight = new Set<string>();

export function notifyWatchHealthFailure(workoutId: string): void {
  pendingWatchHealthFailures.add(workoutId);
  watchHealthFailureListeners.forEach((listener) => listener(workoutId));
}

export function clearWatchHealthFailure(workoutId: string): void {
  pendingWatchHealthFailures.delete(workoutId);
}

/**
 * Retry the phone Health export after the Watch could not save its workout.
 * The session ID is persisted with the fallback, so this remains usable after
 * the summary screen has been dismissed or the app has been relaunched.
 */
export function retryPendingWatchHealthFallback(workoutId: string): void {
  const state = useWorkoutStore.getState();
  const fallback = state.healthWorkoutFallbacks[workoutId];
  if (
    state.healthWorkoutFailedIDs[workoutId] !== true ||
    !fallback?.sessionId ||
    fallback.started ||
    watchHealthFallbacksInFlight.has(workoutId)
  ) {
    return;
  }

  watchHealthFallbacksInFlight.add(workoutId);
  promptAndSyncWorkout(fallback.sessionId, {
    startedAt: new Date(fallback.startedAtMs),
    endedAt: new Date(fallback.finishedAtMs),
    type: "strength",
  })
    .then(() => {
      useWorkoutStore.getState().markHealthWorkoutFallbackStarted(workoutId);
    })
    .catch((error) => {
      console.warn("Watch Health fallback sync failed:", error);
    })
    .finally(() => {
      watchHealthFallbacksInFlight.delete(workoutId);
    });
}

function subscribeToWatchHealthFailures(
  listener: WatchHealthFailureListener
): () => void {
  watchHealthFailureListeners.add(listener);
  pendingWatchHealthFailures.forEach(listener);
  return () => watchHealthFailureListeners.delete(listener);
}

export function useSaveCompletedWorkout() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToWatchHealthFailures((workoutId) => {
      retryPendingWatchHealthFallback(workoutId);
    });
    const state = useWorkoutStore.getState();
    for (const [workoutId, fallback] of Object.entries(
      state.healthWorkoutFallbacks
    )) {
      if (fallback.sessionId) {
        retryPendingWatchHealthFallback(workoutId);
      }
    }
    return unsubscribe;
  }, []);

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
      const watchWorkoutId =
        variables.summary.watchWorkoutId ??
        `workout-${finishedAtMs - durationMs}`;
      const currentState = useWorkoutStore.getState();
      // The summary is the mutation input and can predate a late Watch
      // receipt. Prefer the persisted per-workout ledger whenever it has a
      // status so a receipt that arrived while the save was in flight cannot
      // trigger a duplicate phone-side Health export.
      const watchHealthSaved =
        currentState.healthWorkoutSavedIDs[watchWorkoutId] !== undefined;
      const watchHealthPending =
        currentState.healthWorkoutPendingIDs[watchWorkoutId] === true;
      const watchHealthFailed =
        currentState.healthWorkoutFailedIDs[watchWorkoutId] === true;
      const hasCanonicalWatchHealthStatus =
        watchHealthSaved || watchHealthPending || watchHealthFailed;
      const watchHealthIsOwned =
        variables.summary.healthWorkoutOwnedByWatch === true ||
        hasCanonicalWatchHealthStatus;
      if (watchHealthIsOwned && !watchHealthSaved) {
        currentState.recordHealthWorkoutSession(watchWorkoutId, saved.id);
        retryPendingWatchHealthFallback(watchWorkoutId);
      }
      const watchHealthIsPending =
        watchHealthPending ||
        (!hasCanonicalWatchHealthStatus &&
          variables.summary.healthWorkoutOwnedByWatch === true &&
          variables.summary.healthWorkoutSavePending === true);
      const watchHealthHasFailed =
        watchHealthFailed ||
        (!hasCanonicalWatchHealthStatus &&
          variables.summary.healthWorkoutFailed === true);
      const watchHealthWasRecorded =
        watchHealthSaved ||
        (!hasCanonicalWatchHealthStatus &&
          variables.summary.healthWorkoutRecordedOnWatch === true);
      if (
        !watchHealthWasRecorded &&
        (!watchHealthIsPending || watchHealthHasFailed) &&
        !(watchHealthIsOwned && watchHealthHasFailed)
      ) {
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
    onError: (error: unknown, variables: SaveWorkoutInput) => {
      const normalizedError = normalizeAnalyticsError(error);
      trackEvent("workout_save_failed", {
        workout_session_id: variables.summary.workoutSessionId ?? null,
        workout_source: variables.summary.workoutSource ?? null,
        workout_id: variables.summary.workoutId ?? null,
        ...normalizedError,
      });
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

export function useUpdateCompletedSessionExerciseSets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      sessionExerciseId: string;
      sets: Parameters<typeof updateCompletedSessionExerciseSets>[1];
    }) =>
      updateCompletedSessionExerciseSets(input.sessionExerciseId, input.sets),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workoutKeys.all });
      queryClient.invalidateQueries({ queryKey: exerciseDetailKeys.all });
      queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
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
