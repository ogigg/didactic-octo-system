const mockRegisteredHandlers = new Map<
  string,
  (payload: unknown, item: SyncQueueItem) => Promise<void>
>();
const mockInvalidateAfterWorkoutSave = jest.fn();

jest.mock("@/lib/sync-queue", () => ({
  syncQueue: {
    registerHandler: (
      operation: string,
      handler: (payload: unknown, item: SyncQueueItem) => Promise<void>
    ) => mockRegisteredHandlers.set(operation, handler),
  },
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() =>
        Promise.resolve({ data: { user: { id: "user-1" } }, error: null })
      ),
    },
  },
}));

jest.mock("@/lib/api/workout-mappers", () => ({
  mapWorkoutStoreToDb: jest.fn(() => ({
    session: { id: "session-1", name: "Push A" },
    exercises: [],
    completedAt: "2026-09-23T08:00:00.000Z",
  })),
}));

jest.mock("@/lib/api/workouts", () => ({
  createWorkoutSession: jest.fn(() => Promise.resolve({ id: "session-1" })),
  updateWorkoutSession: jest.fn(() => Promise.resolve()),
  upsertSessionExercises: jest.fn(() => Promise.resolve()),
  upsertSessionSets: jest.fn(() => Promise.resolve()),
  upsertSetLog: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/workout-completion-analytics", () => ({
  trackCompletedWorkout: jest.fn(),
}));

jest.mock("@/lib/workout-save-invalidation", () => ({
  invalidateAfterWorkoutSave: (...args: unknown[]) =>
    mockInvalidateAfterWorkoutSave(...args),
}));

import { updateWorkoutSession } from "@/lib/api/workouts";
import type { SyncQueueItem } from "@/lib/sync-queue";
import { trackCompletedWorkout } from "@/lib/workout-completion-analytics";
import { queryClient } from "@/lib/query-client";

import { registerSyncHandlers } from "../sync-handlers";

function queuedItem(payload: unknown): SyncQueueItem {
  return {
    ownerId: "user-1",
    id: "legacy-id",
    operation: "save_workout",
    payload,
    updatedAt: 0,
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: 0,
    status: "pending",
    recoveryAttempts: 0,
    diagnosticReference: "SYNC-TEST0001",
    version: 1,
  };
}

describe("save_workout sync handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisteredHandlers.clear();
    registerSyncHandlers();
  });

  it("refreshes workout-derived queries once a queued workout is saved", async () => {
    const handler = mockRegisteredHandlers.get("save_workout");
    const legacyPayload = {
      summary: { finishedAtMs: Date.parse("2026-09-23T08:00:00Z") },
      goalSnapshot: "build_muscle",
    };
    const item = queuedItem(legacyPayload);

    await handler?.(legacyPayload, item);

    expect(updateWorkoutSession).toHaveBeenCalledWith("session-1", {
      status: "completed",
      completed_at: "2026-09-23T08:00:00.000Z",
    });
    // Stable IDs are frozen on the queue item before the first replay.
    expect(item.id).toBe("session-1");
    expect(trackCompletedWorkout).toHaveBeenCalledWith(
      legacyPayload.summary,
      "build_muscle"
    );
    expect(mockInvalidateAfterWorkoutSave).toHaveBeenCalledWith(queryClient);
  });

  it("does not refresh when the save fails", async () => {
    (updateWorkoutSession as jest.Mock).mockRejectedValueOnce(
      new Error("offline")
    );
    const handler = mockRegisteredHandlers.get("save_workout");

    const legacyPayload = {
      summary: { finishedAtMs: Date.parse("2026-09-23T08:00:00Z") },
      goalSnapshot: "build_muscle",
    };

    await expect(
      handler?.(legacyPayload, queuedItem(legacyPayload))
    ).rejects.toThrow("offline");
    expect(mockInvalidateAfterWorkoutSave).not.toHaveBeenCalled();
  });
});
