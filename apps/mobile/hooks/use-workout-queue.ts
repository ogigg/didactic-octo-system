import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { useProfile, type Profile } from "@/hooks/use-profile-query";
import {
  deleteAllPendingWorkouts,
  fetchPendingWorkouts,
  replacePendingWorkoutWithFallback,
  setPendingWorkoutStatus,
  triggerQueueGeneration,
  triggerRegeneration,
  updatePendingWorkoutEdits,
  type PendingWorkout,
  type QueueGenerationRequest,
  type WorkoutGenerationPreferences,
} from "@/lib/api/pending-workouts";
import {
  buildFallbackPendingWorkoutData,
  isPendingWorkoutStale,
  MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
} from "@/lib/pending-workout-recovery";
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
} from "@/stores/workout-store";

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

// -----------------------------------------------------------------------------
// Queue Query + Realtime
// -----------------------------------------------------------------------------

export function useWorkoutQueue() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const queue = usePendingWorkoutStore((s) => s.queue);
  const setQueue = usePendingWorkoutStore((s) => s.setQueue);
  const updateWorkout = usePendingWorkoutStore((s) => s.updateWorkout);
  const recordRecoveryAttempt = usePendingWorkoutStore(
    (s) => s.recordRecoveryAttempt
  );
  const clearRecoveryAttempt = usePendingWorkoutStore(
    (s) => s.clearRecoveryAttempt
  );
  const recoveryAttempts = usePendingWorkoutStore((s) => s.recoveryAttempts);
  const queueGenerationStartedAt = usePendingWorkoutStore(
    (s) => s.queueGenerationStartedAt
  );
  const queueGenerationTrigger = usePendingWorkoutStore(
    (s) => s.queueGenerationTrigger
  );
  const clearQueueGenerationContext = usePendingWorkoutStore(
    (s) => s.clearQueueGenerationContext
  );
  const previousQueueRef = useRef<PendingWorkout[]>([]);
  const recoveryInFlightRef = useRef(false);

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(),
    queryFn: async () => {
      try {
        const workouts = await fetchPendingWorkouts();
        setQueue(workouts);
        return workouts;
      } catch (error) {
        const cachedQueue = usePendingWorkoutStore.getState().queue;

        if (cachedQueue.length > 0) {
          return cachedQueue;
        }

        throw error;
      }
    },
    enabled: !!user,
  });

  // Realtime subscription for live status updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("pending-workouts-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "pending_workouts",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as PendingWorkout;
          updateWorkout(updated.id, updated);
          queryClient.invalidateQueries({
            queryKey: pendingWorkoutKeys.list(),
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pending_workouts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: pendingWorkoutKeys.list(),
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "pending_workouts",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: pendingWorkoutKeys.list(),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const previousQueue = previousQueueRef.current;

    for (const workout of queue) {
      const previous = previousQueue.find((item) => item.id === workout.id);
      const becameReady =
        workout.status === "ready" &&
        ((previous !== undefined && previous.status !== "ready") ||
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
  ]);

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
            await triggerRegeneration(workout.id, preferences);
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

  return query;
}

// -----------------------------------------------------------------------------
// Selectors (convenience hooks)
// -----------------------------------------------------------------------------

export function useNextWorkout() {
  const queue = usePendingWorkoutStore((s) => s.queue);
  return selectNextWorkout(queue);
}

export function useReadyCount() {
  const queue = usePendingWorkoutStore((s) => s.queue);
  return selectReadyCount(queue);
}

export function useIsFullyReady() {
  const queue = usePendingWorkoutStore((s) => s.queue);
  return selectIsFullyReady(queue);
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export function useRegenerateWorkout() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const storeUpdateWorkout = usePendingWorkoutStore((s) => s.updateWorkout);

  return useMutation({
    mutationFn: async (pendingWorkout: PendingWorkout) => {
      const preferences = getGenerationPreferencesFromProfile(profile);

      if (!preferences) {
        throw new Error("Training preferences are incomplete");
      }

      storeUpdateWorkout(pendingWorkout.id, { status: "generating" });
      return triggerRegeneration(pendingWorkout.id, preferences);
    },
    onSuccess: (_data, pendingWorkout) => {
      trackEvent("pending_workout_regenerated", {
        queue_position: pendingWorkout.queue_position,
        focus_area: pendingWorkout.focus_area,
        previous_generation_source: pendingWorkout.generation_source,
      });

      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
    onError: (_error: unknown, pendingWorkout) => {
      storeUpdateWorkout(pendingWorkout.id, { status: pendingWorkout.status });
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
  const removeWorkout = usePendingWorkoutStore((s) => s.removeWorkout);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  return useMutation({
    mutationFn: async (input: {
      pendingWorkout: PendingWorkout;
      exercises?: {
        exercise_id: string;
        exercise_name: string;
        rest_duration_seconds: number;
        notes: string | null;
        sets: {
          set_type: "warmup" | "working";
          target_load_kg: number;
          target_reps: number;
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

      const exercises: WorkoutExercise[] = workoutData.exercises.map(
        (ex, exIndex) => ({
          id: ex.exercise_id,
          name: ex.exercise_name,
          restDurationSeconds: ex.rest_duration_seconds,
          notes: ex.notes ?? "",
          sets: ex.sets.map((set, setIndex) => ({
            id: `${input.pendingWorkout.id}-${exIndex}-${setIndex}`,
            type: set.set_type,
            kg: String(set.target_load_kg),
            reps: String(set.target_reps),
            rpe: null,
            isCompleted: false,
            previousDisplay: null,
          })),
        })
      );

      const generationMeta: GenerationMeta = {
        generationSource: workoutData.generation_source,
        goalSnapshot: workoutData.goal_snapshot,
        customGoalSnapshot: workoutData.custom_goal_snapshot,
      };

      startWorkout(workoutData.workout_name, exercises, generationMeta);
      removeWorkout(input.pendingWorkout.id);

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
    },
  });
}

export function useRebuildQueue() {
  const queryClient = useQueryClient();
  const clearQueue = usePendingWorkoutStore((s) => s.clearQueue);
  const setQueueStatus = usePendingWorkoutStore((s) => s.setQueueStatus);
  const markQueueGenerationStarted = usePendingWorkoutStore(
    (s) => s.markQueueGenerationStarted
  );
  const clearQueueGenerationContext = usePendingWorkoutStore(
    (s) => s.clearQueueGenerationContext
  );

  return useMutation({
    mutationFn: async (request: QueueGenerationRequest) => {
      clearQueue();
      setQueueStatus("initializing");
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
    },
    onError: () => {
      setQueueStatus("idle");
      clearQueueGenerationContext();
    },
  });
}
