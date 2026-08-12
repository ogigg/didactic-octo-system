import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import {
  areActivitiesEnabled,
  endActivity,
  startActivity,
  updateActivity,
} from "@/modules/workout-live-activity/src";
import type { LiveActivityState } from "@/modules/workout-live-activity/src";
import { useWorkoutStore } from "@/stores/workout-store";
import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

// ---------------------------------------------------------------------------
// Derive the minimal Live Activity state from the workout store
// ---------------------------------------------------------------------------

interface DerivedLiveState {
  exerciseName: string;
  setDisplay: string;
  proposalDisplay: string;
  /** The occurrence ID is used by widget actions; catalog ID is only used for localization. */
  exerciseId: string;
  setId: string;
  currentSetNumber: number;
  totalSets: number;
  workoutName: string;
  workoutStartedAtMs: number;
  isWorkoutComplete: boolean;
  restStartedAtMs: number | null;
  restEndsAtMs: number | null;
}

interface CurrentSet {
  exercise: WorkoutExercise;
  set: WorkoutSet;
  setIndex: number;
}

function findCurrentSet(exercises: WorkoutExercise[]): CurrentSet | null {
  for (const exercise of exercises) {
    const setIndex = exercise.sets.findIndex((set) => !set.isCompleted);
    if (setIndex >= 0) {
      const set = exercise.sets[setIndex];
      if (set) return { exercise, set, setIndex };
    }
  }
  return null;
}

