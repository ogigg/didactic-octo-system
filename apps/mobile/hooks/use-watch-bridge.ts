import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useProfile } from "@/hooks/use-profile-query";
import {
  clearWatchHealthFailure,
  notifyWatchHealthFailure,
  retryPendingWatchHealthFallback,
} from "@/hooks/use-workout-mutations";
import {
  buildActiveWatchSnapshot,
  buildCompletedWatchSnapshot,
  extractWatchCommandID,
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
import {
  useWorkoutStore,
  waitForWorkoutStorePersistence,
} from "@/stores/workout-store";
import { convertWeight, type WeightUnit } from "@/lib/unit-conversion";

function displayWeight(valueKg: number, unit: WeightUnit): string {
  const value = convertWeight(valueKg, unit);
  return String(Math.round(value * 10) / 10);
}

export function useWatchBridge(): void {
  const router = useRouter();
  const actionQueueRef = useRef(Promise.resolve());
  const processedCommandIDsRef = useRef(new Set<string>());
  const applyingWatchCommandRef = useRef(false);
  const exercisesForNames = useWorkoutStore((state) => state.exercises);
  const { data: profile } = useProfile();
  const profileWeightUnit: WeightUnit | undefined = profile?.weight_unit;
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

    let cancelled = false;
    const persist = useWorkoutStore.persist;
    const hydratedRef = { current: persist.hasHydrated() };
    let unsubscribeHydration: (() => void) | undefined;
    const hydrationReady = hydratedRef.current
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          unsubscribeHydration = persist.onFinishHydration(() => {
            hydratedRef.current = true;
            unsubscribeHydration?.();
            resolve();
          });
        });

    function reportBridgeError(operation: string, error: unknown): void {
      console.warn(`[WatchBridge] ${operation} failed:`, error);
    }

    async function publishCanonicalState(): Promise<void> {
      if (cancelled || !hydratedRef.current || !isWatchPaired()) return;
      const state = useWorkoutStore.getState();
      const weightUnit = state.weightUnit ?? profileWeightUnit ?? "kg";
      if (state.isActive && state.startedAtMs) {
        await publishWatchSnapshot(
          buildActiveWatchSnapshot({
            workoutName: state.workoutName,
            startedAtMs: state.startedAtMs,
            exercises: state.exercises,
            warmup: state.warmup,
            restTimer: state.restTimer,
            selectedExerciseId: state.watchSelectedExerciseId,
            localizedNames: localizedNamesRef.current,
            weightUnit,
          })
        );
      } else if (state.completedWorkoutSummary) {
        await publishWatchSnapshot(
          buildCompletedWatchSnapshot(
            state.completedWorkoutSummary,
            state.startedAtMs,
            localizedNamesRef.current,
            weightUnit
          )
        );
      }
    }

    function publishStateWithErrorHandling(operation: string): void {
      void publishCanonicalState().catch((error: unknown) => {
        reportBridgeError(operation, error);
      });
    }

    function retryFailedHealthFallbacks(): void {
      const state = useWorkoutStore.getState();
      for (const [workoutId, fallback] of Object.entries(
        state.healthWorkoutFallbacks
      )) {
        if (
          fallback.sessionId &&
          state.healthWorkoutFailedIDs[workoutId] === true
        ) {
          retryPendingWatchHealthFallback(workoutId);
        }
      }
    }

    const unsubscribeStore = useWorkoutStore.subscribe(
      (state) => ({
        isActive: state.isActive,
        workoutName: state.workoutName,
        warmup: state.warmup,
        exercises: state.exercises,
        startedAtMs: state.startedAtMs,
        restTimer: state.restTimer,
        completedWorkoutSummary: state.completedWorkoutSummary,
        watchSelectedExerciseId: state.watchSelectedExerciseId,
        weightUnit: state.weightUnit,
      }),
      () => {
        if (hydratedRef.current && !applyingWatchCommandRef.current) {
          publishStateWithErrorHandling("state publication");
        }
      }
    );

    async function applyRawAction(rawAction: unknown): Promise<void> {
      await hydrationReady;
      if (cancelled) return;

      const parsed = parseWatchAction(rawAction);
      if (!parsed) {
        const commandID = extractWatchCommandID(rawAction);
        if (commandID) {
          await acknowledgeWatchCommand(commandID);
          // A malformed command may already have been applied optimistically
          // on the Watch. Publish the canonical projection after removing it
          // from the outbox so the next snapshot corrects that projection.
          publishStateWithErrorHandling("malformed command recovery");
        }
        return;
      }

      const { envelope, payload } = parsed;
      if (
        !registerWatchCommand(
          envelope.commandID,
          processedCommandIDsRef.current
        )
      ) {
        await acknowledgeWatchCommand(envelope.commandID);
        publishStateWithErrorHandling("duplicate command recovery");
        return;
      }

      try {
        const store = useWorkoutStore.getState();
        const weightUnit = store.weightUnit ?? profileWeightUnit ?? "kg";
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
        const currentRestId = store.restTimer?.id ?? null;
        const targetsCurrentRest = payload.restId === currentRestId;
        const canApplyHealthCommand =
          payload.workoutId !== undefined &&
          (store.healthWorkoutSavedIDs[payload.workoutId] !== undefined ||
            store.healthWorkoutFailedIDs[payload.workoutId] === true ||
            store.healthWorkoutPendingIDs[payload.workoutId] === true);

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
            restId: currentRestId,
            canApplyHealthCommand,
          })
        ) {
          return;
        }

        applyingWatchCommandRef.current = true;
        switch (envelope.type) {
          case "requestState":
            return;
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
                displayWeight(payload.loadKg, weightUnit)
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
            if (payload.durationSeconds !== undefined) {
              store.updateSetDuration(
                exerciseOccurrenceId,
                set.id,
                payload.durationSeconds
              );
            }
            return;
          case "completeSet":
            if (!exerciseOccurrenceId || !set || set.isCompleted) return;
            store.completeSet(exerciseOccurrenceId, set.id, {
              kg:
                payload.loadKg !== undefined
                  ? displayWeight(payload.loadKg, weightUnit)
                  : undefined,
              reps:
                payload.reps !== undefined ? String(payload.reps) : undefined,
              durationSeconds: payload.durationSeconds,
              restId: payload.restId,
              startedAtMs: payload.completedAt
                ? Number.isFinite(Date.parse(payload.completedAt))
                  ? Date.parse(payload.completedAt)
                  : undefined
                : undefined,
            });
            return;
          case "reopenSet":
            if (exerciseOccurrenceId && set?.isCompleted) {
              store.toggleSetComplete(exerciseOccurrenceId, set.id);
            }
            return;
          case "setWarmupComplete":
            if (payload.isCompleted !== undefined) {
              store.setWarmupComplete(payload.isCompleted);
            }
            return;
          case "adjustRest":
          case "pauseRest":
          case "resumeRest":
            if (!targetsCurrentRest || !payload.restId) return;
            if (
              payload.endDate !== undefined ||
              payload.pausedRemainingSeconds !== undefined ||
              payload.durationSeconds !== undefined ||
              payload.exerciseId !== undefined
            ) {
              store.reconcileRestTimer({
                restId: payload.restId,
                exerciseId: payload.exerciseId,
                durationSeconds: payload.durationSeconds,
                endDate: payload.endDate,
                pausedRemainingSeconds: payload.pausedRemainingSeconds,
                deltaSeconds:
                  envelope.type === "adjustRest"
                    ? payload.deltaSeconds
                    : undefined,
              });
            } else if (envelope.type === "adjustRest") {
              if (payload.deltaSeconds !== undefined) {
                store.adjustRestTimer(payload.deltaSeconds);
              }
            } else if (envelope.type === "pauseRest") {
              store.pauseRestTimer();
            } else {
              store.resumeRestTimer();
            }
            return;
          case "skipRest":
            if (targetsCurrentRest) store.skipRestTimer();
            return;
          case "healthWorkoutStarted":
            store.markHealthWorkoutOwnedByWatch(payload.workoutId);
            return;
          case "healthWorkoutSaved":
            if (payload.workoutId && payload.healthWorkoutUUID) {
              store.markHealthWorkoutSaved(
                payload.workoutId,
                payload.healthWorkoutUUID
              );
              clearWatchHealthFailure(payload.workoutId);
            }
            return;
          case "healthWorkoutFailed":
            if (payload.workoutId) {
              store.markHealthWorkoutFailed(payload.workoutId);
              notifyWatchHealthFailure(payload.workoutId);
              retryPendingWatchHealthFallback(payload.workoutId);
            }
            return;
          case "finishWorkout":
            const finishedAtMs = payload.finishedAt
              ? Date.parse(payload.finishedAt)
              : undefined;
            store.finishWorkout(
              payload.healthWorkoutUUID,
              finishedAtMs !== undefined && Number.isFinite(finishedAtMs)
                ? finishedAtMs
                : undefined
            );
            router.push("/workout-summary");
            return;
        }
      } finally {
        applyingWatchCommandRef.current = false;
        try {
          await waitForWorkoutStorePersistence();
          await acknowledgeWatchCommand(envelope.commandID);
        } catch (error) {
          processedCommandIDsRef.current.delete(envelope.commandID);
          throw error;
        }
        if (processedCommandIDsRef.current.size > 200) {
          processedCommandIDsRef.current = new Set(
            Array.from(processedCommandIDsRef.current).slice(-100)
          );
        }
        publishStateWithErrorHandling("post-command state publication");
      }
    }

    function enqueueRawAction(rawAction: unknown): void {
      actionQueueRef.current = actionQueueRef.current
        .then(() => applyRawAction(rawAction))
        .catch((error: unknown) => {
          reportBridgeError("watch action processing", error);
        });
    }

    function drainPendingActions(): void {
      void hydrationReady
        .then(() => drainPendingWatchActions())
        .then((actions) => {
          if (!cancelled) actions.forEach(enqueueRawAction);
        })
        .catch((error: unknown) => {
          reportBridgeError("pending action drain", error);
        });
    }

    void hydrationReady.then(() => {
      if (cancelled) return;
      publishStateWithErrorHandling("initial state publication");
      retryFailedHealthFallbacks();
      drainPendingActions();
    });

    const subscription = onWatchAction(enqueueRawAction);
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState === "active") {
          publishStateWithErrorHandling("foreground state publication");
          retryFailedHealthFallbacks();
          drainPendingActions();
        }
      }
    );

    return () => {
      cancelled = true;
      unsubscribeHydration?.();
      unsubscribeStore();
      subscription.remove();
      appStateSubscription.remove();
    };
  }, [exerciseMap, profileWeightUnit, router]);
}
