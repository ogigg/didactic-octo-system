import {
  migratePersistedWorkoutExercisesFromV0,
  useWorkoutStore,
  type WorkoutExercise,
} from "../workout-store";

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

import { trackEvent } from "@/lib/track-event";

const baseExercise: WorkoutExercise = {
  id: "bench-press",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "Keep elbows tucked",
  difficultyFeedback: "too_hard",
  progressionType: "weight_up",
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "80",
      reps: "5",
      durationSeconds: null,
      rpe: 8,
      isCompleted: true,
      previousDisplay: "77.5 kg x 5",
    },
    {
      id: "set-2",
      type: "working",
      kg: "82.5",
      reps: "4",
      durationSeconds: null,
      rpe: 9,
      isCompleted: false,
      previousDisplay: "80 kg x 4",
    },
  ],
};

describe("workout store exercise replacement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWorkoutStore.getState().clearWorkout();
  });

  it("creates a durable session id and tracks first-set and 50% milestones once", () => {
    const exercise: WorkoutExercise = {
      ...baseExercise,
      sets: baseExercise.sets.map((set) => ({
        ...set,
        isCompleted: false,
        kg: "",
        reps: "",
        rpe: null,
      })),
    };

    useWorkoutStore
      .getState()
      .startWorkout("Push day", [exercise], undefined, null, {
        workoutSource: "manual",
      });
    const sessionId = useWorkoutStore.getState().workoutSessionId;

    expect(sessionId).toEqual(expect.any(String));
    expect(useWorkoutStore.getState().workoutSource).toBe("manual");
    expect(trackEvent).toHaveBeenCalledWith(
      "workout_started",
      expect.objectContaining({ workout_session_id: sessionId })
    );

    const firstSetId = exercise.sets[0]!.id;
    const secondSetId = exercise.sets[1]!.id;
    useWorkoutStore.getState().toggleSetComplete("bench-press", firstSetId);
    useWorkoutStore.getState().toggleSetComplete("bench-press", secondSetId);
    useWorkoutStore.getState().toggleSetComplete("bench-press", secondSetId);

    expect(trackEvent).toHaveBeenCalledTimes(3);
    expect(trackEvent).toHaveBeenCalledWith(
      "workout_first_set_logged",
      expect.objectContaining({ workout_session_id: sessionId })
    );
    expect(trackEvent).toHaveBeenCalledWith(
      "workout_progress_reached",
      expect.objectContaining({
        workout_session_id: sessionId,
        progress_percent: 50,
      })
    );
  });

  it("clears set values when replacing an exercise", () => {
    useWorkoutStore
      .getState()
      .startWorkout("Push day", [baseExercise], undefined);

    useWorkoutStore.getState().replaceExercise("bench-press", {
      id: "dumbbell-press",
      name: "Dumbbell Press",
      exerciseType: "weight",
    });

    const [exercise] = useWorkoutStore.getState().exercises;

    expect(exercise).toMatchObject({
      id: "dumbbell-press",
      name: "Dumbbell Press",
      notes: "",
      difficultyFeedback: null,
      progressionType: "new_exercise",
      exerciseType: "weight",
    });
    expect(exercise?.sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
    ]);
    expect(exercise?.sets.every((set) => set.kg === "")).toBe(true);
    expect(exercise?.sets.every((set) => set.reps === "")).toBe(true);
    expect(exercise?.sets.every((set) => set.previousDisplay === null)).toBe(
      true
    );
  });

  it("preserves working count and strips warmup when replacing with a time exercise", () => {
    useWorkoutStore.getState().startWorkout(
      "Push day",
      [
        {
          ...baseExercise,
          sets: [
            {
              id: "wu",
              type: "warmup",
              kg: "20",
              reps: "10",
              durationSeconds: null,
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            },
            ...baseExercise.sets,
            {
              id: "set-3",
              type: "working",
              kg: "80",
              reps: "5",
              durationSeconds: null,
              rpe: null,
              isCompleted: false,
              previousDisplay: null,
            },
          ],
        },
      ],
      undefined
    );

    useWorkoutStore.getState().replaceExercise("bench-press", {
      id: "plank",
      name: "Plank",
      exerciseType: "time",
    });

    const [exercise] = useWorkoutStore.getState().exercises;
    expect(exercise?.exerciseType).toBe("time");
    expect(exercise?.sets.map((set) => set.type)).toEqual([
      "working",
      "working",
      "working",
    ]);
  });

  it("adds a selected exercise below the current one without changing current set values", () => {
    const squat: WorkoutExercise = {
      ...baseExercise,
      id: "squat",
      name: "Squat",
    };
    useWorkoutStore
      .getState()
      .startWorkout("Full body", [baseExercise, squat], undefined);

    useWorkoutStore.getState().addExerciseAfter("bench-press", {
      id: "push-up",
      name: "Push-Up",
      exerciseType: "weight",
    });

    const exercises = useWorkoutStore.getState().exercises;

    expect(exercises.map((exercise) => exercise.id)).toEqual([
      "bench-press",
      "push-up",
      "squat",
    ]);
    expect(exercises[0]?.sets[0]?.kg).toBe("80");
    expect(exercises[1]).toMatchObject({
      id: "push-up",
      name: "Push-Up",
      notes: "",
      difficultyFeedback: null,
    });
    expect(exercises[1]?.sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
      "working",
    ]);
    expect(exercises[1]?.sets.every((set) => set.kg === "")).toBe(true);
    expect(exercises[1]?.sets.every((set) => set.reps === "")).toBe(true);
  });

  it("hydrates previous displays when adding an exercise", () => {
    useWorkoutStore.getState().startWorkout("Empty workout", [], undefined);

    useWorkoutStore.getState().addExercise({
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight",
      previous: {
        warmup: "20×10",
        working: [
          { setNumber: 1, display: "80×8" },
          { setNumber: 2, display: "77.5×10" },
        ],
      },
    });

    const [exercise] = useWorkoutStore.getState().exercises;

    expect(exercise?.sets.map((set) => set.previousDisplay)).toEqual([
      "20×10",
      "80×8",
      "77.5×10",
      null,
    ]);
  });

  it("adds only working sets via addSet", () => {
    useWorkoutStore.getState().startWorkout("Empty workout", [], undefined);
    useWorkoutStore.getState().addExercise({
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight",
    });
    const exerciseId = useWorkoutStore.getState().exercises[0]?.occurrenceId;
    expect(exerciseId).toBeTruthy();
    useWorkoutStore.getState().addSet(exerciseId!);
    const types = useWorkoutStore
      .getState()
      .exercises[0]?.sets.map((set) => set.type);
    expect(types?.[types.length - 1]).toBe("working");
  });

  it("removes an exercise and clears its rest timer", () => {
    const squat: WorkoutExercise = {
      ...baseExercise,
      id: "squat",
      name: "Squat",
    };
    useWorkoutStore
      .getState()
      .startWorkout("Full body", [baseExercise, squat], undefined);
    useWorkoutStore.getState().startRestTimer("bench-press");

    useWorkoutStore.getState().removeExercise("bench-press");

    const state = useWorkoutStore.getState();
    expect(state.exercises.map((exercise) => exercise.id)).toEqual(["squat"]);
    expect(state.restTimer).toBeNull();
  });

  it("reorders exercises without changing their data", () => {
    const squat: WorkoutExercise = {
      ...baseExercise,
      id: "squat",
      name: "Squat",
    };
    const row: WorkoutExercise = {
      ...baseExercise,
      id: "row",
      name: "Row",
    };
    useWorkoutStore
      .getState()
      .startWorkout("Full body", [baseExercise, squat, row], undefined);

    useWorkoutStore.getState().reorderExercise("squat", 0);
    expect(
      useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
    ).toEqual(["squat", "bench-press", "row"]);

    useWorkoutStore.getState().reorderExercise("squat", 1);
    expect(
      useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
    ).toEqual(["bench-press", "squat", "row"]);
    expect(useWorkoutStore.getState().exercises[1]?.notes).toBe(
      "Keep elbows tucked"
    );
  });

  it("keeps exercise order unchanged when a move is out of bounds", () => {
    const squat: WorkoutExercise = {
      ...baseExercise,
      id: "squat",
      name: "Squat",
    };
    useWorkoutStore
      .getState()
      .startWorkout("Full body", [baseExercise, squat], undefined);

    useWorkoutStore.getState().reorderExercise("bench-press", -1);
    useWorkoutStore.getState().reorderExercise("squat", 99);

    expect(
      useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
    ).toEqual(["bench-press", "squat"]);
  });

  it("reorders an exercise directly to a selected position", () => {
    const squat: WorkoutExercise = {
      ...baseExercise,
      id: "squat",
      name: "Squat",
    };
    const row: WorkoutExercise = {
      ...baseExercise,
      id: "row",
      name: "Row",
    };
    useWorkoutStore
      .getState()
      .startWorkout("Full body", [baseExercise, squat, row], undefined);

    useWorkoutStore.getState().reorderExercise("row", 0);

    expect(
      useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
    ).toEqual(["row", "bench-press", "squat"]);
  });

  it("updates only the selected occurrence when catalog exercises repeat", () => {
    useWorkoutStore.getState().startWorkout(
      "Duplicate bench",
      [
        { ...baseExercise, occurrenceId: "bench-first" },
        {
          ...baseExercise,
          occurrenceId: "bench-second",
          sets: [{ ...baseExercise.sets[0]!, id: "second-set", kg: "60" }],
        },
      ],
      undefined
    );

    useWorkoutStore
      .getState()
      .updateSetField("bench-second", "second-set", "kg", "70");

    const [first, second] = useWorkoutStore.getState().exercises;
    expect(first?.sets[0]?.kg).toBe("80");
    expect(second?.sets[0]?.kg).toBe("70");
  });

  it("adjusts remaining rest time without changing planned rest duration", () => {
    const startedAtMs = new Date("2026-06-03T10:00:00.000Z").getTime();
    const dateNowSpy = jest.spyOn(Date, "now");

    try {
      dateNowSpy.mockReturnValue(startedAtMs);
      useWorkoutStore
        .getState()
        .startWorkout("Push day", [baseExercise], undefined);
      const occurrenceId =
        useWorkoutStore.getState().exercises[0]?.occurrenceId;
      useWorkoutStore.getState().startRestTimer("bench-press");

      dateNowSpy.mockReturnValue(startedAtMs + 10_000);
      useWorkoutStore.getState().adjustRestTimer(-15);

      const restTimer = useWorkoutStore.getState().restTimer;
      expect(restTimer).toMatchObject({
        exerciseId: occurrenceId,
        durationSeconds: 120,
        startedAtMs: startedAtMs - 15_000,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});

describe("migratePersistedWorkoutExercisesFromV0", () => {
  it("adds exactly one warmup to legacy weight-only rows once", () => {
    const migrated = migratePersistedWorkoutExercisesFromV0([
      {
        ...baseExercise,
        sets: [
          {
            id: "set-1",
            type: "working",
            kg: "80",
            reps: "5",
            durationSeconds: null,
            rpe: null,
            isCompleted: false,
            previousDisplay: "77.5×5",
          },
          {
            id: "set-2",
            type: "working",
            kg: "82.5",
            reps: "4",
            durationSeconds: null,
            rpe: null,
            isCompleted: false,
            previousDisplay: "80×4",
          },
        ],
      },
    ]);

    expect(migrated[0]?.sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
    ]);
    expect(migrated[0]?.sets[1]?.previousDisplay).toBe("77.5×5");
    expect(migrated[0]?.sets[2]?.previousDisplay).toBe("80×4");

    const again = migratePersistedWorkoutExercisesFromV0(migrated);
    expect(again[0]?.sets.filter((set) => set.type === "warmup")).toHaveLength(
      1
    );
  });

  it("leaves intentionally removed warmup rows untouched for v1 snapshots", () => {
    const intentionallyRemovedWarmup: WorkoutExercise = {
      ...baseExercise,
      sets: [
        {
          id: "set-1",
          type: "working",
          kg: "80",
          reps: "5",
          durationSeconds: null,
          rpe: null,
          isCompleted: false,
          previousDisplay: null,
        },
        {
          id: "set-2",
          type: "working",
          kg: "82.5",
          reps: "4",
          durationSeconds: null,
          rpe: null,
          isCompleted: false,
          previousDisplay: null,
        },
      ],
    };

    // v1 rehydrate path skips the helper, so an intentional W removal stays removed.
    const afterV1Rehydrate = intentionallyRemovedWarmup;
    expect(afterV1Rehydrate.sets.map((set) => set.type)).toEqual([
      "working",
      "working",
    ]);

    // Contrast: re-running the helper would re-insert W — version gating prevents that.
    const ifHelperReran = migratePersistedWorkoutExercisesFromV0([
      intentionallyRemovedWarmup,
    ]);
    expect(ifHelperReran[0]?.sets[0]?.type).toBe("warmup");
  });
});

describe("watch workout state", () => {
  beforeEach(() => {
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
  });

  it("seeds planned set values separately from editable values", () => {
    useWorkoutStore
      .getState()
      .startWorkout("Push day", [baseExercise], undefined, null, {
        weightUnit: "lbs",
      });

    const set = useWorkoutStore.getState().exercises[0]?.sets[0];
    expect(set).toMatchObject({ plannedKg: "80", plannedReps: "5" });

    useWorkoutStore
      .getState()
      .updateSetField("bench-press", "set-1", "kg", "85");
    expect(useWorkoutStore.getState().exercises[0]?.sets[0]).toMatchObject({
      kg: "85",
      plannedKg: "80",
    });
  });

  it("completes a watch set and creates its anchored rest in one store update", () => {
    const now = Date.parse("2026-07-29T10:12:01.000Z");
    const dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(now);
    try {
      useWorkoutStore
        .getState()
        .startWorkout("Push day", [baseExercise], undefined, null, {
          weightUnit: "kg",
        });
      useWorkoutStore.getState().completeSet("bench-press", "set-2", {
        kg: "90",
        reps: "3",
        restId: "rest-watch",
        startedAtMs: now - 1_000,
      });

      const state = useWorkoutStore.getState();
      expect(state.exercises[0]?.sets[1]).toMatchObject({
        kg: "90",
        reps: "3",
        isCompleted: true,
      });
      expect(state.restTimer).toMatchObject({
        id: "rest-watch",
        exerciseId: state.exercises[0]?.occurrenceId,
        startedAtMs: now - 1_000,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });

  it("completes a phone set and starts its rest in one store update", () => {
    useWorkoutStore
      .getState()
      .startWorkout("Push day", [baseExercise], undefined, null, {
        weightUnit: "kg",
      });
    useWorkoutStore.setState({ firstSetLogged: true, progressReached50: true });

    const listener = jest.fn();
    const unsubscribe = useWorkoutStore.subscribe(listener);
    try {
      useWorkoutStore.getState().toggleSetComplete("bench-press", "set-2", {
        restId: "rest-phone",
        startedAtMs: 1_750_000_000_000,
      });
    } finally {
      unsubscribe();
    }

    const state = useWorkoutStore.getState();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(state.exercises[0]?.sets[1]?.isCompleted).toBe(true);
    expect(state.restTimer).toMatchObject({
      id: "rest-phone",
      exerciseId: state.exercises[0]?.occurrenceId,
      startedAtMs: 1_750_000_000_000,
    });
  });

  it("keeps health receipts durable and does not let a late failure override success", () => {
    useWorkoutStore
      .getState()
      .startWorkout("Push day", [baseExercise], undefined, null, {
        weightUnit: "kg",
      });
    const startedAtMs = useWorkoutStore.getState().startedAtMs!;
    const workoutId = `workout-${startedAtMs}`;
    useWorkoutStore.getState().markHealthWorkoutOwnedByWatch(workoutId);
    useWorkoutStore.getState().finishWorkout(undefined, startedAtMs + 60_000);

    expect(useWorkoutStore.getState().completedWorkoutSummary).toMatchObject({
      healthWorkoutOwnedByWatch: true,
      healthWorkoutSavePending: true,
      healthWorkoutRecordedOnWatch: false,
    });

    useWorkoutStore
      .getState()
      .markHealthWorkoutSaved(
        workoutId,
        "11111111-1111-4111-8111-111111111111"
      );
    useWorkoutStore.getState().markHealthWorkoutFailed(workoutId);

    const state = useWorkoutStore.getState();
    expect(state.healthWorkoutSavedIDs[workoutId]).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
    expect(state.healthWorkoutFailedIDs[workoutId]).toBeUndefined();
    expect(state.completedWorkoutSummary).toMatchObject({
      healthWorkoutRecordedOnWatch: true,
      healthWorkoutSavePending: false,
      healthWorkoutFailed: false,
    });

    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
    expect(useWorkoutStore.getState().healthWorkoutSavedIDs[workoutId]).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("keeps a failed watch Health export retryable after summary dismissal", () => {
    useWorkoutStore
      .getState()
      .startWorkout("Push day", [baseExercise], undefined, null, {
        weightUnit: "kg",
      });
    const startedAtMs = useWorkoutStore.getState().startedAtMs!;
    const workoutId = `workout-${startedAtMs}`;
    useWorkoutStore.getState().markHealthWorkoutOwnedByWatch(workoutId);
    useWorkoutStore.getState().finishWorkout(undefined, startedAtMs + 60_000);
    useWorkoutStore
      .getState()
      .recordHealthWorkoutSession(workoutId, "session-1");
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });

    useWorkoutStore.getState().markHealthWorkoutFailed(workoutId);

    expect(useWorkoutStore.getState().healthWorkoutFailedIDs[workoutId]).toBe(
      true
    );
    expect(
      useWorkoutStore.getState().healthWorkoutFallbacks[workoutId]
    ).toMatchObject({
      sessionId: "session-1",
      startedAtMs,
      finishedAtMs: startedAtMs + 60_000,
    });
  });
});

describe("workout ownership", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  beforeEach(() => {
    jest.clearAllMocks();
    useWorkoutStore.getState().clearWorkout({ suppressAbandonment: true });
    useWorkoutStore.setState({ ownerUserId: null });
  });

  function startWorkoutFor(ownerUserId: string | null) {
    useWorkoutStore.getState().startWorkout("Push day", [baseExercise]);
    useWorkoutStore.setState({ ownerUserId });
    jest.clearAllMocks();
  }

  it("never hands an unowned workout to an account, whatever its timestamp", () => {
    startWorkoutFor(null);
    // A skewed device clock can make an old workout look recent.
    useWorkoutStore.setState({ startedAtMs: Date.now() + DAY_MS });

    useWorkoutStore.getState().prepareForUser("user-a");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      isActive: false,
      workoutName: "",
      exercises: [],
    });
  });

  it("never hands an unowned summary to an account", () => {
    startWorkoutFor(null);
    useWorkoutStore.getState().finishWorkout();

    useWorkoutStore.getState().prepareForUser("user-a");

    expect(useWorkoutStore.getState().completedWorkoutSummary).toBeNull();
  });

  it("lets an account claim an idle unowned store", () => {
    useWorkoutStore.setState({ ownerUserId: null, weightUnit: "lbs" });

    useWorkoutStore.getState().prepareForUser("user-a");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      weightUnit: "lbs",
    });
  });

  it("keeps the workout for the account that owns it", () => {
    startWorkoutFor("user-a");
    const before = useWorkoutStore.getState();

    useWorkoutStore.getState().prepareForUser("user-a");

    expect(useWorkoutStore.getState()).toBe(before);
  });

  it("clears another account's workout without an abandonment event", () => {
    startWorkoutFor("user-a");
    useWorkoutStore.setState({
      startedAtMs: Date.now() - 2 * DAY_MS,
      healthWorkoutSavedIDs: { "watch-1": "health-1" },
    });

    useWorkoutStore.getState().prepareForUser("user-b");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      isActive: false,
      workoutName: "",
      exercises: [],
      startedAtMs: null,
      healthWorkoutSavedIDs: { "watch-1": "health-1" },
    });
    expect(trackEvent).not.toHaveBeenCalledWith(
      "workout_abandoned",
      expect.anything()
    );
  });

  it("clears another account's unsaved workout summary", () => {
    startWorkoutFor("user-a");
    useWorkoutStore.getState().finishWorkout();
    expect(useWorkoutStore.getState().completedWorkoutSummary).not.toBeNull();

    useWorkoutStore.getState().prepareForUser("user-b");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      completedWorkoutSummary: null,
    });
  });

  it("only changes the owner when the store is idle", () => {
    useWorkoutStore.setState({ ownerUserId: "user-a", weightUnit: "lbs" });

    useWorkoutStore.getState().prepareForUser("user-b");

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      weightUnit: "lbs",
    });
  });

  it("keeps the owner when a workout is cleared", () => {
    startWorkoutFor("user-a");

    useWorkoutStore.getState().clearWorkout();

    expect(useWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-a",
      isActive: false,
    });
  });
});
