const mockPublishCancelledWorkoutToWatch = jest.fn();

jest.mock("@/lib/watch-workout-publisher", () => ({
  publishCancelledWorkoutToWatch: (input: unknown) =>
    mockPublishCancelledWorkoutToWatch(input),
}));

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useWorkoutStore,
  WORKOUT_STORAGE_KEY,
  type WorkoutExercise,
} from "@/stores/workout-store";

import {
  eraseActiveWorkoutForUser,
  prepareActiveWorkoutForUser,
  UNOWNED_WORKOUT_QUARANTINE_KEY,
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
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
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

  it("never hands an unowned workout to an account, whatever its timestamp", async () => {
    startWorkoutFor(null);
    // A skewed device clock can make another account's workout look recent.
    useWorkoutStore.setState({ startedAtMs: Date.now() + 60 * 60 * 1000 });
    await AsyncStorage.setItem(WORKOUT_STORAGE_KEY, "unowned-workout");

    await prepareActiveWorkoutForUser("user-a");

    expect(mockPublishCancelledWorkoutToWatch).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      isActive: false,
      exercises: [],
    });
    // Set aside for no account rather than silently lost.
    expect(await AsyncStorage.getItem(UNOWNED_WORKOUT_QUARANTINE_KEY)).toBe(
      "unowned-workout"
    );
  });

  it("keeps the first quarantined copy", async () => {
    await AsyncStorage.setItem(UNOWNED_WORKOUT_QUARANTINE_KEY, "first");
    await AsyncStorage.setItem(WORKOUT_STORAGE_KEY, "second");
    startWorkoutFor(null);

    await prepareActiveWorkoutForUser("user-a");

    expect(await AsyncStorage.getItem(UNOWNED_WORKOUT_QUARANTINE_KEY)).toBe(
      "first"
    );
  });

  it("still hides an unowned workout when quarantine fails", async () => {
    startWorkoutFor(null);
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const getItem = jest
      .spyOn(AsyncStorage, "getItem")
      .mockRejectedValueOnce(new Error("disk"));

    await prepareActiveWorkoutForUser("user-a");

    expect(useWorkoutStore.getState().isActive).toBe(false);
    expect(warn).toHaveBeenCalledWith(
      "[active-workout-owner] quarantine failed:",
      expect.any(Error)
    );
    getItem.mockRestore();
    warn.mockRestore();
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

describe("eraseActiveWorkoutForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPublishCancelledWorkoutToWatch.mockResolvedValue(true);
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
    useWorkoutStore.setState({ ownerUserId: null });
  });

  it("cancels and clears the erased account's workout", async () => {
    startWorkoutFor("user-a");

    await eraseActiveWorkoutForUser("user-a");

    expect(mockPublishCancelledWorkoutToWatch).toHaveBeenCalledTimes(1);
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: null,
      isActive: false,
      exercises: [],
    });
  });

  it("clears the erased account's unsaved summary", async () => {
    startWorkoutFor("user-a");
    useWorkoutStore.getState().finishWorkout();

    await eraseActiveWorkoutForUser("user-a");

    expect(useWorkoutStore.getState().completedWorkoutSummary).toBeNull();
  });

  it("leaves another account's workout alone", async () => {
    startWorkoutFor("user-b");

    await eraseActiveWorkoutForUser("user-a");

    expect(mockPublishCancelledWorkoutToWatch).not.toHaveBeenCalled();
    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      isActive: true,
    });
  });
});
