import {
  applyPreviousSetsToWorkoutSets,
  buildExerciseSets,
  countWorkingSets,
  normalizeGeneratedExerciseSets,
  normalizeSetsForExerciseType,
} from "@/lib/exercise-set-structure";
import type { WorkoutSet } from "@/stores/workout-store";

function workingSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: "w-1",
    type: "working",
    kg: "",
    reps: "",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay: null,
    ...overrides,
  };
}

describe("exercise-set-structure", () => {
  it("builds weight exercises with one warmup and three working sets", () => {
    const sets = buildExerciseSets({ exerciseType: "weight" });
    expect(sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
      "working",
    ]);
  });

  it("builds time exercises with working sets only", () => {
    const sets = buildExerciseSets({ exerciseType: "time" });
    expect(sets.every((set) => set.type === "working")).toBe(true);
    expect(sets).toHaveLength(3);
  });

  it("normalizes weight to time by stripping warmups and preserving working count", () => {
    const sets = normalizeSetsForExerciseType("time", [
      { ...workingSet({ id: "wu", type: "warmup" }) },
      workingSet({ id: "1" }),
      workingSet({ id: "2" }),
    ]);
    expect(sets.map((set) => set.type)).toEqual(["working", "working"]);
    expect(countWorkingSets(sets)).toBe(2);
  });

  it("normalizes time to weight by prepending one warmup", () => {
    const sets = normalizeSetsForExerciseType("weight", [
      workingSet({ id: "1" }),
      workingSet({ id: "2" }),
      workingSet({ id: "3" }),
    ]);
    expect(sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
      "working",
    ]);
  });

  it("collapses multiple warmups to the first one", () => {
    const sets = normalizeSetsForExerciseType("weight", [
      { ...workingSet({ id: "wu1", type: "warmup", kg: "20" }) },
      { ...workingSet({ id: "wu2", type: "warmup", kg: "30" }) },
      workingSet({ id: "1", kg: "40" }),
    ]);
    expect(sets.filter((set) => set.type === "warmup")).toHaveLength(1);
    expect(sets[0]?.kg).toBe("20");
  });

  describe("normalizeGeneratedExerciseSets", () => {
    it("prepends default warmup when weight has zero warmups", () => {
      const result = normalizeGeneratedExerciseSets("weight", [
        { set_type: "working", target_load_kg: 40, target_reps: 10 },
      ]);
      expect(result.map((set) => set.set_type)).toEqual(["warmup", "working"]);
      expect(result[0]).toMatchObject({
        target_load_kg: 0,
        target_reps: 10,
      });
    });

    it("keeps the first warmup and drops extras", () => {
      const result = normalizeGeneratedExerciseSets("weight", [
        { set_type: "warmup", target_load_kg: 20, target_reps: 10 },
        { set_type: "warmup", target_load_kg: 30, target_reps: 8 },
        { set_type: "working", target_load_kg: 40, target_reps: 10 },
      ]);
      expect(result.map((set) => set.set_type)).toEqual(["warmup", "working"]);
      expect(result[0]?.target_load_kg).toBe(20);
    });

    it("strips warmups from time exercises", () => {
      const result = normalizeGeneratedExerciseSets("time", [
        { set_type: "warmup", target_load_kg: 0, target_reps: 10 },
        { set_type: "working", target_duration_seconds: 40 },
      ]);
      expect(result.map((set) => set.set_type)).toEqual(["working"]);
      expect(result[0]?.target_duration_seconds).toBe(40);
    });

    it("uses a duration-shaped fallback when time has no working rows", () => {
      const result = normalizeGeneratedExerciseSets("time", [
        { set_type: "warmup", target_load_kg: 0, target_reps: 10 },
      ]);
      expect(result).toEqual([
        {
          set_type: "working",
          target_duration_seconds: 40,
        },
      ]);
      expect(result[0]).not.toHaveProperty("target_load_kg");
      expect(result[0]).not.toHaveProperty("target_reps");
    });

    it("is idempotent for weight and time", () => {
      const weightOnce = normalizeGeneratedExerciseSets("weight", [
        { set_type: "working", target_load_kg: 40, target_reps: 10 },
      ]);
      expect(normalizeGeneratedExerciseSets("weight", weightOnce)).toEqual(
        weightOnce
      );

      const timeOnce = normalizeGeneratedExerciseSets("time", []);
      expect(normalizeGeneratedExerciseSets("time", timeOnce)).toEqual(
        timeOnce
      );
    });
  });

  it("applies previous history without cross-contaminating warmup and working", () => {
    const sets = buildExerciseSets({ exerciseType: "weight" });

    const legacy = applyPreviousSetsToWorkoutSets(sets, {
      warmup: null,
      working: [
        { setNumber: 1, display: "40×10" },
        { setNumber: 2, display: "40×10" },
        { setNumber: 3, display: "40×10" },
      ],
    });
    expect(legacy.map((set) => set.previousDisplay)).toEqual([
      null,
      "40×10",
      "40×10",
      "40×10",
    ]);

    const mixed = applyPreviousSetsToWorkoutSets(sets, {
      warmup: "20×10",
      working: [
        { setNumber: 1, display: "40×10" },
        { setNumber: 2, display: "40×10" },
        { setNumber: 3, display: "40×10" },
      ],
    });
    expect(mixed.map((set) => set.previousDisplay)).toEqual([
      "20×10",
      "40×10",
      "40×10",
      "40×10",
    ]);
  });

  it("applies aggregate fallback only to working rows", () => {
    const sets = buildExerciseSets({ exerciseType: "weight" });
    const applied = applyPreviousSetsToWorkoutSets(
      sets,
      { warmup: null, working: [] },
      "40×10"
    );
    expect(applied.map((set) => set.previousDisplay)).toEqual([
      null,
      "40×10",
      "40×10",
      "40×10",
    ]);
  });
});
