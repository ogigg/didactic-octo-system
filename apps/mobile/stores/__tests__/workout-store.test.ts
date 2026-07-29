import {
  activeWorkoutStateStorage,
  useWorkoutStore,
  type WorkoutExercise,
} from "../workout-store";

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
    useWorkoutStore.getState().clearWorkout();
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
    });
    expect(exercise?.sets).toEqual([
      {
        id: "set-1",
        type: "working",
        kg: "",
        reps: "",
        durationSeconds: null,
        rpe: null,
        isCompleted: false,
        previousDisplay: null,
      },
      {
        id: "set-2",
        type: "working",
        kg: "",
        reps: "",
        durationSeconds: null,
        rpe: null,
        isCompleted: false,
        previousDisplay: null,
      },
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
    expect(exercises[1]?.sets).toHaveLength(3);
    expect(exercises[1]?.sets.every((set) => set.kg === "")).toBe(true);
    expect(exercises[1]?.sets.every((set) => set.reps === "")).toBe(true);
  });

  it("hydrates previous displays when adding an exercise", () => {
    useWorkoutStore.getState().startWorkout("Empty workout", [], undefined);

    useWorkoutStore.getState().addExercise({
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight",
      previousDisplays: ["80×8", "77.5×10"],
    });

    const [exercise] = useWorkoutStore.getState().exercises;

    expect(exercise?.sets.map((set) => set.previousDisplay)).toEqual([
      "80×8",
      "77.5×10",
      null,
    ]);
  });

  it("hydrates previous displays after an exercise has been added", async () => {
    useWorkoutStore.getState().startWorkout("Empty workout", [], undefined);
    await useWorkoutStore.getState().addExercise({
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight",
    });

    await useWorkoutStore
      .getState()
      .hydrateExercisePreviousDisplays("bench-press", ["80×8", "77.5×10"]);

    const [exercise] = useWorkoutStore.getState().exercises;
    expect(exercise?.sets.map((set) => set.previousDisplay)).toEqual([
      "80×8",
      "77.5×10",
      null,
    ]);
  });

  it("returns the persistence rejection after adding in memory", async () => {
    const persistenceError = new Error("AsyncStorage failure");
    const setItemSpy = jest
      .spyOn(activeWorkoutStateStorage, "setItem")
      .mockImplementation(() => Promise.reject(persistenceError));

    const persistence = useWorkoutStore.getState().addExercise({
      id: "bench-press",
      name: "Bench Press",
      exerciseType: "weight",
    });

    expect(useWorkoutStore.getState().exercises[0]?.id).toBe("bench-press");
    await expect(persistence).rejects.toBe(persistenceError);
    setItemSpy.mockRestore();
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

  it("adjusts remaining rest time without changing planned rest duration", () => {
    const startedAtMs = new Date("2026-06-03T10:00:00.000Z").getTime();
    const dateNowSpy = jest.spyOn(Date, "now");

    try {
      dateNowSpy.mockReturnValue(startedAtMs);
      useWorkoutStore
        .getState()
        .startWorkout("Push day", [baseExercise], undefined);
      useWorkoutStore.getState().startRestTimer("bench-press");

      dateNowSpy.mockReturnValue(startedAtMs + 10_000);
      useWorkoutStore.getState().adjustRestTimer(-15);

      const restTimer = useWorkoutStore.getState().restTimer;
      expect(restTimer).toMatchObject({
        exerciseId: "bench-press",
        durationSeconds: 120,
        startedAtMs: startedAtMs - 15_000,
      });
    } finally {
      dateNowSpy.mockRestore();
    }
  });
});
