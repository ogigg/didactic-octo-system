import {
  formatRestCountdown,
  getNextUp,
  getRestTimerProgress,
} from "../rest-timer";
import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: `set-${Math.random().toString(36).slice(2)}`,
    type: "working",
    kg: "80",
    reps: "5",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay: null,
    ...overrides,
  };
}

function makeExercise(
  id: string,
  sets: WorkoutSet[],
  overrides: Partial<WorkoutExercise> = {}
): WorkoutExercise {
  return {
    id,
    name: id,
    exerciseType: "weight",
    restDurationSeconds: 120,
    notes: "",
    difficultyFeedback: null,
    sets,
    ...overrides,
  };
}

describe("formatRestCountdown", () => {
  it("formats remaining seconds as m:ss", () => {
    expect(formatRestCountdown(125)).toBe("2:05");
    expect(formatRestCountdown(9.4)).toBe("0:09");
  });

  it("clamps negative values to zero", () => {
    expect(formatRestCountdown(-3)).toBe("0:00");
  });
});

describe("getRestTimerProgress", () => {
  it("reports full progress at the start", () => {
    expect(getRestTimerProgress(1_000, 120, 1_000)).toEqual({
      durationSeconds: 120,
      remainingSeconds: 120,
      progress: 1,
    });
  });
});

describe("getNextUp", () => {
  it("returns the next incomplete working set with its working-set number", () => {
    const exercise = makeExercise("bench", [
      makeSet({ type: "warmup", isCompleted: true }),
      makeSet({ isCompleted: true }),
      makeSet({ kg: "82.5", reps: "8" }),
    ]);

    const result = getNextUp([exercise], "bench");

    expect(result.kind).toBe("set");
    if (result.kind !== "set") return;
    expect(result.workingSetNumber).toBe(2);
    expect(result.set.kg).toBe("82.5");
  });

  it("flags warmup sets without a working-set number", () => {
    const exercise = makeExercise("bench", [
      makeSet({ type: "warmup" }),
      makeSet(),
    ]);

    const result = getNextUp([exercise], "bench");

    expect(result.kind).toBe("set");
    if (result.kind !== "set") return;
    expect(result.workingSetNumber).toBeNull();
  });

  it("falls through to the next exercise with remaining work", () => {
    const bench = makeExercise("bench", [makeSet({ isCompleted: true })]);
    const rows = makeExercise("rows", [makeSet({ isCompleted: true })]);
    const squat = makeExercise("squat", [makeSet()]);

    const result = getNextUp([bench, rows, squat], "bench");

    expect(result).toEqual({ kind: "exercise", exercise: squat });
  });

  it("returns done when nothing is left", () => {
    const bench = makeExercise("bench", [makeSet({ isCompleted: true })]);

    expect(getNextUp([bench], "bench")).toEqual({ kind: "done" });
    expect(getNextUp([bench], "missing")).toEqual({ kind: "done" });
  });
});
