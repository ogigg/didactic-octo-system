import { buildTemplateWorkoutExercises } from "@/lib/start-template-workout";

describe("buildTemplateWorkoutExercises", () => {
  it("keeps weight semantics and applies separated previous history per exercise", () => {
    const exercises = buildTemplateWorkoutExercises(
      [
        { id: "bench", name: "Bench Press" },
        { id: "row", name: "Row" },
      ],
      {
        resolveName: (id, fallback) =>
          id === "bench" ? "Localized Bench" : fallback,
        previousById: {
          bench: {
            warmup: "20×10",
            working: [
              { setNumber: 1, display: "40×10" },
              { setNumber: 2, display: "40×10" },
              { setNumber: 3, display: "40×10" },
            ],
          },
        },
      }
    );

    expect(exercises).toHaveLength(2);
    expect(exercises[0]).toMatchObject({
      id: "bench",
      name: "Localized Bench",
      exerciseType: "weight",
    });
    expect(exercises[0]?.sets.map((set) => set.type)).toEqual([
      "warmup",
      "working",
      "working",
      "working",
    ]);
    expect(exercises[0]?.sets.map((set) => set.previousDisplay)).toEqual([
      "20×10",
      "40×10",
      "40×10",
      "40×10",
    ]);
    expect(exercises[1]?.sets.map((set) => set.previousDisplay)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});
