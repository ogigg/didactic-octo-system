import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import {
  isWatchPaired,
  onSetCompleted,
  sendWorkoutEnded,
  sendWorkoutState,
} from "../modules/watch-bridge/src";
import type { WatchWorkoutState } from "../modules/watch-bridge/src";
import { useWorkoutStore } from "../stores/workout-store";
import type { WorkoutExercise } from "../stores/workout-store";

// ---------------------------------------------------------------------------
// Derive the watch-facing workout state from the Zustand store
// ---------------------------------------------------------------------------

interface WatchWorkout {
  id: string;
  name: string;
  exercises: WatchExercisePayload[];
}

interface WatchExercisePayload {
  id: string;
  name: string;
  restDurationSeconds: number;
  notes: string | null;
  sets: WatchSetPayload[];
  progressionType: string | null;
  previousDisplay: string | null;
}

interface WatchSetPayload {
  id: string;
  setType: "warmup" | "working";
  targetLoadKg: number | null;
  targetReps: number | null;
}

function toWatchWorkout(
  name: string,
  startedAtMs: number,
  exercises: WorkoutExercise[]
): WatchWorkout {
  return {
    id: `workout-${startedAtMs}`,
    name,
    exercises: exercises.map((ex) => ({
      id: ex.id,
      name: ex.name,
      restDurationSeconds: ex.restDurationSeconds,
      notes: ex.notes || null,
      sets: ex.sets.map((s) => ({
        id: s.id,
        setType: s.type,
        targetLoadKg: s.kg ? parseFloat(s.kg) : null,
        targetReps: s.reps ? parseInt(s.reps, 10) : null,
      })),
      progressionType: ex.progressionType ?? null,
      previousDisplay: ex.sets[0]?.previousDisplay ?? null,
    })),
  };
}

function findCurrentIndices(exercises: WorkoutExercise[]): {
  exerciseIndex: number;
  setIndex: number;
} {
  for (let ei = 0; ei < exercises.length; ei++) {
    const si = exercises[ei].sets.findIndex((s) => !s.isCompleted);
    if (si !== -1) return { exerciseIndex: ei, setIndex: si };
  }
  // All complete — point at last
  const lastEx = Math.max(0, exercises.length - 1);
  const lastSet = Math.max(0, (exercises[lastEx]?.sets.length ?? 1) - 1);
  return { exerciseIndex: lastEx, setIndex: lastSet };
}

function buildWatchState(
  name: string,
  startedAtMs: number,
  exercises: WorkoutExercise[],
  restTimer: {
    exerciseId: string;
    startedAtMs: number;
    durationSeconds: number;
  } | null
): WatchWorkoutState {
  const workout = toWatchWorkout(name, startedAtMs, exercises);
  const { exerciseIndex, setIndex } = findCurrentIndices(exercises);

  const state: WatchWorkoutState = {
    workout: JSON.stringify(workout),
    currentExerciseIndex: exerciseIndex,
    currentSetIndex: setIndex,
  };

  if (restTimer) {
    state.restTimer = JSON.stringify({
      startedAt: new Date(restTimer.startedAtMs).toISOString(),
      durationSeconds: restTimer.durationSeconds,
    });
  }

  return state;
}

// Simple hash to avoid sending identical state
function stateHash(s: WatchWorkoutState): string {
  return `${s.workout}-${s.currentExerciseIndex}-${s.currentSetIndex}-${s.restTimer ?? "none"}`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWatchBridge() {
  const lastHashRef = useRef<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    if (!isWatchPaired()) return;

    const { isActive, workoutName, exercises, startedAtMs, restTimer } =
      useWorkoutStore.getState();

    // Send initial state if workout is active
    if (isActive && startedAtMs) {
      const state = buildWatchState(
        workoutName,
        startedAtMs,
        exercises,
        restTimer
      );
      lastHashRef.current = stateHash(state);
      sendWorkoutState(state);
    }

    // Subscribe to store changes
    const unsubscribeStore = useWorkoutStore.subscribe(
      (s) => ({
        isActive: s.isActive,
        workoutName: s.workoutName,
        exercises: s.exercises,
        startedAtMs: s.startedAtMs,
        restTimer: s.restTimer,
      }),
      async (slice) => {
        if (!slice.isActive || !slice.startedAtMs) {
          if (lastHashRef.current !== null) {
            await sendWorkoutEnded();
            lastHashRef.current = null;
          }
          return;
        }

        const state = buildWatchState(
          slice.workoutName,
          slice.startedAtMs,
          slice.exercises,
          slice.restTimer
        );
        const hash = stateHash(state);
        if (hash === lastHashRef.current) return;

        lastHashRef.current = hash;
        await sendWorkoutState(state);
      }
    );

    // Listen for set completions from the watch
    const subscription = onSetCompleted((completion) => {
      const { exercises: currentExercises, toggleSetComplete } =
        useWorkoutStore.getState();

      // Find the exercise and set by exerciseId + setIndex
      const exercise = currentExercises.find(
        (e) => e.id === completion.exerciseId
      );
      if (!exercise) return;

      const set = exercise.sets[completion.setIndex];
      if (!set || set.isCompleted) return;

      // Update kg/reps from watch values before completing
      const { updateSetField } = useWorkoutStore.getState();
      if (completion.loadKg > 0) {
        updateSetField(
          completion.exerciseId,
          set.id,
          "kg",
          String(completion.loadKg)
        );
      }
      if (completion.reps > 0) {
        updateSetField(
          completion.exerciseId,
          set.id,
          "reps",
          String(completion.reps)
        );
      }

      toggleSetComplete(completion.exerciseId, set.id);
    });

    return () => {
      unsubscribeStore();
      subscription.remove();
      if (lastHashRef.current !== null) {
        sendWorkoutEnded();
        lastHashRef.current = null;
      }
    };
  }, []);
}
