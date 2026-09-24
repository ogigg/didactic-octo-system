const mockPublishCancelledWorkoutToWatch = jest.fn();

jest.mock("@/lib/watch-workout-publisher", () => ({
  publishCancelledWorkoutToWatch: (input: unknown) =>
    mockPublishCancelledWorkoutToWatch(input),
}));

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";

import {
  prepareActiveWorkoutForUser,
  WATCH_CANCEL_TIMEOUT_MS,
} from "../active-workout-owner";

const exercise: WorkoutExercise = {
  id: "squat",
  name: "Squat",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "",
  difficultyFeedback: null,
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "100",
      reps: "5",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: null,
    },
  ],
};

function startWorkoutFor(ownerUserId: string | null) {
  useWorkoutStore.getState().startWorkout("Legs", [exercise]);
  useWorkoutStore.setState({ ownerUserId });
}

describe("prepareActiveWorkoutForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishCancelledWorkoutToWatch.mockResolvedValue(true);
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
    useWorkoutStore.setState({ ownerUserId: null });
  });

  it("cancels another account's workout on the Watch before clearing it", async () => {
    startWorkoutFor("user-a");
    let activeWhenPublished: boolean | undefined;
    mockPublishCancelledWorkoutToWatch.mockImplementation(async () => {
      activeWhenPublished = useWorkoutStore.getState().isActive;
      return true;
    });

    await prepareActiveWorkoutForUser("user-b");

    expect(mockPublishCancelledWorkoutToWatch).toHaveBeenCalledWith(
      expect.objectContaining({ workoutName: "Legs" })
    );
    expect(activeWhenPublished).toBe(true);
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      isActive: false,
    });
  });

  it("claims an unowned workout without touching the Watch", async () => {
    startWorkoutFor(null);

    await prepareActiveWorkoutForUser("user-a");

    expect(mockPublishCancelledWorkoutToWatch).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      isActive: true,
    });
  });

  it("leaves the owner's workout running", async () => {
    startWorkoutFor("user-a");

    await prepareActiveWorkoutForUser("user-a");

    expect(mockPublishCancelledWorkoutToWatch).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().isActive).toBe(true);
  });

  it("drops another account's summary without a Watch message", async () => {
    startWorkoutFor("user-a");
    useWorkoutStore.getState().finishWorkout();

    await prepareActiveWorkoutForUser("user-b");

    expect(mockPublishCancelledWorkoutToWatch).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState().completedWorkoutSummary).toBeNull();
  });

  it("does not let a stuck Watch message hold up sign-in", async () => {
    jest.useFakeTimers();
    startWorkoutFor("user-a");
    mockPublishCancelledWorkoutToWatch.mockReturnValue(new Promise(() => {}));

    const prepared = prepareActiveWorkoutForUser("user-b");
    await jest.advanceTimersByTimeAsync(WATCH_CANCEL_TIMEOUT_MS);
    await prepared;

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      isActive: false,
    });
    jest.useRealTimers();
  });

  it("still clears the workout when the Watch message fails", async () => {
    startWorkoutFor("user-a");
    mockPublishCancelledWorkoutToWatch.mockRejectedValue(new Error("offline"));
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await prepareActiveWorkoutForUser("user-b");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      isActive: false,
    });
    expect(warn).toHaveBeenCalledWith(
      "[active-workout-owner] Watch cancel failed:",
      expect.any(Error)
    );
    warn.mockRestore();
  });
});
