import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";
import { convertPreviousDisplay } from "@/lib/workout-previous-sets";
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
  type WorkoutSet,
} from "@/stores/workout-store";
import { fetchPreviousSetDisplays } from "@/lib/api/workouts";
import type { PreviousSetValue } from "@/lib/workout-previous-sets";
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
  previousSets: PreviousSetValue[] | undefined,
  fallbackDisplay: string | null
): WorkoutSet[] {
  let workingIndex = 0;

  return sets.map((set) => {
    if (set.type !== "working") {
      return { ...set, previousDisplay: null };
    }

    const previousDisplay =
      previousSets?.[workingIndex]?.display ?? fallbackDisplay;
    workingIndex += 1;

    return {
      ...set,
      previousDisplay,
    };
  });
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
  const queueGenerationStartedAt = usePendingWorkoutStore(
    (s) => s.queueGenerationStartedAt
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

    for (const workout of queue) {
      const previous = previousQueue.find((item) => item.id === workout.id);
      const becameReady =
        workout.status === "ready" &&
        ((previous !== undefined &&
          previous.status !== "ready" &&
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
      queue.every((workout) => workout.status === "ready") &&
      queueGenerationTrigger !== null &&
      (previousQueue.length === 0 ||
        !previousQueue.every((workout) => workout.status === "ready"));

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

  return useMutation({
    mutationFn: async (pendingWorkout: PendingWorkout) => {
      const preferences = getGenerationPreferencesFromProfile(profile);

      if (!preferences) {
        throw new Error("Training preferences are incomplete");
      }

      await setPendingWorkoutStatus(pendingWorkout.id, "regenerating");

      return triggerRegeneration(
        pendingWorkout.id,
        preferences,
        getCurrentTimezoneOffsetMinutes()
      );
    },
    onMutate: async (pendingWorkout) => {
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
        phase: "started",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
      });

      return { previousQueue };
    },
    onSuccess: (_data, pendingWorkout) => {
      clearWorkoutRegenerating(pendingWorkout.id);
      trackEvent("pending_workout_regenerated", {
        phase: "completed",
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
      });

      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
      queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
    },
    onError: (error, pendingWorkout, context) => {
      clearWorkoutRegenerating(pendingWorkout.id);

      if (context?.previousQueue) {
        queryClient.setQueryData(
          pendingWorkoutKeys.list(),
          context.previousQueue
        );
      }

      void setPendingWorkoutStatus(pendingWorkout.id, pendingWorkout.status);

      if (error instanceof GenerationLimitReachedError) {
        queryClient.invalidateQueries({ queryKey: subscriptionKeys.usage() });
        openPaywall(error.used, 5);
        return;
      }

      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
    onSettled: (_data, _error, pendingWorkout) => {
      clearWorkoutRegenerating(pendingWorkout.id);
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
      exercises?: {
        exercise_id: string;
        exercise_name: string;
        exercise_type?: "weight" | "time";
        image?: ExerciseImageData;
        rest_duration_seconds: number;
        notes: string | null;
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

      const previousSetDisplays: Record<string, PreviousSetValue[]> =
        await fetchPreviousSetDisplays(
          workoutData.exercises.map((ex) => ex.exercise_id),
          weightUnit
        ).catch(() => ({}));

      const exercises: WorkoutExercise[] = workoutData.exercises.map(
        (ex, exIndex) => {
          const fallbackPreviousDisplay = convertPreviousDisplay(
            ex.previous_display,
            weightUnit
          );
          const sets = ex.sets.map((set, setIndex) => ({
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
          }));

          return {
            id: ex.exercise_id,
            name: ex.exercise_name,
            image: ex.image ?? null,
            exerciseType: (ex.exercise_type as "weight" | "time") ?? "weight",
            restDurationSeconds: ex.rest_duration_seconds,
            notes: ex.notes ?? "",
            difficultyFeedback: null,
            progressionType: ex.progression_type ?? null,
            sets: applyPreviousSetDisplays(
              sets,
              previousSetDisplays[ex.exercise_id],
              fallbackPreviousDisplay
            ),
          };
        }
      );

      const generationMeta: GenerationMeta = {
        generationSource: workoutData.generation_source,
        goalSnapshot: workoutData.goal_snapshot,
        customGoalSnapshot: workoutData.custom_goal_snapshot,
      };

      await deletePendingWorkout(input.pendingWorkout.id);
      startWorkout(workoutData.workout_name, exercises, generationMeta);

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
      markQueueGenerationStarted(request.trigger);
      trackEvent("workout_queue_initialized", {
        count: request.count,
        trigger: request.trigger,
      });
      await deleteAllPendingWorkouts();
      await triggerQueueGeneration(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
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
