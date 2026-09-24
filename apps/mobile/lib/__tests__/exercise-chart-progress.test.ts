import { getExerciseChartProgress } from "../exercise-chart-progress";
import { toKg } from "../unit-conversion";
import type { WorkoutExercise } from "@/stores/workout-store";

const exercise: WorkoutExercise = {
  id: "bench",
  name: "Bench press",
  exerciseType: "weight",
  restDurationSeconds: 60,
  notes: "",
  difficultyFeedback: null,
  sets: [true, true, false].map((isCompleted, index) => ({
    id: String(index),
    type: "working",
    kg: "20",
    reps: "5",
    durationSeconds: 30,
    rpe: null,
    isCompleted,
    previousDisplay: null,
  })),
};

it("separates checked load from the total forecast and reacts to unchecked sets", () => {
  expect(getExerciseChartProgress([exercise], "bench", "kg")).toEqual({
    completed: 200,
    forecast: 300,
    completedSets: 2,
    totalSets: 3,
  });
  const unchecked = {
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set, isCompleted: false })),
  };
  expect(getExerciseChartProgress([unchecked], "bench", "kg")?.completed).toBe(
    0
  );
  expect(getExerciseChartProgress([exercise], "other", "kg")).toBeUndefined();
});

it("converts pounds, combines duplicate exercise occurrences, and supports durations", () => {
  expect(
    getExerciseChartProgress([exercise, exercise], "bench", "lbs")?.completed
  ).toBeCloseTo(toKg(400, "lbs"));
  expect(
    getExerciseChartProgress(
      [{ ...exercise, exerciseType: "time" }],
      "bench",
      "kg"
    )
  ).toEqual({
    completed: 60,
    forecast: 90,
    completedSets: 2,
    totalSets: 3,
  });
});

it("does not invent load for empty or invalid targets", () => {
  const empty = {
    ...exercise,
    sets: exercise.sets.map((set) => ({ ...set, kg: "", reps: "Infinity" })),
  };
  expect(getExerciseChartProgress([empty], "bench", "kg")?.forecast).toBe(0);
});
