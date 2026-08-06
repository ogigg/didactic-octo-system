import { applyPendingExerciseSwap } from "@/lib/pending-exercise-swap";

describe("applyPendingExerciseSwap", () => {
  it("clears previous_display and progression_type so old history cannot leak", () => {
    const swapped = applyPendingExerciseSwap(
      {
        exercise_id: "old-id",
        exercise_name: "Old Press",
        exercise_type: "weight",
        rest_duration_seconds: 90,
        notes: null,
        reasoning: { muscle_groups: "chest", exercise_selection: "compound" },
        previous_display: "40×10",
        progression_type: "weight_up",
        sets: [
          {
            set_type: "warmup",
            target_load_kg: 20,
            target_reps: 10,
            target_duration_seconds: null,
          },
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 10,
            target_duration_seconds: null,
          },
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 10,
            target_duration_seconds: null,
          },
        ],
      },
      {
        id: "new-id",
        name: "New Press",
        exerciseType: "weight",
        image: null,
      }
    );

    expect(swapped.exercise_id).toBe("new-id");
    expect(swapped.exercise_name).toBe("New Press");
    expect(swapped.previous_display).toBeNull();
    expect(swapped.progression_type).toBeNull();
    expect(swapped.reasoning).toBeNull();
    expect(swapped.sets.map((set) => set.set_type)).toEqual([
      "warmup",
      "working",
      "working",
    ]);
  });

  it("strips warmup when swapping to a time exercise while preserving working count", () => {
    const swapped = applyPendingExerciseSwap(
      {
        exercise_id: "bench",
        exercise_name: "Bench",
        exercise_type: "weight",
        rest_duration_seconds: 90,
        notes: null,
        previous_display: "40×10",
        progression_type: "maintained",
        sets: [
          {
            set_type: "warmup",
            target_load_kg: 20,
            target_reps: 10,
          },
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 10,
          },
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 10,
          },
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 10,
          },
        ],
      },
      {
        id: "plank",
        name: "Plank",
        exerciseType: "time",
      }
    );

    expect(swapped.exercise_type).toBe("time");
    expect(swapped.previous_display).toBeNull();
    expect(swapped.progression_type).toBeNull();
    expect(swapped.sets.map((set) => set.set_type)).toEqual([
      "working",
      "working",
      "working",
    ]);
  });
});
