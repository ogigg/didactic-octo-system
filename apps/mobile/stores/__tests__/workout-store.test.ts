import { useWorkoutStore, type WorkoutExercise } from "../workout-store";

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
});
