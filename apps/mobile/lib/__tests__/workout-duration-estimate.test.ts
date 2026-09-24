import { estimateWorkoutMinutes } from "../workout-duration-estimate";

function exercise(setCount: number, restSeconds = 90) {
  return {
    rest_duration_seconds: restSeconds,
    sets: Array.from({ length: setCount }, () => ({})),
  };
}

describe("estimateWorkoutMinutes", () => {
  it("counts 45 seconds per set plus the first exercise's rest between sets", () => {
    // 6 sets: 6 × 45 s + 5 × 60 s = 570 s ≈ 10 min
    expect(
      estimateWorkoutMinutes([exercise(3, 60), exercise(3, 120)], null)
    ).toBe(10);
  });

  it("adds the warm-up duration", () => {
    // 4 sets: 4 × 45 s + 3 × 90 s = 450 s, plus 300 s warm-up = 750 s ≈ 13 min
    expect(
      estimateWorkoutMinutes([exercise(4)], { duration_seconds: 300 })
    ).toBe(13);
  });

  it("never returns a negative duration for a workout without sets", () => {
    expect(estimateWorkoutMinutes([], null)).toBe(0);
    expect(estimateWorkoutMinutes([exercise(0)], null)).toBe(0);
  });

  it("treats a missing warm-up like no warm-up", () => {
    expect(estimateWorkoutMinutes([exercise(4)], undefined)).toBe(
      estimateWorkoutMinutes([exercise(4)], null)
    );
  });
});
