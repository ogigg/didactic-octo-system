import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";
import {
  convertPreviousDisplay,
  type ExercisePreviousSets,
} from "@/lib/workout-previous-sets";
import {
  applyPreviousSetsToWorkoutSets,
  normalizeGeneratedExerciseSets,
} from "@/lib/exercise-set-structure";
import { useProfile, type Profile } from "@/hooks/use-profile-query";
import {
  deletePendingWorkout,
  deleteAllPendingWorkouts,
  fetchPendingWorkouts,
  replacePendingWorkoutWithFallback,
  setPendingWorkoutStatus,
  triggerQueueGeneration,
  triggerRegeneration,
  updatePendingWorkoutEdits,
  GenerationLimitReachedError,
  type PendingWorkout,
  type QueueGenerationRequest,
  type WorkoutGenerationPreferences,
} from "@/lib/api/pending-workouts";
import { usePaywallStore } from "@/stores/paywall-store";
import { subscriptionKeys } from "@/lib/query-keys";
import {
  buildFallbackPendingWorkoutData,
  isPendingWorkoutStale,
  MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
} from "@/lib/pending-workout-recovery";
import { getCurrentTimezoneOffsetMinutes } from "@/lib/pending-workout-regeneration";
import { pendingWorkoutKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/track-event";
import { normalizeAnalyticsError } from "@/lib/analytics-errors";
import { markPendingWorkoutGeneratedTracked } from "@/lib/workout-queue-analytics";
import {
  usePendingWorkoutStore,
  selectNextWorkout,
  selectReadyCount,
  selectIsFullyReady,
} from "@/stores/pending-workout-store";
import {
  useWorkoutStore,
  type GenerationMeta,
  type WorkoutExercise,
  type WorkoutExerciseReasoning,
  type WorkoutSet,
} from "@/stores/workout-store";
import { fetchPreviousSetDisplays } from "@/lib/api/workouts";
import type { ExerciseImageData } from "@/lib/exercise-media";
import * as Crypto from "expo-crypto";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const REALTIME_DEBOUNCE_MS = 500;
const POLL_INTERVAL_MS = 10_000;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function applyOptimisticRegenerationState(
  queue: PendingWorkout[],
  regeneratingWorkoutIds: string[]
): PendingWorkout[] {
  if (regeneratingWorkoutIds.length === 0) {
    return queue;
  }

  return queue.map((workout) =>
    regeneratingWorkoutIds.includes(workout.id) &&
    workout.status !== "failed" &&
    workout.status !== "ready"
      ? workout
      : regeneratingWorkoutIds.includes(workout.id)
        ? { ...workout, status: "regenerating" }
        : workout
  );
}

function getGenerationPreferencesFromProfile(
  profile: Profile | undefined
): WorkoutGenerationPreferences | null {
  if (
    !profile?.training_split ||
    !profile.session_duration_minutes ||
    !profile.equipment_level ||
    !profile.training_style ||
    !profile.difficulty_level
  ) {
    return null;
  }

  return {
    training_split: profile.training_split,
    session_duration_minutes:
      profile.session_duration_minutes as WorkoutGenerationPreferences["session_duration_minutes"],
    equipment: profile.equipment_level,
    training_style: profile.training_style,
    difficulty: profile.difficulty_level,
    custom_prompt: profile.training_custom_prompt,
  };
}

function applyPreviousSetDisplays(
  sets: WorkoutSet[],
  previousSets: ExercisePreviousSets | undefined,
  fallbackDisplay: string | null
): WorkoutSet[] {
  return applyPreviousSetsToWorkoutSets(sets, previousSets, fallbackDisplay);
}

// -----------------------------------------------------------------------------
// Read-only data hook (for consumers that only need queue data)
// -----------------------------------------------------------------------------

export function useWorkoutQueueData() {
  const { user } = useAuth();
  const regeneratingWorkoutIds = usePendingWorkoutStore(
    (s) => s.regeneratingWorkoutIds
  );

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(),
    queryFn: fetchPendingWorkouts,
    enabled: !!user,
  });

  const queue = applyOptimisticRegenerationState(
    query.data ?? [],
    regeneratingWorkoutIds
  );

  return { ...query, queue };
}

// -----------------------------------------------------------------------------
// Queue Query + Realtime + Side Effects (mount once in home screen)
// -----------------------------------------------------------------------------

