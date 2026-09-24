const mockSendWorkoutState = jest.fn(
  (_envelope: unknown): Promise<void> => Promise.resolve()
);

jest.mock("@/modules/watch-bridge/src", () => ({
  WATCH_SYNC_PROTOCOL_VERSION: 1,
  isWatchPaired: () => true,
  sendWorkoutState: (envelope: unknown) => mockSendWorkoutState(envelope),
}));

import { publishCancelledWorkoutToWatch } from "@/lib/watch-workout-publisher";
import type { WorkoutExercise } from "@/stores/workout-store";

const exercise: WorkoutExercise = {
  id: "bench-press",
  occurrenceId: "bench-first",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 90,
  notes: "",
  difficultyFeedback: null,
  sets: [],
};

describe("watch workout publishing", () => {
  beforeEach(() => {
    mockSendWorkoutState.mockClear();
  });

  it("durably publishes a terminal cancellation before phone state is cleared", async () => {
    await expect(
      publishCancelledWorkoutToWatch({
        workoutName: "Push day",
        startedAtMs: Date.parse("2026-07-29T10:00:00.000Z"),
        exercises: [exercise],
      })
    ).resolves.toBe(true);

    expect(mockSendWorkoutState).toHaveBeenCalledTimes(1);
    const envelope = mockSendWorkoutState.mock.calls[0]?.[0] as {
      kind: string;
      payload: string;
    };
    expect(envelope.kind).toBe("workoutEnded");
    expect(JSON.parse(envelope.payload)).toMatchObject({
      workoutId: "workout-1785319200000",
      status: "cancelled",
    });
  });
});
