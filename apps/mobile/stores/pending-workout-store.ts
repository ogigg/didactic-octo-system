import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PendingWorkout } from "@/lib/api/pending-workouts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PendingWorkoutState {
  queueGenerationStartedAt: number | null;
  queueGenerationTrigger:
    | "onboarding"
    | "preference_change"
    | "replenishment"
    | null;
  recoveryAttempts: Record<string, number>;
}

interface PendingWorkoutActions {
  markQueueGenerationStarted: (
    trigger: "onboarding" | "preference_change" | "replenishment"
  ) => void;
  clearQueueGenerationContext: () => void;
  recordRecoveryAttempt: (id: string) => number;
  clearRecoveryAttempt: (id: string) => void;
  reset: () => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PendingWorkoutState = {
  queueGenerationStartedAt: null,
  queueGenerationTrigger: null,
  recoveryAttempts: {},
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

      markQueueGenerationStarted: (trigger) =>
        set({
          queueGenerationStartedAt: Date.now(),
          queueGenerationTrigger: trigger,
        }),

      clearQueueGenerationContext: () =>
        set({
          queueGenerationStartedAt: null,
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

      reset: () => set(initialState),
    }),
    {
      name: "pending-workout-storage",
      storage: createJSONStorage(() => AsyncStorage),
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
