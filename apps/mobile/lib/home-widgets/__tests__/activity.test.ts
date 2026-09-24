import { buildWeeklyMinutes, getWindowStart } from "@/lib/weekly-activity";

import { buildActivityDays, countSessionsInWindow } from "../activity";

// Wednesday 23 September 2026, 12:00 local time.
const NOW = new Date(2026, 8, 23, 12, 0, 0);

// ISO strings without an offset are parsed as local time, which keeps these
// tests independent of the machine's time zone.

describe("getWindowStart", () => {
  it("returns the local Monday that opens a window ending this week", () => {
    expect(getWindowStart(NOW, 1)).toEqual(new Date(2026, 8, 21));
    expect(getWindowStart(NOW, 12)).toEqual(new Date(2026, 6, 6));
  });
});

describe("buildActivityDays", () => {
  it("covers full Monday–Sunday weeks ending with the current week", () => {
    const days = buildActivityDays([], NOW, 12);

    expect(days).toHaveLength(84);
    expect(days[0]?.date).toBe("2026-07-06");
    expect(days[days.length - 1]?.date).toBe("2026-09-27");
  });

  it("marks local days that have a completed session", () => {
    const days = buildActivityDays(
      ["2026-09-21T07:30:00", "2026-09-21T19:00:00", "2026-09-23T06:15:00"],
      NOW,
      1
    );

    expect(days.map((day) => day.trained)).toEqual([
      true,
      false,
      true,
      false,
      false,
      false,
      false,
    ]);
  });

  it("ignores unparseable dates", () => {
    const days = buildActivityDays(["not-a-date"], NOW, 1);
    expect(days.every((day) => !day.trained)).toBe(true);
  });
});

describe("countSessionsInWindow", () => {
  it("counts sessions from the window's Monday up to now", () => {
    const completedAt = [
      "2026-09-20T18:00:00", // previous Sunday
      "2026-09-21T07:30:00",
      "2026-09-21T19:00:00",
      "2026-09-23T11:00:00",
    ];

    expect(countSessionsInWindow(completedAt, NOW, 1)).toBe(3);
    expect(countSessionsInWindow(completedAt, NOW, 2)).toBe(4);
  });
});

describe("buildWeeklyMinutes", () => {
  it("sums session minutes per local week, oldest first", () => {
    const weeks = buildWeeklyMinutes(
      [
        {
          started_at: "2026-09-14T08:00:00",
          completed_at: "2026-09-14T08:45:20",
        },
        {
          started_at: "2026-09-21T08:00:00",
          completed_at: "2026-09-21T08:50:00",
        },
        {
          started_at: "2026-09-23T07:00:00",
          completed_at: "2026-09-23T07:47:00",
        },
      ],
      NOW,
      8
    );

    expect(weeks).toHaveLength(8);
    expect(weeks[0]?.weekStart).toBe("2026-08-03");
    expect(weeks[6]).toEqual({ weekStart: "2026-09-14", minutes: 45 });
    expect(weeks[7]).toEqual({ weekStart: "2026-09-21", minutes: 97 });
  });

  it("skips invalid durations and sessions outside the window", () => {
    const weeks = buildWeeklyMinutes(
      [
        {
          started_at: "2026-09-21T09:00:00",
          completed_at: "2026-09-21T08:00:00",
        },
        {
          started_at: "2026-01-05T08:00:00",
          completed_at: "2026-01-05T09:00:00",
        },
      ],
      NOW,
      8
    );

    expect(weeks.every((week) => week.minutes === 0)).toBe(true);
  });
});
