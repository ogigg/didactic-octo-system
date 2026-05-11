import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import {
  areActivitiesEnabled,
  endActivity,
  startActivity,
  updateActivity,
} from "../modules/workout-live-activity/src";
import type { LiveActivityState } from "../modules/workout-live-activity/src";
import { useWorkoutStore } from "../stores/workout-store";
import type { WorkoutExercise, WorkoutSet } from "../stores/workout-store";

// ---------------------------------------------------------------------------
// Derive the minimal Live Activity state from the workout store
// ---------------------------------------------------------------------------

interface DerivedLiveState {
  exerciseName: string;
  setDisplay: string;
  proposalDisplay: string;
  exerciseId: string;
  setId: string;
  currentSetNumber: number;
  totalSets: number;
  workoutName: string;
  workoutStartedAtMs: number;
  restStartedAtMs: number | null;
  restEndsAtMs: number | null;
}

function findCurrentSet(exercises: WorkoutExercise[]): {
  exercise: WorkoutExercise;
  set: WorkoutSet;
} | null {
  for (const exercise of exercises) {
    const set = exercise.sets.find((s) => !s.isCompleted);
    if (set) return { exercise, set };
  }
  return null;
}

function formatSetDisplay(exercise: WorkoutExercise, set: WorkoutSet): string {
  if (exercise.exerciseType === "time") {
    const secs = set.durationSeconds ?? 0;
    return `${secs}s`;
  }
  const kg = set.kg || "BW";
  const reps = set.reps || "—";
  const kgLabel = set.kg ? `${kg} kg` : "Bodyweight";
  return `${kgLabel} × ${reps}`;
}

/** Expanded Dynamic Island: e.g. "60 kg × 12 reps" */
function formatProposalDisplay(
  exercise: WorkoutExercise,
  set: WorkoutSet
): string {
  if (exercise.exerciseType === "time") {
    const secs = set.durationSeconds ?? 0;
    return `${secs}s hold`;
  }
  const kg = set.kg?.trim();
  const reps = set.reps?.trim() || "—";
  if (kg) {
    return `${kg} kg × ${reps} reps`;
  }
  return `Bodyweight × ${reps} reps`;
}

function deriveState(
  exercises: WorkoutExercise[],
  startedAtMs: number | null,
  workoutName: string,
  restTimer: {
    exerciseId: string;
    startedAtMs: number;
    durationSeconds: number;
  } | null
): DerivedLiveState | null {
  if (!startedAtMs) return null;

  const current = findCurrentSet(exercises);
  if (!current) return null;

  const { exercise, set } = current;

  let restStartedAtMs: number | null = null;
  let restEndsAtMs: number | null = null;
  if (restTimer) {
    restStartedAtMs = restTimer.startedAtMs;
    restEndsAtMs = restTimer.startedAtMs + restTimer.durationSeconds * 1000;
  }

  const idx = exercise.sets.findIndex((s) => s.id === set.id);
  const currentSetNumber = idx >= 0 ? idx + 1 : 1;
  const totalSets = Math.max(1, exercise.sets.length);

  return {
    exerciseName: exercise.name,
    setDisplay: formatSetDisplay(exercise, set),
    proposalDisplay: formatProposalDisplay(exercise, set),
    exerciseId: exercise.id,
    setId: set.id,
    currentSetNumber,
    totalSets,
    workoutName,
    workoutStartedAtMs: startedAtMs,
    restStartedAtMs,
    restEndsAtMs,
  };
}

function shallowEqual(
  a: DerivedLiveState | null,
  b: DerivedLiveState | null
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.exerciseName === b.exerciseName &&
    a.setDisplay === b.setDisplay &&
    a.proposalDisplay === b.proposalDisplay &&
    a.exerciseId === b.exerciseId &&
    a.setId === b.setId &&
    a.currentSetNumber === b.currentSetNumber &&
    a.totalSets === b.totalSets &&
    a.workoutName === b.workoutName &&
    a.workoutStartedAtMs === b.workoutStartedAtMs &&
    a.restStartedAtMs === b.restStartedAtMs &&
    a.restEndsAtMs === b.restEndsAtMs
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWorkoutLiveActivity() {
  const lastSentRef = useRef<DerivedLiveState | null>(null);
  const activityStartedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    function endCurrentActivity() {
      endActivity({ dismissImmediately: true }).catch((error) => {
        console.warn("[live-activity] end failed:", error);
      });
      activityStartedRef.current = false;
      lastSentRef.current = null;
    }

    // Kick off the activity when the workout is active on mount
    const { isActive, exercises, startedAtMs, workoutName, restTimer } =
      useWorkoutStore.getState();

    async function maybeStart() {
      if (!isActive) return;
      const enabled = await areActivitiesEnabled();
      if (!enabled) return;

      const derived = deriveState(
        exercises,
        startedAtMs,
        workoutName,
        restTimer
      );
      if (!derived) return;

      const workoutId = `workout-${startedAtMs}`;
      await startActivity(workoutId, derivedToState(derived));
      activityStartedRef.current = true;
      lastSentRef.current = derived;
    }

    maybeStart();

    // Subscribe to store changes with selector
    const unsubscribe = useWorkoutStore.subscribe(
      (s) => ({
        isActive: s.isActive,
        exercises: s.exercises,
        startedAtMs: s.startedAtMs,
        workoutName: s.workoutName,
        restTimer: s.restTimer,
      }),
      async (slice) => {
        if (!slice.isActive) {
          if (activityStartedRef.current) {
            await endActivity({ dismissImmediately: true });
            activityStartedRef.current = false;
            lastSentRef.current = null;
          }
          return;
        }

        // Start activity if it isn't running yet (e.g. workout started while hook was not mounted)
        if (!activityStartedRef.current) {
          const enabled = await areActivitiesEnabled();
          if (!enabled) return;
          const derived = deriveState(
            slice.exercises,
            slice.startedAtMs,
            slice.workoutName,
            slice.restTimer
          );
          if (!derived) return;
          await startActivity(
            `workout-${slice.startedAtMs}`,
            derivedToState(derived)
          );
          activityStartedRef.current = true;
          lastSentRef.current = derived;
          return;
        }

        const derived = deriveState(
          slice.exercises,
          slice.startedAtMs,
          slice.workoutName,
          slice.restTimer
        );
        if (!derived) return;
        if (shallowEqual(derived, lastSentRef.current)) return;

        await updateActivity(derivedToState(derived));
        lastSentRef.current = derived;
      }
    );

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active" && activityStartedRef.current) {
        endCurrentActivity();
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (activityStartedRef.current) {
        endCurrentActivity();
      }
    };
  }, []);
}

function derivedToState(d: DerivedLiveState): LiveActivityState {
  return {
    exerciseName: d.exerciseName,
    setDisplay: d.setDisplay,
    proposalDisplay: d.proposalDisplay,
    exerciseId: d.exerciseId,
    setId: d.setId,
    currentSetNumber: d.currentSetNumber,
    totalSets: d.totalSets,
    workoutName: d.workoutName,
    workoutStartedAtMs: d.workoutStartedAtMs,
    restStartedAtMs: d.restStartedAtMs,
    restEndsAtMs: d.restEndsAtMs,
  };
}
