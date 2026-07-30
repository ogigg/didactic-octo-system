import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Platform } from "react-native";

import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import {
  buildActiveWatchSnapshot,
  buildCompletedWatchSnapshot,
  parseWatchAction,
  registerWatchCommand,
  shouldApplyWatchAction,
} from "@/lib/watch-workout-sync";
import {
  currentWatchRevision,
  publishWatchSnapshot,
} from "@/lib/watch-workout-publisher";
import {
  acknowledgeWatchCommand,
  drainPendingWatchActions,
  isWatchPaired,
  onWatchAction,
} from "@/modules/watch-bridge/src";
import { useWorkoutStore } from "@/stores/workout-store";

export function useWatchBridge(): void {
  const router = useRouter();
  const actionQueueRef = useRef(Promise.resolve());
  const processedCommandIDsRef = useRef(new Set<string>());
  const acceptedSetUpdateBasesRef = useRef(new Map<string, number>());
  const applyingWatchCommandRef = useRef(false);
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
        await publishWatchSnapshot(
          buildActiveWatchSnapshot({
            workoutName: state.workoutName,
            startedAtMs: state.startedAtMs,
            exercises: state.exercises,
            restTimer: state.restTimer,
            selectedExerciseId: state.watchSelectedExerciseId,
            localizedNames: localizedNamesRef.current,
          })
        );
      } else if (state.completedWorkoutSummary) {
        await publishWatchSnapshot(
          buildCompletedWatchSnapshot(
            state.completedWorkoutSummary,
            state.startedAtMs,
            localizedNamesRef.current
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
      () => {
        if (!applyingWatchCommandRef.current) {
          acceptedSetUpdateBasesRef.current.clear();
        }
        void publishCanonicalState();
      }
    );

    async function applyRawAction(rawAction: unknown): Promise<void> {
      const parsed = parseWatchAction(rawAction);
      if (!parsed) return;

      const { envelope, payload } = parsed;
      if (
        !registerWatchCommand(
          envelope.commandID,
          processedCommandIDsRef.current
        )
      ) {
        await acknowledgeWatchCommand(envelope.commandID);
        return;
      }
      try {
        const store = useWorkoutStore.getState();
        const workoutId = store.startedAtMs
          ? `workout-${store.startedAtMs}`
          : null;
        const exercise = payload.exerciseId
          ? store.exercises.find(
              (item) => item.occurrenceId === payload.exerciseId
            )
          : undefined;
        const set = payload.setId
          ? exercise?.sets.find((item) => item.id === payload.setId)
          : undefined;
        const exerciseOccurrenceId = exercise?.occurrenceId;

        const currentRestId = store.restTimer?.id;
        const setMutationKey =
          workoutId && payload.exerciseId && payload.setId
            ? `${workoutId}:${payload.exerciseId}:${payload.setId}`
            : null;
        const payloadMatchesSet =
          set !== undefined &&
          (payload.loadKg !== undefined || payload.reps !== undefined) &&
          (payload.loadKg === undefined || Number(set.kg) === payload.loadKg) &&
          (payload.reps === undefined || Number(set.reps) === payload.reps);
        const targetsCurrentRest =
          payload.restId !== undefined && payload.restId === currentRestId;
        if (
          !shouldApplyWatchAction(parsed, {
            currentRevision: currentWatchRevision(),
            workoutId,
            isActive: store.isActive,
            exerciseExists: exercise !== undefined,
            setState: !set
              ? "missing"
              : set.isCompleted
                ? "completed"
                : "incomplete",
            restId: currentRestId ?? null,
            canReconcileStaleSetMutation:
              payloadMatchesSet ||
              (setMutationKey !== null &&
                acceptedSetUpdateBasesRef.current.get(setMutationKey) ===
                  envelope.baseRevision),
          })
        ) {
          return;
        }

        applyingWatchCommandRef.current = true;
        if (
          (envelope.type === "updateSet" || envelope.type === "completeSet") &&
          setMutationKey &&
          envelope.baseRevision === currentWatchRevision()
        ) {
          acceptedSetUpdateBasesRef.current.set(
            setMutationKey,
            envelope.baseRevision
          );
        }

        switch (envelope.type) {
          case "selectExercise":
            if (exerciseOccurrenceId) {
              store.setWatchSelectedExercise(exerciseOccurrenceId);
            }
            return;
          case "updateSet":
            if (!exerciseOccurrenceId || !set || set.isCompleted) return;
            if (payload.loadKg !== undefined) {
              store.updateSetField(
                exerciseOccurrenceId,
                set.id,
                "kg",
                String(payload.loadKg)
              );
            }
            if (payload.reps !== undefined) {
              store.updateSetField(
                exerciseOccurrenceId,
                set.id,
                "reps",
                String(payload.reps)
              );
            }
            return;
          case "completeSet":
            if (!exerciseOccurrenceId || !set || set.isCompleted) return;
            if (payload.loadKg !== undefined) {
              store.updateSetField(
                exerciseOccurrenceId,
                set.id,
                "kg",
                String(payload.loadKg)
              );
            }
            if (payload.reps !== undefined) {
              store.updateSetField(
                exerciseOccurrenceId,
                set.id,
                "reps",
                String(payload.reps)
              );
            }
            store.toggleSetComplete(exerciseOccurrenceId, set.id);
            return;
          case "adjustRest":
            if (targetsCurrentRest && payload.deltaSeconds !== undefined) {
              store.adjustRestTimer(payload.deltaSeconds);
            }
            return;
          case "pauseRest":
            if (targetsCurrentRest) store.pauseRestTimer();
            return;
          case "resumeRest":
            if (targetsCurrentRest) store.resumeRestTimer();
            return;
          case "skipRest":
            if (targetsCurrentRest) store.skipRestTimer();
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
        applyingWatchCommandRef.current = false;
        await acknowledgeWatchCommand(envelope.commandID);
        if (processedCommandIDsRef.current.size > 200) {
          processedCommandIDsRef.current = new Set(
            Array.from(processedCommandIDsRef.current).slice(-100)
          );
        }
        void publishCanonicalState();
      }
    }

    const subscription = onWatchAction((rawAction) => {
      actionQueueRef.current = actionQueueRef.current.then(() =>
        applyRawAction(rawAction)
      );
    });
    void drainPendingWatchActions().then((actions) => {
      actions.forEach((action) => {
        actionQueueRef.current = actionQueueRef.current.then(() =>
          applyRawAction(action)
        );
      });
    });

    return () => {
      unsubscribeStore();
      subscription.remove();
    };
  }, [router]);
}