export function useWorkoutQueue() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const recoveryAttempts = usePendingWorkoutStore((s) => s.recoveryAttempts);
  const recordRecoveryAttempt = usePendingWorkoutStore(
    (s) => s.recordRecoveryAttempt
  );
  const clearRecoveryAttempt = usePendingWorkoutStore(
    (s) => s.clearRecoveryAttempt
  );
  const queueGenerationRequestId = usePendingWorkoutStore(
    (s) => s.queueGenerationRequestId
  );
  const queueGenerationTrigger = usePendingWorkoutStore(
    (s) => s.queueGenerationTrigger
  );
  const clearQueueGenerationContext = usePendingWorkoutStore(
    (s) => s.clearQueueGenerationContext
  );
  const regeneratingWorkoutIds = usePendingWorkoutStore(
    (s) => s.regeneratingWorkoutIds
  );

  const previousQueueRef = useRef<PendingWorkout[]>([]);
  const pendingWorkoutGeneratedKeysRef = useRef<Set<string>>(new Set());
  const trackedQueueRequestIdRef = useRef<string | null>(null);
  const recoveryInFlightRef = useRef(false);
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // ---- Query (single source of truth) ----

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(),
    queryFn: fetchPendingWorkouts,
    enabled: !!user,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || data.length === 0) return false;
      const hasPending = data.some(
        (w: PendingWorkout) =>
          w.status === "queued" ||
          w.status === "generating" ||
          w.status === "regenerating"
      );
      return hasPending ? POLL_INTERVAL_MS : false;
    },
  });

  const queue = applyOptimisticRegenerationState(
    query.data ?? [],
    regeneratingWorkoutIds
  );

  // ---- Debounced realtime invalidation ----

  const debouncedInvalidate = useCallback(() => {
    if (invalidationTimerRef.current) {
      clearTimeout(invalidationTimerRef.current);
    }
    invalidationTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
      invalidationTimerRef.current = null;
    }, REALTIME_DEBOUNCE_MS);
  }, [queryClient]);

  // ---- Realtime subscription ----

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("pending-workouts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pending_workouts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedInvalidate();
        }
      )
      .subscribe();

    return () => {
      if (invalidationTimerRef.current) {
        clearTimeout(invalidationTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [user?.id, debouncedInvalidate]);

  // ---- Analytics: track individual workout completions ----

  useEffect(() => {
    const previousQueue = previousQueueRef.current;

    // Request IDs are unique per queue rebuild. Resetting the per-request set
    // here keeps it bounded while still preventing duplicate effects for the
    // same request/workout pair.
    if (
      queueGenerationRequestId !== null &&
      trackedQueueRequestIdRef.current !== queueGenerationRequestId
    ) {
      pendingWorkoutGeneratedKeysRef.current.clear();
      trackedQueueRequestIdRef.current = queueGenerationRequestId;
    }

    for (const workout of queue) {
      const previous = previousQueue.find((item) => item.id === workout.id);
      const becameReady =
        workout.status === "ready" &&
        ((previous !== undefined &&
          previous.status !== "ready" &&
          previous.status !== "regenerating") ||
          queueGenerationTrigger !== null);

      if (
        becameReady &&
        markPendingWorkoutGeneratedTracked(
          pendingWorkoutGeneratedKeysRef.current,
          queueGenerationRequestId,
          workout.id
        )
      ) {
        trackEvent("pending_workout_generated", {
          request_id: queueGenerationRequestId,
          workout_id: workout.id,
          generation_source: workout.generation_source,
          trigger: queueGenerationTrigger ?? "unknown",
          generation_time_ms:
            workout.generated_at && workout.created_at
              ? Math.max(
                  0,
                  new Date(workout.generated_at).getTime() -
                    new Date(workout.created_at).getTime()
                )
              : null,
          queue_position: workout.queue_position,
          focus_area: workout.focus_area,
        });
      }
    }

    const queueIsTerminal =
      queue.length > 0 &&
      queue.every(
        (workout) => workout.status === "ready" || workout.status === "failed"
      );
    const previousQueueWasTerminal =
      previousQueue.length > 0 &&
      previousQueue.every(
        (workout) => workout.status === "ready" || workout.status === "failed"
      );

    // The Supabase function emits canonical queue-ready/queue-failed events.
    // Only clear the local context here so a request cannot leak into a later
    // query/effect cycle.
    if (
      queueIsTerminal &&
      queueGenerationTrigger !== null &&
      !previousQueueWasTerminal
    ) {
      clearQueueGenerationContext();
    }

    previousQueueRef.current = queue;
  }, [
    clearQueueGenerationContext,
    queue,
    queueGenerationRequestId,
    queueGenerationTrigger,
    regeneratingWorkoutIds,
  ]);

  // ---- Recovery: fix stale workouts ----

  useEffect(() => {
    const preferences = getGenerationPreferencesFromProfile(profile);

    if (
      !user ||
      !profile?.training_setup_completed ||
      !preferences ||
      queue.length === 0 ||
      recoveryInFlightRef.current
    ) {
      return;
    }

    const staleWorkouts = queue.filter(isPendingWorkoutStale);

    if (staleWorkouts.length === 0) {
      return;
    }

    recoveryInFlightRef.current = true;

    void (async () => {
      try {
        for (const workout of staleWorkouts) {
          const attemptCount = recoveryAttempts[workout.id] ?? 0;

          if (attemptCount >= MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS) {
            const fallbackWorkout = await buildFallbackPendingWorkoutData({
              focusArea: workout.focus_area,
              equipment: preferences.equipment,
              goalSnapshot: profile.goal ?? "improve_fitness",
              customGoalSnapshot: profile.custom_goal,
            });

            if (fallbackWorkout) {
              await replacePendingWorkoutWithFallback(
                workout.id,
                fallbackWorkout
              );
              clearRecoveryAttempt(workout.id);
            }

            continue;
          }

          await setPendingWorkoutStatus(workout.id, "generating");

          try {
            await triggerRegeneration(
              workout.id,
              preferences,
              getCurrentTimezoneOffsetMinutes()
            );
            clearRecoveryAttempt(workout.id);
          } catch {
            recordRecoveryAttempt(workout.id);
          }
        }

        await queryClient.invalidateQueries({
          queryKey: pendingWorkoutKeys.list(),
        });
      } finally {
        recoveryInFlightRef.current = false;
      }
    })();
  }, [
    clearRecoveryAttempt,
    profile,
    queryClient,
    queue,
    recordRecoveryAttempt,
    recoveryAttempts,
    user,
  ]);

  return { ...query, queue };
}

// -----------------------------------------------------------------------------
// Selectors (convenience hooks)
// -----------------------------------------------------------------------------

export function useNextWorkout() {
  const { queue } = useWorkoutQueueData();
  return selectNextWorkout(queue);
}

export function useReadyCount() {
  const { queue } = useWorkoutQueueData();
  return selectReadyCount(queue);
}

export function useIsFullyReady() {
  const { queue } = useWorkoutQueueData();
  return selectIsFullyReady(queue);
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export function useRegenerateWorkout() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const markWorkoutRegenerating = usePendingWorkoutStore(
    (s) => s.markWorkoutRegenerating
  );
  const clearWorkoutRegenerating = usePendingWorkoutStore(
    (s) => s.clearWorkoutRegenerating
  );
  const openPaywall = usePaywallStore((s) => s.open);
  const regenerationRequestIdsRef = useRef<Record<string, string>>({});

  return useMutation({
    mutationFn: async (input: {
      pendingWorkout: PendingWorkout;
      feedback?: string;
    }) => {
      const preferences = getGenerationPreferencesFromProfile(profile);

      if (!preferences) {
        throw new Error("Training preferences are incomplete");
      }

      try {
        await setPendingWorkoutStatus(input.pendingWorkout.id, "regenerating");
      } catch (error) {
        // The Edge Function owns canonical generation failures. This event is
        // reserved for a local preparation failure before invocation.
        trackEvent("workout_generation_client_failed", {
          request_id:
            regenerationRequestIdsRef.current[input.pendingWorkout.id],
          workout_id: input.pendingWorkout.id,
          queue_position: input.pendingWorkout.queue_position,
          ...normalizeAnalyticsError(error),
          failure_stage: "prepare_regeneration",
        });
        throw error;
      }

      try {
        return await triggerRegeneration(
          input.pendingWorkout.id,
          preferences,
          getCurrentTimezoneOffsetMinutes(),
          input.feedback,
          regenerationRequestIdsRef.current[input.pendingWorkout.id]
        );
      } catch (error) {
        // Keep a client-observed transport failure distinct from the canonical
        // server generation failure emitted by the Edge Function.
        trackEvent("workout_generation_client_failed", {
          request_id:
            regenerationRequestIdsRef.current[input.pendingWorkout.id],
          workout_id: input.pendingWorkout.id,
          queue_position: input.pendingWorkout.queue_position,
          ...normalizeAnalyticsError(error),
          failure_stage: "function_transport",
        });
        throw error;
      }
    },
    onMutate: async (input) => {
      const feedback = input.feedback?.trim();
      const pendingWorkout = input.pendingWorkout;
      const requestId = Crypto.randomUUID();
      regenerationRequestIdsRef.current[pendingWorkout.id] = requestId;

      await queryClient.cancelQueries({ queryKey: pendingWorkoutKeys.list() });

      const previousQueue = queryClient.getQueryData<PendingWorkout[]>(
        pendingWorkoutKeys.list()
      );

      queryClient.setQueryData<PendingWorkout[]>(
        pendingWorkoutKeys.list(),
        (current = []) =>
          current.map((workout) =>
            workout.id === pendingWorkout.id
              ? { ...workout, status: "regenerating" }
              : workout
          )
      );
      markWorkoutRegenerating(pendingWorkout.id);

      trackEvent("pending_workout_regenerated", {
        request_id: requestId,
        phase: "started",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
        has_feedback: !!feedback,
        feedback_length: feedback?.length ?? 0,
      });

      return { previousQueue };
    },
    onSuccess: (_data, input) => {
      const feedback = input.feedback?.trim();
      const pendingWorkout = input.pendingWorkout;
      const requestId = regenerationRequestIdsRef.current[pendingWorkout.id];

      clearWorkoutRegenerating(pendingWorkout.id);
      trackEvent("pending_workout_regenerated", {
        request_id: requestId,
        phase: "completed",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
        has_feedback: !!feedback,
        feedback_length: feedback?.length ?? 0,
      });

      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
    onError: (error, input, context) => {
      const pendingWorkout = input.pendingWorkout;
      const requestId = regenerationRequestIdsRef.current[pendingWorkout.id];
      const normalizedError = normalizeAnalyticsError(error);

      clearWorkoutRegenerating(pendingWorkout.id);

      if (context?.previousQueue) {
        queryClient.setQueryData(
          pendingWorkoutKeys.list(),
          context.previousQueue
        );
      }

      trackEvent("pending_workout_regenerated", {
        request_id: requestId,
        phase: "failed",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
        has_feedback: !!input.feedback?.trim(),
        feedback_length: input.feedback?.trim().length ?? 0,
        error_code: normalizedError.error_code,
      });
      void setPendingWorkoutStatus(pendingWorkout.id, pendingWorkout.status);

      if (error instanceof GenerationLimitReachedError) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
        openPaywall(error.used, 5);
        return;
      }

      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
    onSettled: (_data, _error, input) => {
      clearWorkoutRegenerating(input.pendingWorkout.id);
      delete regenerationRequestIdsRef.current[input.pendingWorkout.id];
    },
  });
}

export function useEditPendingWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      edits: Record<string, unknown>;
      editType: string;
    }) => {
      return updatePendingWorkoutEdits(input.id, input.edits);
    },
    onSuccess: (_data, input) => {
      trackEvent("pending_workout_edited", {
        workout_id: input.id,
        edit_type: input.editType,
      });
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
  });
}

