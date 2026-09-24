const mockRegisteredHandlers = new Map<
  string,
  (payload: unknown, ownerId: string) => Promise<void>
>();
const mockInvalidateAfterWorkoutSave = jest.fn();

jest.mock("@/lib/sync-queue", () => ({
  syncQueue: {
    registerHandler: (
      operation: string,
      handler: (payload: unknown, ownerId: string) => Promise<void>
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
    session: { name: "Push A" },
    exercises: [],
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
import { queryClient } from "@/lib/query-client";

import { registerSyncHandlers } from "../sync-handlers";

describe("save_workout sync handler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegisteredHandlers.clear();
    registerSyncHandlers();
  });

  it("refreshes workout-derived queries once a queued workout is saved", async () => {
    const handler = mockRegisteredHandlers.get("save_workout");

    await handler?.(
      {
        summary: { finishedAtMs: Date.parse("2026-09-23T08:00:00Z") },
        goalSnapshot: "build_muscle",
      },
      "user-1"
    );

    expect(updateWorkoutSession).toHaveBeenCalledWith("session-1", {
      status: "completed",
      completed_at: "2026-09-23T08:00:00.000Z",
    });
    expect(mockInvalidateAfterWorkoutSave).toHaveBeenCalledWith(queryClient);
  });

  it("does not refresh when the save fails", async () => {
    (updateWorkoutSession as jest.Mock).mockRejectedValueOnce(
      new Error("offline")
    );
    const handler = mockRegisteredHandlers.get("save_workout");

    await expect(
      handler?.(
        {
          summary: { finishedAtMs: Date.parse("2026-09-23T08:00:00Z") },
          goalSnapshot: "build_muscle",
        },
        "user-1"
      )
    ).rejects.toThrow("offline");
    expect(mockInvalidateAfterWorkoutSave).not.toHaveBeenCalled();
  });
});
