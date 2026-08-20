import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

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
  claimPendingWorkoutRecovery,
  replacePendingWorkoutWithFallback,
  triggerQueueGeneration,
  triggerRegeneration,
  updatePendingWorkoutEdits,
  GenerationLimitReachedError,
  type PendingWorkout,
  type QueueGenerationRequest,
  type WorkoutGenerationPreferences,
} from "@/lib/api/pending-workouts";
import { usePaywallStore } from "@/stores/paywall-store";
import { pendingWorkoutKeys, subscriptionKeys } from "@/lib/query-keys";
import {
  buildFallbackPendingWorkoutData,
  getPendingWorkoutRecoveryAction,
  getRecoveryTiming,
  MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
  shouldTrackRecoveryExposure,
} from "@/lib/pending-workout-recovery";
import { getCurrentTimezoneOffsetMinutes } from "@/lib/pending-workout-regeneration";
import { supabase } from "@/lib/supabase";
import { trackEvent } from "@/lib/track-event";
import {
  usePendingWorkoutStore,
  selectNextWorkout,
  selectReadyCount,
  selectIsFullyReady,
  isPendingWorkoutReady,
  canUsePendingWorkoutState,
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
  const hasHydrated = usePendingWorkoutStore((s) => s.hasHydrated);
  const ownerUserId = usePendingWorkoutStore((s) => s.ownerUserId);
  const regeneratingWorkoutIds = usePendingWorkoutStore(
    (s) => s.regeneratingWorkoutIds
  );

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
    queryFn: fetchPendingWorkouts,
    enabled: canUsePendingWorkoutState(user?.id, ownerUserId, hasHydrated),
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
  const queryClient = useQueryClient();

  const recoveryAttempts = usePendingWorkoutStore((s) => s.recoveryAttempts);
  const recoveryExposedAt = usePendingWorkoutStore((s) => s.recoveryExposedAt);
  const hasHydrated = usePendingWorkoutStore((s) => s.hasHydrated);
  const ownerUserId = usePendingWorkoutStore((s) => s.ownerUserId);
  const markRecoveryExposed = usePendingWorkoutStore(
    (s) => s.markRecoveryExposed
  );
  const clearRecoveryAttempt = usePendingWorkoutStore(
    (s) => s.clearRecoveryAttempt
  );
  const queueGenerationStartedAt = usePendingWorkoutStore(
    (s) => s.queueGenerationStartedAt
  );
  const queueGenerationTrigger = usePendingWorkoutStore(
    (s) => s.queueGenerationTrigger
  );
  const queueGenerationSource = usePendingWorkoutStore(
    (s) => s.queueGenerationSource
  );
  const clearQueueGenerationContext = usePendingWorkoutStore(
    (s) => s.clearQueueGenerationContext
  );
  const regeneratingWorkoutIds = usePendingWorkoutStore(
    (s) => s.regeneratingWorkoutIds
  );

  const previousQueueRef = useRef<PendingWorkout[]>([]);
  const previousRecoveryActionRef = useRef<Map<string, "retry" | "fallback">>(
    new Map()
  );
  const resolvedRecoveryIdsRef = useRef<Set<string>>(new Set());
  const invalidationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const analyticsUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (analyticsUserIdRef.current === (user?.id ?? null)) return;

    analyticsUserIdRef.current = user?.id ?? null;
    previousQueueRef.current = [];
    previousRecoveryActionRef.current.clear();
    resolvedRecoveryIdsRef.current.clear();
  }, [user?.id]);

  // ---- Query (single source of truth) ----

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
    queryFn: fetchPendingWorkouts,
    enabled: canUsePendingWorkoutState(user?.id, ownerUserId, hasHydrated),
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
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
      invalidationTimerRef.current = null;
    }, REALTIME_DEBOUNCE_MS);
  }, [queryClient, user?.id]);

  // ---- Realtime subscription ----

  useEffect(() => {
    if (!user?.id) return;

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

    for (const workout of queue) {
      const previous = previousQueue.find((item) => item.id === workout.id);
      const becameReady =
        isPendingWorkoutReady(workout) &&
        ((previous !== undefined &&
          !isPendingWorkoutReady(previous) &&
          previous.status !== "regenerating") ||
          queueGenerationTrigger !== null);

      if (becameReady) {
        trackEvent("pending_workout_generated", {
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

    const queueJustCompleted =
      queue.length > 0 &&
      queue.every(isPendingWorkoutReady) &&
      queueGenerationTrigger !== null &&
      (previousQueue.length === 0 ||
        !previousQueue.every(isPendingWorkoutReady));

    if (queueJustCompleted) {
      const fallbackCount = queue.filter(
        (workout) => workout.generation_source === "fallback_template"
      ).length;

      trackEvent("workout_queue_ready", {
        total_generation_time_ms: queueGenerationStartedAt
          ? Math.max(0, Date.now() - queueGenerationStartedAt)
          : null,
        count: queue.length,
        fallback_count: fallbackCount,
      });
      clearQueueGenerationContext();
    }

    previousQueueRef.current = queue;
  }, [
    clearQueueGenerationContext,
    queue,
    queueGenerationStartedAt,
    queueGenerationTrigger,
    regeneratingWorkoutIds,
  ]);

  // ---- Activation recovery exposure + successful resolution ----

  useEffect(() => {
    for (const workout of queue) {
      const attemptCount = recoveryAttempts[workout.id] ?? 0;
      const action = getPendingWorkoutRecoveryAction(workout, attemptCount);

      if (action === "retry" || action === "fallback") {
        const previousAction = previousRecoveryActionRef.current.get(
          workout.id
        );
        const exposedAt = markRecoveryExposed(workout.id);

        if (shouldTrackRecoveryExposure(previousAction, action)) {
          previousRecoveryActionRef.current.set(workout.id, action);
          trackEvent("activation_recovery_exposed", {
            stage: "workout_generation",
            next_action: action,
            previous_action: previousAction ?? null,
            attempt_count: attemptCount,
            queue_position: workout.queue_position,
            source: queueGenerationSource ?? "app_return",
            trigger: queueGenerationTrigger ?? "unknown",
            recovery_exposed_at: new Date(exposedAt).toISOString(),
          });
        }
      }

      if (
        isPendingWorkoutReady(workout) &&
        attemptCount > 0 &&
        !resolvedRecoveryIdsRef.current.has(workout.id)
      ) {
        resolvedRecoveryIdsRef.current.add(workout.id);
        const returnedToReadyAt = Date.now();
        const exposedAt = recoveryExposedAt[workout.id] ?? returnedToReadyAt;
        const recoveryTiming = getRecoveryTiming(exposedAt, returnedToReadyAt);
        trackEvent("activation_recovery_succeeded", {
          stage: "workout_generation",
          resolution:
            workout.generation_source === "fallback_template"
              ? "fallback"
              : "retry",
          attempt_count: attemptCount,
          time_since_queue_started_ms: queueGenerationStartedAt
            ? Math.max(0, Date.now() - queueGenerationStartedAt)
            : null,
          source: queueGenerationSource ?? "app_return",
          trigger: queueGenerationTrigger ?? "unknown",
          recovery_exposed_at: new Date(exposedAt).toISOString(),
          returned_to_ready_at: new Date(
            recoveryTiming.returnedToReadyAt
          ).toISOString(),
          return_to_ready_ms: recoveryTiming.returnToReadyMs,
          queue_position: workout.queue_position,
        });
        clearRecoveryAttempt(workout.id);
      }
    }
  }, [
    clearRecoveryAttempt,
    markRecoveryExposed,
    queue,
    queueGenerationSource,
    queueGenerationStartedAt,
    queueGenerationTrigger,
    recoveryAttempts,
    recoveryExposedAt,
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
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const markWorkoutRegenerating = usePendingWorkoutStore(
    (s) => s.markWorkoutRegenerating
  );
  const clearWorkoutRegenerating = usePendingWorkoutStore(
    (s) => s.clearWorkoutRegenerating
  );
  const openPaywall = usePaywallStore((s) => s.open);

  return useMutation({
    mutationFn: async (input: {
      pendingWorkout: PendingWorkout;
      feedback?: string;
    }) => {
      const preferences = getGenerationPreferencesFromProfile(profile);

      if (!preferences) {
        throw new Error("Training preferences are incomplete");
      }

      return triggerRegeneration(
        input.pendingWorkout.id,
        preferences,
        getCurrentTimezoneOffsetMinutes(),
        input.feedback
      );
    },
    onMutate: async (input) => {
      const feedback = input.feedback?.trim();
      const pendingWorkout = input.pendingWorkout;

      await queryClient.cancelQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });

      const previousQueue = queryClient.getQueryData<PendingWorkout[]>(
        pendingWorkoutKeys.list(user?.id ?? "")
      );

      queryClient.setQueryData<PendingWorkout[]>(
        pendingWorkoutKeys.list(user?.id ?? ""),
        (current = []) =>
          current.map((workout) =>
            workout.id === pendingWorkout.id
              ? { ...workout, status: "regenerating" }
              : workout
          )
      );
      markWorkoutRegenerating(pendingWorkout.id);

      trackEvent("pending_workout_regenerated", {
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

      clearWorkoutRegenerating(pendingWorkout.id);
      trackEvent("pending_workout_regenerated", {
        phase: "completed",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
        has_feedback: !!feedback,
        feedback_length: feedback?.length ?? 0,
      });

      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
    onError: (error, input, context) => {
      const pendingWorkout = input.pendingWorkout;

      clearWorkoutRegenerating(pendingWorkout.id);

      if (context?.previousQueue) {
        queryClient.setQueryData(
          pendingWorkoutKeys.list(user?.id ?? ""),
          context.previousQueue
        );
      }

      if (error instanceof GenerationLimitReachedError) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
        openPaywall(error.used, 5);
        return;
      }

      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
    },
    onSettled: (_data, _error, input) => {
      clearWorkoutRegenerating(input.pendingWorkout.id);
    },
  });
}

export function useRetryPendingWorkout() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pendingWorkout: PendingWorkout) => {
      const preferences = getGenerationPreferencesFromProfile(profile);
      if (!preferences) {
        throw new Error("Training preferences are incomplete");
      }

      const store = usePendingWorkoutStore.getState();
      const attemptCount = store.recoveryAttempts[pendingWorkout.id] ?? 0;
      if (attemptCount >= MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS) {
        throw new Error("Recovery retry limit reached");
      }

      const { claim, attemptCount: nextAttempt } =
        await store.recordRecoveryAttemptAfterClaim(pendingWorkout.id, () =>
          claimPendingWorkoutRecovery(pendingWorkout)
        );
      trackEvent("activation_recovery_attempted", {
        stage: "workout_generation",
        action: "retry",
        attempt_count: nextAttempt,
        queue_position: pendingWorkout.queue_position,
      });

      await triggerRegeneration(
        pendingWorkout.id,
        preferences,
        getCurrentTimezoneOffsetMinutes(),
        undefined,
        claim
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
  });
}

export function useFallbackPendingWorkout() {
  const { user } = useAuth();
  const { t } = useTranslation("home");
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pendingWorkout: PendingWorkout) => {
      if (!profile?.equipment_level) {
        throw new Error("Training preferences are incomplete");
      }

      trackEvent("activation_recovery_attempted", {
        stage: "workout_generation",
        action: "fallback",
        attempt_count:
          usePendingWorkoutStore.getState().recoveryAttempts[
            pendingWorkout.id
          ] ?? 0,
        queue_position: pendingWorkout.queue_position,
      });

      const fallbackFocus = pendingWorkout.focus_area ?? "full_body";
      const localizedFocus = t(
        `queueCard.recovery.fallbackWorkout.focusAreas.${fallbackFocus}` as never
      );
      const fallbackWorkout = await buildFallbackPendingWorkoutData({
        focusArea: pendingWorkout.focus_area,
        equipment: profile.equipment_level,
        goalSnapshot: profile.goal ?? "improve_fitness",
        customGoalSnapshot: profile.custom_goal,
        copy: {
          workoutName: () =>
            t("queueCard.recovery.fallbackWorkout.name", {
              focusArea: localizedFocus,
            }),
          muscleGroups: () =>
            t("queueCard.recovery.fallbackWorkout.muscleGroups", {
              focusArea: localizedFocus,
            }),
          trainingStrategy: t(
            "queueCard.recovery.fallbackWorkout.trainingStrategy"
          ),
          notes: t("queueCard.recovery.fallbackWorkout.notes"),
          exerciseMuscles: (exerciseName, muscles) =>
            t("queueCard.recovery.fallbackWorkout.exerciseMuscles", {
              exerciseName,
              muscles,
              focusArea: localizedFocus,
            }),
          exerciseSelection: t(
            "queueCard.recovery.fallbackWorkout.exerciseSelection"
          ),
        },
      });

      if (!fallbackWorkout) {
        throw new Error("Fallback workout is unavailable");
      }

      await replacePendingWorkoutWithFallback(
        pendingWorkout.id,
        pendingWorkout.generation_version,
        fallbackWorkout
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
    },
  });
}

export function useEditPendingWorkout() {
  const { user } = useAuth();
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
        edit_type: input.editType,
      });
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
    },
  });
}

