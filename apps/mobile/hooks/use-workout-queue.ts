import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import {
  deleteAllPendingWorkouts,
  fetchPendingWorkouts,
  triggerQueueGeneration,
  triggerRegeneration,
  updatePendingWorkoutEdits,
  type PendingWorkout,
  type QueueGenerationRequest,
} from "@/lib/api/pending-workouts";
import { pendingWorkoutKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";
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

// -----------------------------------------------------------------------------
// Queue Query + Realtime
// -----------------------------------------------------------------------------

export function useWorkoutQueue() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const setQueue = usePendingWorkoutStore((s) => s.setQueue);
  const updateWorkout = usePendingWorkoutStore((s) => s.updateWorkout);

  const query = useQuery({
    queryKey: pendingWorkoutKeys.list(),
    queryFn: async () => {
      const workouts = await fetchPendingWorkouts();
      setQueue(workouts);
      return workouts;
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
  const queryClient = useQueryClient();
  const storeUpdateWorkout = usePendingWorkoutStore((s) => s.updateWorkout);

  return useMutation({
    mutationFn: async (pendingWorkoutId: string) => {
      storeUpdateWorkout(pendingWorkoutId, { status: "generating" });
      return triggerRegeneration(pendingWorkoutId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
    onError: (_error: unknown, pendingWorkoutId: string) => {
      storeUpdateWorkout(pendingWorkoutId, { status: "ready" });
    },
  });
}

export function useEditPendingWorkout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      edits: Record<string, unknown>;
    }) => {
      return updatePendingWorkoutEdits(input.id, input.edits);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
  });
}

export function useStartPendingWorkout() {
  const router = useRouter();
  const removeWorkout = usePendingWorkoutStore((s) => s.removeWorkout);
  const startWorkout = useWorkoutStore((s) => s.startWorkout);

  return useMutation({
    mutationFn: async (pendingWorkout: PendingWorkout) => {
      if (!pendingWorkout.workout_data) {
        throw new Error("Workout data not available");
      }

      const { workout_data } = pendingWorkout;

      const exercises: WorkoutExercise[] = workout_data.exercises.map(
        (ex, exIndex) => ({
          id: ex.exercise_id,
          name: ex.exercise_name,
          restDurationSeconds: ex.rest_duration_seconds,
          notes: ex.notes ?? "",
          sets: ex.sets.map((set, setIndex) => ({
            id: `${pendingWorkout.id}-${exIndex}-${setIndex}`,
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
        generationSource: workout_data.generation_source,
        goalSnapshot: workout_data.goal_snapshot,
        customGoalSnapshot: workout_data.custom_goal_snapshot,
      };

      startWorkout(workout_data.workout_name, exercises, generationMeta);
      removeWorkout(pendingWorkout.id);

      return pendingWorkout;
    },
    onSuccess: () => {
      router.navigate("/workout");
    },
  });
}

export function useRebuildQueue() {
  const queryClient = useQueryClient();
  const clearQueue = usePendingWorkoutStore((s) => s.clearQueue);
  const setQueueStatus = usePendingWorkoutStore((s) => s.setQueueStatus);

  return useMutation({
    mutationFn: async (request: QueueGenerationRequest) => {
      clearQueue();
      setQueueStatus("initializing");
      await deleteAllPendingWorkouts();
      await triggerQueueGeneration(request);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: pendingWorkoutKeys.list() });
    },
    onError: () => {
      setQueueStatus("idle");
    },
  });
}
