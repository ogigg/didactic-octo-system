jest.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { getExerciseWeekMetrics } from "../exercise-detail";

describe("getExerciseWeekMetrics", () => {
  it("finds weekly set records and uses only 1-10 reps for estimated 1RM", () => {
    const metrics = getExerciseWeekMetrics("2026-06-01", [
      {
        date: "2026-06-01",
        workout_name: "Push",
        sets: [
          {
            set_number: 1,
            load_kg: 100,
            reps: 3,
            duration_seconds: null,
            rpe: 8,
          },
          {
            set_number: 2,
            load_kg: 80,
            reps: 12,
            duration_seconds: null,
            rpe: 9,
          },
        ],
      },
      {
        date: "2026-06-07",
        workout_name: "Push",
        sets: [
          {
            set_number: 1,
            load_kg: 90,
            reps: 8,
            duration_seconds: null,
            rpe: 9,
          },
        ],
      },
      {
        date: "2026-06-08",
        workout_name: "Next week",
        sets: [
          {
            set_number: 1,
            load_kg: 120,
            reps: 5,
            duration_seconds: null,
            rpe: 9,
          },
        ],
      },
    ]);

    expect(metrics.maxWeightKg).toBe(100);
    expect(metrics.maxReps).toBe(12);
    expect(metrics.estimatedOneRepMaxKg).toBeCloseTo(114);
  });
});
