import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  PendingWorkout,
  PendingWorkoutStatus,
} from "@/lib/api/pending-workouts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type QueueStatus =
  | "idle"
  | "initializing"
  | "partial_ready"
  | "all_ready"
  | "replenishing";

interface PendingWorkoutState {
  queue: PendingWorkout[];
  queueStatus: QueueStatus;
  lastFetchedAt: number | null;
}

interface PendingWorkoutActions {
  setQueue: (workouts: PendingWorkout[]) => void;
  updateWorkoutStatus: (id: string, status: PendingWorkoutStatus) => void;
  updateWorkout: (id: string, updates: Partial<PendingWorkout>) => void;
  removeWorkout: (id: string) => void;
  setQueueStatus: (status: QueueStatus) => void;
  clearQueue: () => void;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function deriveQueueStatus(queue: PendingWorkout[]): QueueStatus {
  if (queue.length === 0) return "idle";

  const hasGeneratingOrQueued = queue.some(
    (w) => w.status === "queued" || w.status === "generating"
  );
  const allReady = queue.every((w) => w.status === "ready");

  if (allReady) return "all_ready";
  if (hasGeneratingOrQueued) {
    const readyCount = queue.filter((w) => w.status === "ready").length;
    if (readyCount > 0) return "partial_ready";
    return "initializing";
  }

  return "idle";
}

// -----------------------------------------------------------------------------
// Initial State
// -----------------------------------------------------------------------------

const initialState: PendingWorkoutState = {
  queue: [],
  queueStatus: "idle",
  lastFetchedAt: null,
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

export const usePendingWorkoutStore = create<
  PendingWorkoutState & PendingWorkoutActions
>()(
  persist(
    (set) => ({
      ...initialState,

      setQueue: (workouts) =>
        set({
          queue: workouts,
          lastFetchedAt: Date.now(),
          queueStatus: deriveQueueStatus(workouts),
        }),

      updateWorkoutStatus: (id, status) =>
        set((state) => {
          const queue = state.queue.map((w) =>
            w.id === id ? { ...w, status } : w
          );
          return { queue, queueStatus: deriveQueueStatus(queue) };
        }),

      updateWorkout: (id, updates) =>
        set((state) => {
          const queue = state.queue.map((w) =>
            w.id === id ? { ...w, ...updates } : w
          );
          return { queue, queueStatus: deriveQueueStatus(queue) };
        }),

      removeWorkout: (id) =>
        set((state) => {
          const queue = state.queue.filter((w) => w.id !== id);
          return { queue, queueStatus: deriveQueueStatus(queue) };
        }),

      setQueueStatus: (queueStatus) => set({ queueStatus }),

      clearQueue: () => set(initialState),
    }),
    {
      name: "pending-workout-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn(
            "[pending-workout-store] hydration failed, resetting:",
            error
          );
          state?.clearQueue();
        }
      },
    }
  )
);

// -----------------------------------------------------------------------------
// Selectors
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
