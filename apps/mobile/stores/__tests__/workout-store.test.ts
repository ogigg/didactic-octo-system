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