export function useStartPendingWorkout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const { data: profile } = useProfile();
  const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";

  return useMutation({
    mutationFn: async (input: {
      pendingWorkout: PendingWorkout;
      workoutSource?: "queued_ai" | "comeback";
      exercises?: {
        exercise_id: string;
        exercise_name: string;
        exercise_type?: "weight" | "time";
        image?: ExerciseImageData;
        rest_duration_seconds: number;
        notes: string | null;
        reasoning?: WorkoutExerciseReasoning | null;
        progression_type?:
          | "weight_up"
          | "reps_up"
          | "maintained"
          | "new_exercise"
          | null;
        previous_display?: string | null;
        sets: {
          set_type: "warmup" | "working";
          target_load_kg?: number | null;
          target_reps?: number | null;
          target_duration_seconds?: number | null;
        }[];
      }[];
      wasEdited?: boolean;
      editCount?: number;
    }) => {
      if (!input.pendingWorkout.workout_data) {
        throw new Error("Workout data not available");
      }

      const workoutData = {
        ...input.pendingWorkout.workout_data,
        exercises:
          input.exercises ?? input.pendingWorkout.workout_data.exercises,
      };

      const previousSetDisplays: Record<string, ExercisePreviousSets> =
        await fetchPreviousSetDisplays(
          workoutData.exercises.map((ex) => ex.exercise_id),
          weightUnit
        ).catch(() => ({}));

      const exercises: WorkoutExercise[] = workoutData.exercises.map(
        (ex, exIndex) => {
          const exerciseType =
            (ex.exercise_type as "weight" | "time") ?? "weight";
          const fallbackPreviousDisplay = convertPreviousDisplay(
            ex.previous_display,
            weightUnit
          );
          const normalizedSets = normalizeGeneratedExerciseSets(
            exerciseType,
            ex.sets
          );
          const sets = applyPreviousSetDisplays(
            normalizedSets.map((set, setIndex) => ({
              id: `${input.pendingWorkout.id}-${exIndex}-${setIndex}`,
              type: set.set_type,
              kg:
                set.target_load_kg != null
                  ? String(
                      Math.round(
                        convertWeight(set.target_load_kg, weightUnit) * 10
                      ) / 10
                    )
                  : "",
              reps: set.target_reps != null ? String(set.target_reps) : "",
              durationSeconds:
                (set as { target_duration_seconds?: number | null })
                  .target_duration_seconds ?? null,
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            })),
            previousSetDisplays[ex.exercise_id],
            fallbackPreviousDisplay
          );

          return {
            id: ex.exercise_id,
            name: ex.exercise_name,
            image: ex.image ?? null,
            exerciseType,
            restDurationSeconds: ex.rest_duration_seconds,
            notes: ex.notes ?? "",
            reasoning: ex.reasoning ?? null,
            difficultyFeedback: null,
            progressionType: ex.progression_type ?? null,
            sets,
          };
        }
      );

      const generationMeta: GenerationMeta = {
        generationSource: workoutData.generation_source,
        goalSnapshot: workoutData.goal_snapshot,
        customGoalSnapshot: workoutData.custom_goal_snapshot,
        reasoning: workoutData.reasoning ?? null,
      };

      await deletePendingWorkout(input.pendingWorkout.id);
      startWorkout(
        workoutData.workout_name,
        exercises,
        generationMeta,
        workoutData.warmup
          ? {
              durationSeconds: workoutData.warmup.duration_seconds,
              isCompleted: false,
            }
          : null,
        {
          workoutSource: input.workoutSource ?? "queued_ai",
          workoutId: input.pendingWorkout.id,
          wasEdited: input.wasEdited ?? false,
          editCount: input.editCount ?? 0,
        }
      );

      return input;
    },
    onSuccess: () => {
      router.navigate("/workout");
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
  });
}

