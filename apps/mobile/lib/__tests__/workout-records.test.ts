import {
  evaluateExerciseRecords,
  isRecordStatus,
  parseNumericField,
  type RecordBaseline,
  type SetRecordInput,
} from "@/lib/workout-records";

const baseline = (over: Partial<RecordBaseline> = {}): RecordBaseline => ({
  maxWeightKg: 0,
  maxReps: 0,
  ...over,
});

const set = (
  over: Partial<SetRecordInput> & { id: string }
): SetRecordInput => ({
  weightKg: null,
  reps: null,
  isCompleted: true,
  isWorking: true,
  ...over,
});

describe("parseNumericField", () => {
  it("parses valid numbers and rejects blanks / garbage", () => {
    expect(parseNumericField("80")).toBe(80);
    expect(parseNumericField("82.5")).toBe(82.5);
    expect(parseNumericField("  10 ")).toBe(10);
    expect(parseNumericField("")).toBeNull();
    expect(parseNumericField("   ")).toBeNull();
    expect(parseNumericField("abc")).toBeNull();
    expect(parseNumericField(null)).toBeNull();
  });
});

describe("evaluateExerciseRecords", () => {
  it("flags a weight PR that beats saved history", () => {
    const records = evaluateExerciseRecords(
      [set({ id: "a", weightKg: 100, reps: 5 })],
      baseline({ maxWeightKg: 90, maxReps: 8 })
    );
    expect(records.get("a")).toEqual({
      isWeightRecord: true,
      isRepsRecord: false,
    });
  });

  it("flags a reps PR that beats saved history", () => {
    const records = evaluateExerciseRecords(
      [set({ id: "a", weightKg: 80, reps: 12 })],
      baseline({ maxWeightKg: 90, maxReps: 10 })
    );
    expect(records.get("a")).toEqual({
      isWeightRecord: false,
      isRepsRecord: true,
    });
  });

  it("does not flag a set equal to the baseline (must be strictly greater)", () => {
    const records = evaluateExerciseRecords(
      [set({ id: "a", weightKg: 90, reps: 8 })],
      baseline({ maxWeightKg: 90, maxReps: 8 })
    );
    expect(isRecordStatus(records.get("a")!)).toBe(false);
  });

  it("only flags the single best set across the session (no duplicates)", () => {
    const records = evaluateExerciseRecords(
      [
        set({ id: "a", weightKg: 100, reps: 5 }),
        set({ id: "b", weightKg: 100, reps: 5 }),
      ],
      baseline({ maxWeightKg: 90, maxReps: 4 })
    );
    // Tied top weight => neither is strictly greatest => no weight PR.
    expect(records.get("a")?.isWeightRecord).toBe(false);
    expect(records.get("b")?.isWeightRecord).toBe(false);
    // Tied top reps => no reps PR either.
    expect(records.get("a")?.isRepsRecord).toBe(false);
  });

  it("flags the heaviest set when later sets are lighter", () => {
    const records = evaluateExerciseRecords(
      [
        set({ id: "a", weightKg: 100, reps: 5 }),
        set({ id: "b", weightKg: 95, reps: 5 }),
      ],
      baseline({ maxWeightKg: 90, maxReps: 8 })
    );
    expect(records.get("a")?.isWeightRecord).toBe(true);
    expect(records.get("b")?.isWeightRecord).toBe(false);
  });

  it("ignores incomplete and warmup sets", () => {
    const records = evaluateExerciseRecords(
      [
        set({ id: "warm", weightKg: 200, reps: 20, isWorking: false }),
        set({ id: "incomplete", weightKg: 150, reps: 15, isCompleted: false }),
        set({ id: "done", weightKg: 100, reps: 5 }),
      ],
      baseline({ maxWeightKg: 90, maxReps: 4 })
    );
    expect(records.get("warm")?.isWeightRecord).toBe(false);
    expect(records.get("incomplete")?.isWeightRecord).toBe(false);
    expect(records.get("done")?.isWeightRecord).toBe(true);
    expect(records.get("done")?.isRepsRecord).toBe(true);
  });

  it("treats the first-ever session (no history) heaviest set as a PR", () => {
    const records = evaluateExerciseRecords(
      [set({ id: "a", weightKg: 50, reps: 10 })],
      baseline()
    );
    expect(records.get("a")).toEqual({
      isWeightRecord: true,
      isRepsRecord: true,
    });
  });

  it("does not flag blank or zero values", () => {
    const records = evaluateExerciseRecords(
      [set({ id: "a", weightKg: null, reps: 0 })],
      baseline()
    );
    expect(isRecordStatus(records.get("a")!)).toBe(false);
  });
});
