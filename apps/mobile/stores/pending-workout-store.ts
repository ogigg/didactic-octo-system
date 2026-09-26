import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PendingWorkout } from "@/lib/api/pending-workouts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PendingWorkoutState {
  /** Account whose queue generation this tracks. Null means no account. */
  ownerUserId: string | null;
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
  /** Keeps the account's own context and clears any other account's. */
  prepareForUser: (userId: string | null) => void;
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
  ownerUserId: null,
  queueGenerationStartedAt: null,
  queueGenerationRequestId: null,
  queueGenerationTrigger: null,
  recoveryAttempts: {},
  regeneratingWorkoutIds: [],
};

// -----------------------------------------------------------------------------
// Ownership
// -----------------------------------------------------------------------------

// Undefined until auth reports an account; a load before that keeps the saved
// owner, and the account change that follows clears it if it differs.
let claimedOwnerUserId: string | null | undefined;

/**
 * Applies saved state unless an account change already claimed the store for
 * someone else, so a late load cannot restore that account's context.
 */
export function mergePersistedPendingWorkoutState<
  T extends PendingWorkoutState,
>(persisted: unknown, current: T, ownerUserId: string | null | undefined): T {
  const saved = (persisted ?? {}) as Partial<PendingWorkoutState>;
  if (ownerUserId !== undefined && (saved.ownerUserId ?? null) !== ownerUserId)
    return current;
  return { ...current, ...saved };
}

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePendingWorkoutStore = create<
  PendingWorkoutState & PendingWorkoutActions
>()(
  persist(
    (set, get) => ({
      ...initialState,

      prepareForUser: (userId) => {
        claimedOwnerUserId = userId;
        if (get().ownerUserId === userId) return;
        set({ ...initialState, ownerUserId: userId });
      },

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

      reset: () => set({ ...initialState, ownerUserId: get().ownerUserId }),
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
          ownerUserId: state?.ownerUserId ?? null,
          queueGenerationRequestId: state?.queueGenerationRequestId ?? null,
          regeneratingWorkoutIds: [],
        };
      },
      merge: (persisted, current) =>
        mergePersistedPendingWorkoutState(
          persisted,
          current,
          claimedOwnerUserId
        ),
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
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