export function useStartPendingWorkout() {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const startWorkout = useWorkoutStore((s) => s.startWorkout);
  const { data: profile } = useProfile();
  const weightUnit: WeightUnit = (profile?.weight_unit as WeightUnit) ?? "kg";

  return useMutation({
    mutationFn: async (input: {
      pendingWorkout: PendingWorkout;
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
          : null
      );

      return input;
    },
    onSuccess: ({ pendingWorkout, wasEdited = false, editCount = 0 }) => {
      trackEvent("pending_workout_started", {
        time_since_generated_ms: pendingWorkout.generated_at
          ? Math.max(
              0,
              Date.now() - new Date(pendingWorkout.generated_at).getTime()
            )
          : null,
        was_edited: wasEdited,
        edit_count: editCount,
      });

      router.navigate("/workout");
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
    },
  });
}

export function useRebuildQueue() {
  const { user } = useAuth();
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
      markQueueGenerationStarted(request.trigger);
      trackEvent("workout_queue_initialized", {
        count: request.count,
        trigger: request.trigger,
      });
      await deleteAllPendingWorkouts();
      await triggerQueueGeneration(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: pendingWorkoutKeys.list(user?.id ?? ""),
      });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
    onError: (error) => {
      clearQueueGenerationContext();
      if (error instanceof GenerationLimitReachedError) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
        openPaywall(error.used, 5);
      }
    },
  });
}
