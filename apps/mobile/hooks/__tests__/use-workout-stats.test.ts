const mockFrom = jest.fn();
const mockUseStreakStatus = jest.fn();

jest.mock("@/lib/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));
jest.mock("@/hooks/use-streak-protection", () => ({
  useStreakStatus: () => mockUseStreakStatus(),
}));
jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { createElement, type PropsWithChildren } from "react";

import {
  computeStreakWeeks,
  resolveStreakWeeks,
  useWorkoutStats,
} from "../use-workout-stats";

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

interface SupabaseResult<T> {
  data?: T;
  count?: number | null;
  error: { message: string } | null;
}

function mockWorkoutSessions(
  countResult: SupabaseResult<null>,
  datesResult: SupabaseResult<{ completed_at: string }[]>
) {
  mockFrom.mockImplementation(() => ({
    select: (_columns: string, options?: { head?: boolean }) =>
      options?.head
        ? { eq: () => Promise.resolve(countResult) }
        : {
            eq: () => ({
              not: () => ({ order: () => Promise.resolve(datesResult) }),
            }),
          },
  }));
}

// The workout-stats query never settles, so it stays loading.
function mockPendingWorkoutSessions() {
  const pending = new Promise<never>(() => {});
  mockFrom.mockImplementation(() => ({
    select: (_columns: string, options?: { head?: boolean }) =>
      options?.head
        ? { eq: () => pending }
        : { eq: () => ({ not: () => ({ order: () => pending }) }) },
  }));
}

const activeQueryClients: QueryClient[] = [];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, retry: false } },
  });
  activeQueryClients.push(queryClient);

  return function Wrapper({ children }: PropsWithChildren) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children
    );
  };
}

describe("useWorkoutStats", () => {
  beforeEach(() => {
    mockUseStreakStatus.mockReturnValue({ data: undefined, isLoading: false });
  });

  afterEach(() => {
    activeQueryClients.splice(0).forEach((client) => client.clear());
    jest.clearAllMocks();
  });

  it("returns a genuine zero when the user has no completed workouts", async () => {
    mockWorkoutSessions({ count: 0, error: null }, { data: [], error: null });

    const { result } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTotalLoading).toBe(false));

    expect(result.current.totalWorkouts).toBe(0);
    expect(result.current.streakWeeks).toBe(0);
  });

  it.each([
    [
      "count",
      { count: null, error: { message: "count failed" } },
      { data: [], error: null },
    ],
    [
      "history",
      { count: 4, error: null },
      { data: undefined, error: { message: "history failed" } },
    ],
  ])(
    "reports a failed %s fetch as unavailable instead of zero",
    async (_name, countResult, datesResult) => {
      mockWorkoutSessions(countResult, datesResult);

      const { result } = renderHook(() => useWorkoutStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isTotalLoading).toBe(false));

      expect(result.current.totalWorkouts).toBeNull();
      expect(result.current.streakWeeks).toBeNull();
    }
  );

  it("still counts a just-finished workout when the history fetch fails", async () => {
    mockWorkoutSessions(
      { count: null, error: { message: "count failed" } },
      { data: undefined, error: { message: "history failed" } }
    );

    const { result } = renderHook(() => useWorkoutStats(Date.now()), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTotalLoading).toBe(false));

    expect(result.current.totalWorkouts).toBeNull();
    expect(result.current.streakWeeks).toBe(1);
  });

  it("reports the count as loaded while the streak is still loading", async () => {
    mockUseStreakStatus.mockReturnValue({ data: undefined, isLoading: true });
    mockWorkoutSessions({ count: 5, error: null }, { data: [], error: null });

    const { result } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTotalLoading).toBe(false));

    expect(result.current.totalWorkouts).toBe(5);
    expect(result.current.isStreakLoading).toBe(true);
  });

  it("shows the server streak while the history is still loading", () => {
    mockUseStreakStatus.mockReturnValue({
      data: { current_streak_weeks: 3 },
      isLoading: false,
    });
    mockPendingWorkoutSessions();

    const { result } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isTotalLoading).toBe(true);
    expect(result.current.isStreakLoading).toBe(false);
    expect(result.current.streakWeeks).toBe(3);
  });

  it("waits for the history when the server has no streak to show", () => {
    mockUseStreakStatus.mockReturnValue({ data: undefined, isLoading: false });
    mockPendingWorkoutSessions();

    const { result } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isStreakLoading).toBe(true);
  });

  it("waits for the history right after a workout, even with a server streak", () => {
    mockUseStreakStatus.mockReturnValue({
      data: { current_streak_weeks: 3 },
      isLoading: false,
    });
    mockPendingWorkoutSessions();

    const { result } = renderHook(() => useWorkoutStats(Date.now()), {
      wrapper: createWrapper(),
    });

    expect(result.current.isStreakLoading).toBe(true);
  });

  it("replaces a failed count with real data after a successful refetch", async () => {
    mockWorkoutSessions(
      { count: null, error: { message: "count failed" } },
      { data: [], error: null }
    );

    const { result } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isTotalLoading).toBe(false));
    expect(result.current.totalWorkouts).toBeNull();

    mockWorkoutSessions({ count: 7, error: null }, { data: [], error: null });
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => expect(result.current.totalWorkouts).toBe(7));
  });

  it("keeps the last good count when a refetch fails", async () => {
    mockWorkoutSessions({ count: 4, error: null }, { data: [], error: null });

    const { result, rerender } = renderHook(() => useWorkoutStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.totalWorkouts).toBe(4));
    const fetchCountBefore = mockFrom.mock.calls.length;

    mockWorkoutSessions(
      { count: null, error: { message: "count failed" } },
      { data: [], error: null }
    );
    await act(async () => {
      await result.current.refetch();
    });
    // Query observers notify on a later tick, so render again to read the
    // settled state instead of the value from before the refetch.
    rerender(undefined);

    expect(mockFrom.mock.calls.length).toBeGreaterThan(fetchCountBefore);
    expect(result.current.totalWorkouts).toBe(4);
    expect(result.current.isTotalLoading).toBe(false);
  });
});
