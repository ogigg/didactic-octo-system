import {
  getCalendarWeekStartKey,
  getCalendarDateKey,
  getStreakWeekStatuses,
  STREAK_WEEK_STATUSES,
} from "../streak-calendar";

describe("streak calendar week statuses", () => {
  it("uses local Monday boundaries like the calendar entries", () => {
    expect(getCalendarWeekStartKey(new Date(2026, 8, 13, 23, 30))).toBe(
      "2026-09-07"
    );
    expect(getCalendarWeekStartKey(new Date(2026, 8, 14, 0, 0))).toBe(
      "2026-09-14"
    );
  });

  it("puts a Monday 00:30 workout in the same week as its calendar date", () => {
    const completed = new Date(2026, 8, 14, 0, 30);
    expect(getCalendarDateKey(completed)).toBe("2026-09-14");
    const statuses = getStreakWeekStatuses(
      {
        qualifyingCompletedAtDates: [completed.toISOString()],
        protectedWeekStarts: [],
      },
      new Date(2026, 8, 15)
    );
    expect(statuses).toEqual(new Map([["2026-09-14", "active"]]));
  });

  it("keeps week boundaries on Monday through daylight-saving changes", () => {
    const statuses = getStreakWeekStatuses(
      {
        qualifyingCompletedAtDates: [new Date(2026, 2, 23, 12).toISOString()],
        protectedWeekStarts: [],
      },
      new Date(2026, 3, 7)
    );
    expect(statuses).toEqual(
      new Map([
        ["2026-03-23", "active"],
        ["2026-03-30", "ruined"],
      ])
    );
  });

  it("marks protected weeks and the first missed week after each active run", () => {
    const statuses = getStreakWeekStatuses(
      {
        qualifyingCompletedAtDates: [
          "2026-09-01T10:00:00Z",
          "2026-09-15T10:00:00Z",
        ],
        protectedWeekStarts: ["2026-09-21"],
      },
      new Date("2026-10-08T12:00:00Z"),
      false
    );

    expect(statuses).toEqual(
      new Map([
        ["2026-08-31", STREAK_WEEK_STATUSES.active],
        ["2026-09-14", STREAK_WEEK_STATUSES.active],
        ["2026-09-07", STREAK_WEEK_STATUSES.ruined],
        ["2026-09-21", STREAK_WEEK_STATUSES.covered],
        ["2026-09-28", STREAK_WEEK_STATUSES.ruined],
      ])
    );
  });

  it("does not mark the current or future week as ruined", () => {
    const statuses = getStreakWeekStatuses(
      {
        qualifyingCompletedAtDates: ["2026-09-01T10:00:00Z"],
        protectedWeekStarts: [],
      },
      new Date("2026-09-10T12:00:00Z"),
      false
    );

    expect(statuses).toEqual(
      new Map([["2026-08-31", STREAK_WEEK_STATUSES.active]])
    );
  });

  it("marks only one break during a long absence", () => {
    expect(
      getStreakWeekStatuses(
        {
          qualifyingCompletedAtDates: ["2026-09-01T10:00:00Z"],
          protectedWeekStarts: [],
        },
        new Date("2026-11-10T12:00:00Z")
      )
    ).toEqual(
      new Map([
        ["2026-08-31", STREAK_WEEK_STATUSES.active],
        ["2026-09-07", STREAK_WEEK_STATUSES.ruined],
      ])
    );
  });

  it("keeps a preview week intact across a year boundary", () => {
    expect(
      getStreakWeekStatuses(
        {
          qualifyingCompletedAtDates: [],
          protectedWeekStarts: [],
        },
        new Date("2026-12-27T12:00:00Z"),
        true
      )
    ).toEqual(new Map([["2026-12-28", STREAK_WEEK_STATUSES.ruined]]));
  });

  it("adds the next-week preview only when explicitly enabled", () => {
    const data = {
      qualifyingCompletedAtDates: [],
      protectedWeekStarts: [],
    };
    const now = new Date("2026-09-13T12:00:00Z");

    expect(getStreakWeekStatuses(data, now, false)).toEqual(new Map());
    expect(getStreakWeekStatuses(data, now, true)).toEqual(
      new Map([["2026-09-14", STREAK_WEEK_STATUSES.ruined]])
    );
  });
});
