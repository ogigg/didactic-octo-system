import { markPendingWorkoutGeneratedTracked } from "@/lib/workout-queue-analytics";

describe("pending workout generation analytics", () => {
  it("deduplicates repeated effect runs per request and workout", () => {
    const trackedKeys = new Set<string>();

    expect(
      markPendingWorkoutGeneratedTracked(trackedKeys, "request-1", "workout-1")
    ).toBe(true);
    expect(
      markPendingWorkoutGeneratedTracked(trackedKeys, "request-1", "workout-1")
    ).toBe(false);

    expect(
      markPendingWorkoutGeneratedTracked(trackedKeys, "request-1", "workout-2")
    ).toBe(true);
    expect(
      markPendingWorkoutGeneratedTracked(trackedKeys, "request-2", "workout-1")
    ).toBe(true);
  });
});
