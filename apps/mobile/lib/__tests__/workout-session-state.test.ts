import {
  countLoggedWorkoutSets,
  hasLoggedWorkoutData,
} from "../workout-session-state";
import type { WorkoutExercise } from "@/stores/workout-store";

const baseExercise: WorkoutExercise = {
  id: "bench-press",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "",
  difficultyFeedback: null,
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "",
      reps: "",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: "80 kg x 5",
    },
  ],
};

describe("hasLoggedWorkoutData", () => {
  it("treats workouts with no set input as empty", () => {
    expect(hasLoggedWorkoutData([])).toBe(false);
    expect(hasLoggedWorkoutData([baseExercise])).toBe(false);
  });

  it("detects completed and partially entered set data", () => {
    expect(
      hasLoggedWorkoutData([
        {
          ...baseExercise,
          sets: [{ ...baseExercise.sets[0]!, isCompleted: true }],
        },
      ])
    ).toBe(true);
    expect(
      hasLoggedWorkoutData([
        { ...baseExercise, sets: [{ ...baseExercise.sets[0]!, reps: "8" }] },
      ])
    ).toBe(true);
    expect(
      hasLoggedWorkoutData([
        {
          ...baseExercise,
          sets: [{ ...baseExercise.sets[0]!, durationSeconds: 45 }],
        },
      ])
    ).toBe(true);
    expect(
      hasLoggedWorkoutData([
        { ...baseExercise, sets: [{ ...baseExercise.sets[0]!, rpe: 8 }] },
      ])
    ).toBe(true);
  });
});

describe("countLoggedWorkoutSets", () => {
  it("counts only sets with logged user input", () => {
    expect(
      countLoggedWorkoutSets([
        {
          ...baseExercise,
          sets: [
            baseExercise.sets[0]!,
            { ...baseExercise.sets[0]!, id: "set-2", kg: "80" },
            { ...baseExercise.sets[0]!, id: "set-3", isCompleted: true },
          ],
        },
      ])
    ).toBe(2);
  });
});
