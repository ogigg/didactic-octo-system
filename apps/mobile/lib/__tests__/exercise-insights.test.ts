import { getExerciseInsights } from "../exercise-insights";
import type { ExerciseSessionHistory } from "@/lib/api/exercise-detail";

const now = new Date("2026-09-22T12:00:00Z");
function session(
  date: string,
  load = 60,
  reps = 10,
  duration = 30
): ExerciseSessionHistory {
  return {
    date,
    workout_name: "Workout",
    sets: [
      {
        set_number: 1,
        load_kg: load,
        reps,
        duration_seconds: duration,
        rpe: null,
      },
    ],
  };
}

it("compares equal groups of five using per-session averages, not weekly totals", () => {
  const sessions = Array.from({ length: 10 }, (_, i) =>
    session(`2026-09-${String(22 - i).padStart(2, "0")}`, i < 5 ? 60 : 40)
  );
  const result = getExerciseInsights(sessions.reverse(), false, now);
  expect(result.comparison).toEqual({ recent: 600, previous: 400 });
  expect(result.daysSinceLast).toBe(0);
  expect(
    getExerciseInsights(sessions.slice(0, 9), false, now).comparison
  ).toBeNull();
});

it("uses the nearest matching session and the heaviest shared load, including declines", () => {
  const latest = session("2026-09-22", 60, 8);
  latest.sets!.push({ set_number: 2, load_kg: 20, reps: 20, rpe: null });
  const result = getExerciseInsights(
    [
      latest,
      session("2026-09-20", 70),
      session("2026-09-18", 60, 12),
      session("2026-09-01", 60, 6),
    ],
    false,
    now
  );
  expect(result.progress).toMatchObject({
    load: 60,
    recent: 8,
    previous: 12,
    previousDate: "2026-09-18",
  });
});

it("supports timed and zero-load exercises without inventing missing comparisons", () => {
  expect(
    getExerciseInsights(
      [session("2026-09-22", 0, 12), session("2026-09-20", 0, 8)],
      false,
      now
    ).progress
  ).toMatchObject({ load: 0, recent: 12, previous: 8 });
  expect(
    getExerciseInsights(
      [session("2026-09-22", 0, 0, 45), session("2026-09-20", 0, 0, 30)],
      true,
      now
    ).progress
  ).toMatchObject({ load: null, recent: 45, previous: 30 });
  expect(getExerciseInsights([], false, now)).toMatchObject({
    comparison: null,
    progress: null,
    daysSinceLast: null,
  });
});

it("counts unique training days, respects period boundaries, and ignores future or invalid dates", () => {
  const result = getExerciseInsights(
    [
      session("2026-09-21"),
      session("2026-09-21"),
      session("2026-08-24"),
      session("2026-08-23"),
      session("invalid"),
      session("2026-09-23"),
    ],
    false,
    now
  );
  expect(result.activity.map((item) => item.count)).toEqual([2, 3]);
  expect(result.daysSinceLast).toBe(1);
});

it("marks frequency as a minimum when the 50-entry limit cuts off the selected period", () => {
  const result = getExerciseInsights(
    Array.from({ length: 50 }, () => session("2026-09-21")),
    false,
    now
  );
  expect(result.activity).toEqual([
    { period: 30, count: 1, incomplete: true },
    { period: 90, count: 1, incomplete: true },
  ]);
});

it("compares time per session in seconds and preserves zero volume without a percentage baseline", () => {
  const sessions = Array.from({ length: 10 }, (_, index) =>
    session(
      `2026-09-${String(22 - index).padStart(2, "0")}`,
      0,
      10,
      index < 5 ? 45 : 30
    )
  );
  expect(getExerciseInsights(sessions, true, now).comparison).toEqual({
    recent: 45,
    previous: 30,
  });
  expect(getExerciseInsights(sessions, false, now).comparison).toEqual({
    recent: 0,
    previous: 0,
  });
});
