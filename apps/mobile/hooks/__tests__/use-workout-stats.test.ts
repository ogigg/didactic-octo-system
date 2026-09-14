jest.mock("@/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("@/hooks/use-streak-protection", () => ({
  useStreakStatus: jest.fn(),
}));

import { computeStreakWeeks, resolveStreakWeeks } from "../use-workout-stats";

// Thursday 2026-07-09 12:00 UTC; the current ISO week starts Monday 2026-07-06.
const now = new Date("2026-07-09T12:00:00Z");

describe("computeStreakWeeks", () => {
  it("returns zero without any completed workouts", () => {
    expect(computeStreakWeeks([], undefined, now)).toBe(0);
  });

  it("counts consecutive weeks ending in the current week", () => {
    expect(
      computeStreakWeeks(
        [
          "2026-07-07T09:00:00Z",
          "2026-06-30T09:00:00Z",
          "2026-06-24T09:00:00Z",
        ],
        undefined,
        now
      )
    ).toBe(3);
  });

  it("keeps last week's streak alive when this week has no workout yet", () => {
    expect(
      computeStreakWeeks(
        ["2026-06-30T09:00:00Z", "2026-06-24T09:00:00Z"],
        undefined,
        now
      )
    ).toBe(2);
  });

  it("breaks the streak after a missed week", () => {
    expect(
      computeStreakWeeks(
        ["2026-07-07T09:00:00Z", "2026-06-17T09:00:00Z"],
        undefined,
        now
      )
    ).toBe(1);
  });

  it("returns zero when the last workout is two or more weeks old", () => {
    expect(computeStreakWeeks(["2026-06-17T09:00:00Z"], undefined, now)).toBe(
      0
    );
  });

  it("counts several workouts in one week only once", () => {
    expect(
      computeStreakWeeks(
        ["2026-07-06T09:00:00Z", "2026-07-08T09:00:00Z"],
        undefined,
        now
      )
    ).toBe(1);
  });

  it("includes a workout that just finished but is not saved yet", () => {
    expect(
      computeStreakWeeks(
        ["2026-06-30T09:00:00Z"],
        Date.parse("2026-07-09T11:30:00Z"),
        now
      )
    ).toBe(2);
  });

  it("ignores empty date strings from partially synced rows", () => {
    expect(
      computeStreakWeeks(["", "2026-07-07T09:00:00Z"], undefined, now)
    ).toBe(1);
  });
});

describe("resolveStreakWeeks", () => {
  it("prefers the server streak, which applies freezes and restarts", () => {
    expect(
      resolveStreakWeeks({
        protectedStreak: 6,
        localStreak: 2,
        hasJustFinishedWorkout: false,
      })
    ).toBe(6);
    expect(
      resolveStreakWeeks({
        protectedStreak: 0,
        localStreak: 4,
        hasJustFinishedWorkout: false,
      })
    ).toBe(0);
  });

  it("falls back to the local streak while the server value is unavailable", () => {
    expect(
      resolveStreakWeeks({
        protectedStreak: null,
        localStreak: 3,
        hasJustFinishedWorkout: false,
      })
    ).toBe(3);
    expect(
      resolveStreakWeeks({
        protectedStreak: null,
        localStreak: null,
        hasJustFinishedWorkout: false,
      })
    ).toBeNull();
  });

  it("lets a just-finished workout count before the server catches up", () => {
    expect(
      resolveStreakWeeks({
        protectedStreak: 4,
        localStreak: 5,
        hasJustFinishedWorkout: true,
      })
    ).toBe(5);
    expect(
      resolveStreakWeeks({
        protectedStreak: 7,
        localStreak: 1,
        hasJustFinishedWorkout: true,
      })
    ).toBe(7);
  });
});
