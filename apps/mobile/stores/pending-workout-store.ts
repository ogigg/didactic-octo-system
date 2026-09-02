import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PendingWorkout } from "@/lib/api/pending-workouts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PendingWorkoutState {
  queueGenerationStartedAt: number | null;
  queueGenerationRequestId: string | null;
  queueGenerationTrigger:
    | "onboarding"
    | "preference_change"
    | "replenishment"
    | null;
  recoveryAttempts: Record<string, number>;
  regeneratingWorkoutIds: string[];
}

interface PendingWorkoutActions {
  markQueueGenerationStarted: (
    trigger: "onboarding" | "preference_change" | "replenishment",
    requestId?: string | null
  ) => void;
  clearQueueGenerationContext: () => void;
  recordRecoveryAttempt: (id: string) => number;
  clearRecoveryAttempt: (id: string) => void;
  markWorkoutRegenerating: (id: string) => void;
  clearWorkoutRegenerating: (id: string) => void;
  reset: () => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PendingWorkoutState = {
  queueGenerationStartedAt: null,
  queueGenerationRequestId: null,
  queueGenerationTrigger: null,
  recoveryAttempts: {},
  regeneratingWorkoutIds: [],
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePendingWorkoutStore = create<
  PendingWorkoutState & PendingWorkoutActions
>()(
  persist(
    (set, get) => ({
      ...initialState,

      markQueueGenerationStarted: (trigger, requestId = null) =>
        set({
          queueGenerationStartedAt: Date.now(),
          queueGenerationRequestId: requestId,
          queueGenerationTrigger: trigger,
        }),

      clearQueueGenerationContext: () =>
        set({
          queueGenerationStartedAt: null,
          queueGenerationRequestId: null,
          queueGenerationTrigger: null,
        }),

      recordRecoveryAttempt: (id) => {
        const nextValue = (get().recoveryAttempts[id] ?? 0) + 1;
        set((state) => ({
          recoveryAttempts: {
            ...state.recoveryAttempts,
            [id]: nextValue,
          },
        }));
        return nextValue;
      },

      clearRecoveryAttempt: (id) =>
        set((state) => {
          if (!(id in state.recoveryAttempts)) return state;
          const recoveryAttempts = { ...state.recoveryAttempts };
          delete recoveryAttempts[id];
          return { recoveryAttempts };
        }),

      markWorkoutRegenerating: (id) =>
        set((state) => {
          if (state.regeneratingWorkoutIds.includes(id)) {
            return state;
          }

          return {
            regeneratingWorkoutIds: [...state.regeneratingWorkoutIds, id],
          };
        }),

      clearWorkoutRegenerating: (id) =>
        set((state) => ({
          regeneratingWorkoutIds: state.regeneratingWorkoutIds.filter(
            (workoutId) => workoutId !== id
          ),
        })),

      reset: () => set(initialState),
    }),
    {
      name: "pending-workout-storage",
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState) => {
        const state = persistedState as
          | Partial<PendingWorkoutState>
          | undefined;

        return {
          ...initialState,
          ...state,
          queueGenerationRequestId: state?.queueGenerationRequestId ?? null,
          regeneratingWorkoutIds: [],
        };
      },
      partialize: (state) => ({
        queueGenerationStartedAt: state.queueGenerationStartedAt,
        queueGenerationRequestId: state.queueGenerationRequestId,
        queueGenerationTrigger: state.queueGenerationTrigger,
        recoveryAttempts: state.recoveryAttempts,
      }),
    }
  )
);

// -----------------------------------------------------------------------------
// Selectors (pure functions operating on PendingWorkout[])
// -----------------------------------------------------------------------------

export function selectNextWorkout(
  queue: PendingWorkout[]
): PendingWorkout | null {
  return queue.find((w) => w.status === "ready") ?? null;
}

export function selectReadyCount(queue: PendingWorkout[]): number {
  return queue.filter((w) => w.status === "ready").length;
}

export function selectIsFullyReady(queue: PendingWorkout[]): boolean {
  return queue.length > 0 && queue.every((w) => w.status === "ready");
}
