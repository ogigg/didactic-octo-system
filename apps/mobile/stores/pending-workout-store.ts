import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PendingWorkout } from "@/lib/api/pending-workouts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PendingWorkoutState {
  ownerUserId: string | null;
  hasHydrated: boolean;
  queueGenerationStartedAt: number | null;
  queueGenerationTrigger:
    | "onboarding"
    | "preference_change"
    | "replenishment"
    | null;
  queueGenerationSource: "onboarding" | "settings" | "replenishment" | null;
  recoveryAttempts: Record<string, number>;
  recoveryExposedAt: Record<string, number>;
  regeneratingWorkoutIds: string[];
}

interface PendingWorkoutActions {
  bindUser: (userId: string) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  markQueueGenerationStarted: (
    trigger: "onboarding" | "preference_change" | "replenishment"
  ) => void;
  clearQueueGenerationContext: () => void;
  recordRecoveryAttempt: (id: string) => number;
  recordRecoveryAttemptAfterClaim: <T>(
    id: string,
    claim: () => Promise<T>
  ) => Promise<{ claim: T; attemptCount: number }>;
  markRecoveryExposed: (id: string, exposedAt?: number) => number;
  clearRecoveryAttempt: (id: string) => void;
  markWorkoutRegenerating: (id: string) => void;
  clearWorkoutRegenerating: (id: string) => void;
  reset: () => void;
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PendingWorkoutState = {
  ownerUserId: null,
  hasHydrated: false,
  queueGenerationStartedAt: null,
  queueGenerationTrigger: null,
  queueGenerationSource: null,
  recoveryAttempts: {},
  recoveryExposedAt: {},
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

      bindUser: (userId) =>
        set((state) =>
          state.ownerUserId === userId
            ? state
            : {
                ...initialState,
                ownerUserId: userId,
                hasHydrated: state.hasHydrated,
              }
        ),

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      markQueueGenerationStarted: (trigger) =>
        set({
          queueGenerationStartedAt: Date.now(),
          queueGenerationTrigger: trigger,
          queueGenerationSource:
            trigger === "onboarding"
              ? "onboarding"
              : trigger === "preference_change"
                ? "settings"
                : "replenishment",
        }),

      clearQueueGenerationContext: () =>
        set({
          queueGenerationStartedAt: null,
          queueGenerationTrigger: null,
          queueGenerationSource: null,
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

      recordRecoveryAttemptAfterClaim: async (id, claim) => {
        const acceptedClaim = await claim();
        return {
          claim: acceptedClaim,
          attemptCount: get().recordRecoveryAttempt(id),
        };
      },

      markRecoveryExposed: (id, exposedAt = Date.now()) => {
        const existing = get().recoveryExposedAt[id];
        if (existing !== undefined) return existing;
        set((state) => ({
          recoveryExposedAt: {
            ...state.recoveryExposedAt,
            [id]: exposedAt,
          },
        }));
        return exposedAt;
      },

      clearRecoveryAttempt: (id) =>
        set((state) => {
          if (
            !(id in state.recoveryAttempts) &&
            !(id in state.recoveryExposedAt)
          ) {
            return state;
          }
          const recoveryAttempts = { ...state.recoveryAttempts };
          const recoveryExposedAt = { ...state.recoveryExposedAt };
          delete recoveryAttempts[id];
          delete recoveryExposedAt[id];
          return { recoveryAttempts, recoveryExposedAt };
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

      reset: () =>
        set((state) => ({
          ...initialState,
          hasHydrated: state.hasHydrated,
        })),
    }),
    {
      name: "pending-workout-storage",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      migrate: (persistedState, version) => {
        const state = persistedState as
          | Partial<PendingWorkoutState>
          | undefined;

        if (version < 2 || !state?.ownerUserId) {
          return initialState;
        }

        return {
          ...initialState,
          ...state,
          hasHydrated: false,
          regeneratingWorkoutIds: [],
        };
      },
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        queueGenerationStartedAt: state.queueGenerationStartedAt,
        queueGenerationTrigger: state.queueGenerationTrigger,
        queueGenerationSource: state.queueGenerationSource,
        recoveryAttempts: state.recoveryAttempts,
        recoveryExposedAt: state.recoveryExposedAt,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[pending-workout-store] hydration failed:", error);
          usePendingWorkoutStore.setState({ hasHydrated: true });
          return;
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

// -----------------------------------------------------------------------------
// Selectors (pure functions operating on PendingWorkout[])
// -----------------------------------------------------------------------------

export function selectNextWorkout(
  queue: PendingWorkout[]
): PendingWorkout | null {
  return queue.find(isPendingWorkoutReady) ?? null;
}

export function selectReadyCount(queue: PendingWorkout[]): number {
  return queue.filter(isPendingWorkoutReady).length;
}

export function selectIsFullyReady(queue: PendingWorkout[]): boolean {
  return queue.length > 0 && queue.every(isPendingWorkoutReady);
}

export function isPendingWorkoutReady(workout: PendingWorkout): boolean {
  return (
    workout.status === "ready" &&
    workout.workout_data !== null &&
    workout.workout_data_corrupt !== true
  );
}

export function canUsePendingWorkoutState(
  userId: string | null | undefined,
  ownerUserId: string | null,
  hasHydrated: boolean
): boolean {
  return (
    hasHydrated &&
    typeof userId === "string" &&
    userId.length > 0 &&
    ownerUserId === userId
  );
}
