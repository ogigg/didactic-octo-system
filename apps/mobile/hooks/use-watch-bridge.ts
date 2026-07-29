import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import {
  buildActiveWatchSnapshot,
  buildCompletedWatchSnapshot,
  makeWatchEnvelope,
  parseWatchAction,
} from "@/lib/watch-workout-sync";
import {
  acknowledgeWatchCommand,
  drainPendingWatchActions,
  isWatchPaired,
  onWatchAction,
  sendWorkoutState,
} from "@/modules/watch-bridge/src";
import { useWorkoutStore } from "@/stores/workout-store";

export function useWatchBridge(): void {
  const router = useRouter();
  const revisionRef = useRef(0);
  const exercisesForNames = useWorkoutStore((state) => state.exercises);
  const { exerciseMap } = useLocalizedExerciseMap(
    exercisesForNames.map((exercise) => exercise.id)
  );
  const localizedNamesRef = useRef(new Map<string, string>());

  useEffect(() => {
    localizedNamesRef.current = new Map(
      Array.from(exerciseMap.entries()).map(([id, exercise]) => [
        id,
        exercise.name,
      ])
    );
  }, [exerciseMap]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    async function publishCanonicalState(): Promise<void> {
      const state = useWorkoutStore.getState();
      if (!isWatchPaired()) return;
      if (state.isActive && state.startedAtMs) {
        revisionRef.current = Math.max(revisionRef.current + 1, Date.now());
        await sendWorkoutState(
          makeWatchEnvelope(
            buildActiveWatchSnapshot({
              workoutName: state.workoutName,
              startedAtMs: state.startedAtMs,
              exercises: state.exercises,
              restTimer: state.restTimer,
              selectedExerciseId: state.watchSelectedExerciseId,
              localizedNames: localizedNamesRef.current,
            }),
            revisionRef.current
          )
        );
      } else if (state.completedWorkoutSummary) {
        revisionRef.current = Math.max(revisionRef.current + 1, Date.now());
        await sendWorkoutState(
          makeWatchEnvelope(
            buildCompletedWatchSnapshot(
              state.completedWorkoutSummary,
              state.startedAtMs,
              localizedNamesRef.current
            ),
            revisionRef.current
          )
        );
      }
    }

    void publishCanonicalState();

    const unsubscribeStore = useWorkoutStore.subscribe(
      (state) => ({
        isActive: state.isActive,
        workoutName: state.workoutName,
        exercises: state.exercises,
        startedAtMs: state.startedAtMs,
        restTimer: state.restTimer,
        completedWorkoutSummary: state.completedWorkoutSummary,
        watchSelectedExerciseId: state.watchSelectedExerciseId,
      }),
      () => void publishCanonicalState()
    );

    async function applyRawAction(rawAction: unknown): Promise<void> {
      const parsed = parseWatchAction(rawAction);
      if (!parsed) return;

      const { envelope, payload } = parsed;
      try {
        const store = useWorkoutStore.getState();
        const workoutId = store.startedAtMs
          ? `workout-${store.startedAtMs}`
          : null;
        if (!store.isActive || payload.workoutId !== workoutId) return;

        const exercise = payload.exerciseId
          ? store.exercises.find((item) => item.id === payload.exerciseId)
          : undefined;
        const set = payload.setId
          ? exercise?.sets.find((item) => item.id === payload.setId)
          : undefined;

        switch (envelope.type) {
          case "selectExercise":
            if (exercise) store.setWatchSelectedExercise(exercise.id);
            return;
          case "updateSet":
            if (!exercise || !set || set.isCompleted) return;
            if (payload.loadKg !== undefined) {
              store.updateSetField(
                exercise.id,
                set.id,
                "kg",
                String(payload.loadKg)
              );
            }
            if (payload.reps !== undefined) {
              store.updateSetField(
                exercise.id,
                set.id,
                "reps",
                String(payload.reps)
              );
            }
            return;
          case "completeSet":
            if (!exercise || !set || set.isCompleted) return;
            if (payload.loadKg !== undefined) {
              store.updateSetField(
                exercise.id,
                set.id,
                "kg",
                String(payload.loadKg)
              );
            }
            if (payload.reps !== undefined) {
              store.updateSetField(
                exercise.id,
                set.id,
                "reps",
                String(payload.reps)
              );
            }
            store.toggleSetComplete(exercise.id, set.id);
            return;
          case "adjustRest":
            if (store.restTimer && payload.deltaSeconds !== undefined) {
              store.adjustRestTimer(payload.deltaSeconds);
            }
            return;
          case "pauseRest":
            store.pauseRestTimer();
            return;
          case "resumeRest":
            store.resumeRestTimer();
            return;
          case "skipRest":
            store.skipRestTimer();
            return;
          case "healthWorkoutStarted":
            store.markHealthWorkoutOwnedByWatch();
            return;
          case "finishWorkout":
            store.finishWorkout(payload.healthWorkoutUUID);
            router.push("/workout-summary");
            return;
        }
      } finally {
        await acknowledgeWatchCommand(envelope.commandID);
        void publishCanonicalState();
      }
    }

    const subscription = onWatchAction((rawAction) => {
      void applyRawAction(rawAction);
    });
    void drainPendingWatchActions().then((actions) => {
      actions.forEach((action) => void applyRawAction(action));
    });

    return () => {
      unsubscribeStore();
      subscription.remove();
    };
  }, [router]);
}