/** Return the last meaningful set so a completed workout can publish a terminal state. */
function findLastSet(exercises: WorkoutExercise[]): CurrentSet | null {
  for (
    let exerciseIndex = exercises.length - 1;
    exerciseIndex >= 0;
    exerciseIndex -= 1
  ) {
    const exercise = exercises[exerciseIndex];
    if (!exercise || exercise.sets.length === 0) continue;
    const setIndex = exercise.sets.length - 1;
    const set = exercise.sets[setIndex];
    if (set) return { exercise, set, setIndex };
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
    pausedRemainingSeconds?: number;
  } | null,
  localizedNames?: ReadonlyMap<string, string>
): DerivedLiveState | null {
  if (!startedAtMs) return null;

  const current = findCurrentSet(exercises);
  const isWorkoutComplete = current === null;
  const meaningfulSet = current ?? findLastSet(exercises);
  if (!meaningfulSet) return null;

  const { exercise, set, setIndex } = meaningfulSet;

  let restStartedAtMs: number | null = null;
  let restEndsAtMs: number | null = null;
  // A terminal state should never render a stale countdown after the final set.
  if (!isWorkoutComplete && restTimer) {
    if (restTimer.pausedRemainingSeconds === undefined) {
      restStartedAtMs = restTimer.startedAtMs;
      restEndsAtMs = restTimer.startedAtMs + restTimer.durationSeconds * 1000;
    }
  }

  return {
    exerciseName: localizedNames?.get(exercise.id) ?? exercise.name,
    setDisplay: formatSetDisplay(exercise, set),
    proposalDisplay: formatProposalDisplay(exercise, set),
    exerciseId: exercise.occurrenceId ?? exercise.id,
    setId: set.id,
    currentSetNumber: setIndex + 1,
    totalSets: Math.max(1, exercise.sets.length),
    workoutName,
    workoutStartedAtMs: startedAtMs,
    isWorkoutComplete,
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
    a.isWorkoutComplete === b.isWorkoutComplete &&
    a.restStartedAtMs === b.restStartedAtMs &&
    a.restEndsAtMs === b.restEndsAtMs
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Synchronizes the session-scoped workout store with ActivityKit.
 *
 * This hook intentionally lives in the root layout (inside QueryClientProvider)
 * rather than the workout route. A route can unmount while an active workout is
 * still running, and iOS backgrounding/locking must not dismiss a Live Activity.
 */
export function useWorkoutLiveActivity(): void {
  const exercisesForNames = useWorkoutStore((s) => s.exercises);
  const { exerciseMap } = useLocalizedExerciseMap(
    exercisesForNames.map((exercise) => exercise.id)
  );
  const localizedNamesRef = useRef(new Map<string, string>());
  const reconcileRef = useRef<((forceStart?: boolean) => void) | null>(null);

  useEffect(() => {
    localizedNamesRef.current = new Map(
      Array.from(exerciseMap.entries()).map(([id, exercise]) => [
        id,
        exercise.name,
      ])
    );
    // Catalog data can arrive after the activity started with local names.
    // Reconcile once so the lock screen and island use the selected language.
    reconcileRef.current?.();
  }, [exerciseMap]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    let cancelled = false;
    const persist = useWorkoutStore.persist;
    const hydratedRef = { current: persist.hasHydrated() };
    const lastSentRef = { current: null as DerivedLiveState | null };
    const activityStartedRef = { current: false };
    const activityWorkoutIdRef = { current: null as string | null };
    const inactiveEndRequestedRef = { current: false };
    const emptyEndRequestedRef = { current: false };

    // ActivityKit calls must stay ordered. In particular, a finish followed by
    // a stale update must not resurrect or update an already-ended activity.
    let operation = Promise.resolve();
    function enqueue(task: () => Promise<void>): void {
      operation = operation
        .catch(() => undefined)
        .then(() => (cancelled ? undefined : task()))
        .catch((error: unknown) => {
          if (!cancelled) {
            console.warn("[live-activity] synchronization failed:", error);
          }
        });
    }

    function resetActivityRefs(): void {
      activityStartedRef.current = false;
      activityWorkoutIdRef.current = null;
      lastSentRef.current = null;
    }

    function endCurrentActivity(force = false): Promise<void> {
      if (!force && !activityStartedRef.current) return Promise.resolve();
      resetActivityRefs();
      return endActivity({ dismissImmediately: true });
    }

    function reconcile(
      slice: {
        isActive: boolean;
        exercises: WorkoutExercise[];
        startedAtMs: number | null;
        workoutName: string;
        restTimer: {
          exerciseId: string;
          startedAtMs: number;
          durationSeconds: number;
          pausedRemainingSeconds?: number;
        } | null;
      },
      forceStart = false
    ): void {
      if (!hydratedRef.current) return;

      enqueue(async () => {
        if (!slice.isActive || !slice.startedAtMs) {
          // Also reconcile the native registry when this JS runtime has just
          // launched. ActivityKit can retain an activity after a crash or OS
          // process termination, so a false JS ref is not proof that none exists.
          if (!inactiveEndRequestedRef.current) {
            inactiveEndRequestedRef.current = true;
            try {
              await endCurrentActivity(true);
            } catch (error) {
              // Keep this retryable if ActivityKit rejects while the app is
              // restoring after a crash or process termination.
              inactiveEndRequestedRef.current = false;
              throw error;
            }
          }
          return;
        }
        inactiveEndRequestedRef.current = false;

        const derived = deriveState(
          slice.exercises,
          slice.startedAtMs,
          slice.workoutName,
          slice.restTimer,
          localizedNamesRef.current
        );
        if (!derived) {
          // An active workout can briefly have no meaningful sets while it is
          // being created or edited. Dismiss any stale activity so an older
          // exercise card is never left on the lock screen; a later store
          // update will start a fresh activity once a set exists.
          if (!emptyEndRequestedRef.current) {
            emptyEndRequestedRef.current = true;
            try {
              await endCurrentActivity(true);
            } catch (error) {
              emptyEndRequestedRef.current = false;
              throw error;
            }
          }
          return;
        }
        emptyEndRequestedRef.current = false;

        const workoutId = `workout-${slice.startedAtMs}`;
        if (
          activityStartedRef.current &&
          activityWorkoutIdRef.current !== workoutId
        ) {
          await endCurrentActivity();
        }

        if (!activityStartedRef.current || forceStart) {
          let enabled = false;
          try {
            enabled = await areActivitiesEnabled();
          } catch (error) {
            console.warn("[live-activity] availability check failed:", error);
          }
          if (!enabled) return;

          let activityId: string | null = null;
          try {
            activityId = await startActivity(
              workoutId,
              derivedToState(derived)
            );
          } catch (error) {
            // A denied permission, unsupported OS, or native request failure
            // must remain retryable. Never mark the JS ref as started here.
            console.warn("[live-activity] start failed:", error);
          }
          if (!activityId) {
            resetActivityRefs();
            return;
          }
          activityStartedRef.current = true;
          activityWorkoutIdRef.current = workoutId;
          lastSentRef.current = derived;
          return;
        }

        if (shallowEqual(derived, lastSentRef.current)) return;
        await updateActivity(derivedToState(derived));
        lastSentRef.current = derived;
      });
    }

    reconcileRef.current = (forceStart = false) => {
      const state = useWorkoutStore.getState();
      reconcile(
        {
          isActive: state.isActive,
          exercises: state.exercises,
          startedAtMs: state.startedAtMs,
          workoutName: state.workoutName,
          restTimer: state.restTimer,
        },
        forceStart
      );
    };

    const unsubscribe = useWorkoutStore.subscribe(
      (state) => ({
        isActive: state.isActive,
        exercises: state.exercises,
        startedAtMs: state.startedAtMs,
        workoutName: state.workoutName,
        restTimer: state.restTimer,
      }),
      (slice) => reconcile(slice)
    );

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      // Do not end on inactive/background. That transition is exactly how an
      // iPhone lock screen and Dynamic Island become useful during a workout.
      if (nextState === "active") reconcileRef.current?.(true);
    });

    let unsubscribeHydration: (() => void) | undefined;
    if (!hydratedRef.current) {
      unsubscribeHydration = persist.onFinishHydration(() => {
        hydratedRef.current = true;
        reconcileRef.current?.();
      });
    } else {
      reconcileRef.current();
    }

    return () => {
      cancelled = true;
      reconcileRef.current = null;
      unsubscribe();
      appStateSub.remove();
      unsubscribeHydration?.();
      // Deliberately do not end here: route changes and provider remounts must
      // not dismiss a session that remains active in the persisted store.
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
    isWorkoutComplete: d.isWorkoutComplete,
    restStartedAtMs: d.restStartedAtMs,
    restEndsAtMs: d.restEndsAtMs,
  };
}