export function useRebuildQueue() {
  const queryClient = useQueryClient();
  const markQueueGenerationStarted = usePendingWorkoutStore(
    (s) => s.markQueueGenerationStarted
  );
  const clearQueueGenerationContext = usePendingWorkoutStore(
    (s) => s.clearQueueGenerationContext
  );
  const openPaywall = usePaywallStore((s) => s.open);

  return useMutation({
    mutationFn: async (request: QueueGenerationRequest) => {
      const requestId = Crypto.randomUUID();
      markQueueGenerationStarted(request.trigger, requestId);
      trackEvent("workout_queue_initialized", {
        request_id: requestId,
        count: request.count,
        trigger: request.trigger,
      });
      try {
        await deleteAllPendingWorkouts();
      } catch (error) {
        // The Edge Function owns canonical queue failures. This event covers
        // only local setup failures before that function is invoked.
        trackEvent("workout_queue_client_failed", {
          request_id: requestId,
          count: request.count,
          trigger: request.trigger,
          ...normalizeAnalyticsError(error),
          failure_stage: "clear_existing_queue",
        });
        throw error;
      }
      try {
        await triggerQueueGeneration({ ...request, request_id: requestId });
      } catch (error) {
        // This is intentionally a client-only event. Canonical queue failure
        // events are emitted by the Edge Function when it accepts the call.
        trackEvent("workout_queue_client_failed", {
          request_id: requestId,
          count: request.count,
          trigger: request.trigger,
          ...normalizeAnalyticsError(error),
          failure_stage: "queue_transport",
        });
        throw error;
      }
      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
    onError: (error) => {
      // Do not emit workout_queue_failed here: the Supabase function emits
      // that canonical event once it has accepted the request.
      clearQueueGenerationContext();
      if (error instanceof GenerationLimitReachedError) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
        openPaywall(error.used, 5);
      }
    },
  });
}
