const mockFetchCalendarEntries = jest.fn();

jest.mock("@/lib/api/workouts", () => ({
  fetchCalendarEntries: (...args: unknown[]) =>
    mockFetchCalendarEntries(...args),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: () => "Workout",
  })),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { PropsWithChildren } from "react";

import { useCalendarEntries } from "@/hooks/use-calendar-entries";
import { calendarKeys } from "@/lib/query-keys";

const activeQueryClients: QueryClient[] = [];

function createHarness(
  initialData?: { id: string; name: string | null; completed_at: string }[]
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { gcTime: Infinity, retry: false },
    },
  });
  activeQueryClients.push(queryClient);

  if (initialData) {
    queryClient.setQueryData(calendarKeys.entries(), initialData);
  }

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { queryClient, Wrapper };
}

describe("useCalendarEntries refresh", () => {
  afterEach(() => {
    for (const client of activeQueryClients.splice(0)) {
      client.clear();
    }
    jest.clearAllMocks();
  });

  it("updates month entries after a successful refetch", async () => {
    const completedAt = new Date().toISOString();
    const { Wrapper } = createHarness([
      {
        id: "session-1",
        name: "Push day",
        completed_at: completedAt,
      },
    ]);

    mockFetchCalendarEntries.mockResolvedValueOnce([
      {
        id: "session-2",
        name: "Pull day",
        completed_at: completedAt,
      },
    ]);

    const { result } = renderHook(() => useCalendarEntries(), {
      wrapper: Wrapper,
    });

    const now = new Date();
    expect(
      result.current
        .getEntriesForMonth(now.getFullYear(), now.getMonth() + 1)
        .flatMap((entry) => entry.sessions.map((s) => s.title))
    ).toEqual(["Push day"]);

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(
        result.current
          .getEntriesForMonth(now.getFullYear(), now.getMonth() + 1)
          .flatMap((entry) => entry.sessions.map((s) => s.title))
      ).toEqual(["Pull day"]);
    });
  });

  it("keeps previous entries when refetch fails", async () => {
    const completedAt = new Date().toISOString();
    const { Wrapper } = createHarness([
      {
        id: "session-1",
        name: "Push day",
        completed_at: completedAt,
      },
    ]);

    mockFetchCalendarEntries.mockRejectedValueOnce(new Error("network"));

    const { result } = renderHook(() => useCalendarEntries(), {
      wrapper: Wrapper,
    });

    const now = new Date();
    const before = result.current.getEntriesForMonth(
      now.getFullYear(),
      now.getMonth() + 1
    );

    await act(async () => {
      await result.current.refetch();
    });

    expect(
      result.current.getEntriesForMonth(now.getFullYear(), now.getMonth() + 1)
    ).toEqual(before);
    expect(
      before.flatMap((entry) => entry.sessions.map((s) => s.title))
    ).toEqual(["Push day"]);
  });
});
