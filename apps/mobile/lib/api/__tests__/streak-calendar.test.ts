jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { fetchStreakCalendarData } from "../streak-calendar";

function queryResult(
  data: unknown[],
  error: { message: string } | null = null
) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockResolvedValue({ data, error }),
  };
}

const from = "2026-08-01T00:00:00.000Z";
const to = "2026-09-13T12:00:00.000Z";

describe("streak calendar data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
  });

  it("requires completed sets and only includes applied protection events", async () => {
    const sessions = queryResult([
      { id: "session-1", completed_at: "2026-09-01T10:00:00Z" },
    ]);
    const events = queryResult([
      { event_type: "earned_freeze_used", covered_week_start: "2026-09-07" },
    ]);
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(sessions)
      .mockReturnValueOnce(events);

    await expect(fetchStreakCalendarData(from, to)).resolves.toEqual({
      qualifyingCompletedAtDates: ["2026-09-01T10:00:00Z"],
      protectedWeekStarts: ["2026-09-07"],
    });
    expect(sessions.eq).toHaveBeenCalledWith("status", "completed");
    expect(sessions.eq).toHaveBeenCalledWith(
      "session_exercises.session_sets.set_logs.completed",
      true
    );
    expect(events.in).toHaveBeenCalledWith("event_type", [
      "lifetime_rescue_used",
      "earned_freeze_used",
      "pro_freeze_used",
      "pro_auto_freeze_used",
    ]);
  });

  it("rejects a partial result rather than mislabeling covered weeks as broken", async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(queryResult([], { message: "Network error" }));

    await expect(fetchStreakCalendarData(from, to)).rejects.toThrow(
      "Network error"
    );
  });

  it("rejects malformed external protection data", async () => {
    (supabase.from as jest.Mock)
      .mockReturnValueOnce(queryResult([]))
      .mockReturnValueOnce(
        queryResult([
          { event_type: "earned_freeze_granted", covered_week_start: null },
        ])
      );

    await expect(fetchStreakCalendarData(from, to)).rejects.toThrow();
  });
});
