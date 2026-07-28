const mockPush = jest.fn();
const mockRefetch = jest.fn();

let mockCalendarHookState: {
  getEntriesForMonth: (
    year: number,
    month: number
  ) => { date: string; sessions: { id: string; title: string }[] }[];
  isLoading: boolean;
  isRefetching: boolean;
  refetch: typeof mockRefetch;
};

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: jest.fn(() => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#3366FF"),
}));

jest.mock("@/hooks/use-calendar-entries", () => ({
  useCalendarEntries: jest.fn(() => mockCalendarHookState),
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { RefreshControl } from "react-native";

import CalendarScreen from "../calendar";

function dateKeyInCurrentMonth(day: number): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${String(day).padStart(2, "0")}`;
}

describe("CalendarScreen pull-to-refresh", () => {
  const sessionDate = dateKeyInCurrentMonth(15);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockResolvedValue({ data: [], error: null });
    mockCalendarHookState = {
      getEntriesForMonth: (year, month) => {
        const prefix = `${year}-${String(month).padStart(2, "0")}`;
        if (!sessionDate.startsWith(prefix)) return [];
        return [
          {
            date: sessionDate,
            sessions: [{ id: "session-1", title: "Push day" }],
          },
        ];
      },
      isLoading: false,
      isRefetching: false,
      refetch: mockRefetch,
    };
  });

  it("shows existing workout entries and keeps day accessibility labels", () => {
    render(<CalendarScreen />);

    expect(
      screen.getByRole("button", { name: "15, 1 workout: Push day" })
    ).toBeVisible();
  });

  it("shows a native refresh indicator while refetching", () => {
    mockCalendarHookState = {
      ...mockCalendarHookState,
      isRefetching: true,
    };

    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const refreshControl = UNSAFE_getByType(RefreshControl);

    expect(refreshControl.props.refreshing).toBe(true);
  });

  it("shows the refresh indicator immediately while a manual refresh is pending", async () => {
    let resolveRefresh: (() => void) | undefined;
    mockRefetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = () => resolve({ data: [], error: null });
      })
    );

    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const refreshControl = UNSAFE_getByType(RefreshControl);

    let refreshPromise: Promise<void>;
    act(() => {
      refreshPromise = refreshControl.props.onRefresh();
    });

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(true);

    resolveRefresh?.();
    await act(async () => {
      await refreshPromise;
    });

    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
  });

  it("configures a visible spinner color on iOS and Android", () => {
    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const refreshControl = UNSAFE_getByType(RefreshControl);

    expect(refreshControl.props.tintColor).toBe("#3366FF");
    expect(refreshControl.props.colors).toEqual(["#3366FF"]);
    expect(refreshControl.props.progressBackgroundColor).toBe("#3366FF");
  });

  it("refetches calendar data when the user pulls to refresh", async () => {
    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const refreshControl = UNSAFE_getByType(RefreshControl);

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it("avoids starting another refresh while one is already in flight", async () => {
    mockCalendarHookState = {
      ...mockCalendarHookState,
      isRefetching: true,
    };

    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const refreshControl = UNSAFE_getByType(RefreshControl);

    await act(async () => {
      await refreshControl.props.onRefresh();
    });

    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("guards rapid refresh gestures before query state updates", async () => {
    let resolveRefresh: (() => void) | undefined;
    mockRefetch.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = () => resolve({ data: [], error: null });
      })
    );

    const { UNSAFE_getByType } = render(<CalendarScreen />);
    const onRefresh = UNSAFE_getByType(RefreshControl).props.onRefresh;

    const firstRefresh = onRefresh();
    const secondRefresh = onRefresh();

    expect(mockRefetch).toHaveBeenCalledTimes(1);

    resolveRefresh?.();
    await act(async () => {
      await Promise.all([firstRefresh, secondRefresh]);
    });
  });

  it("shows updated entries after a successful refresh", () => {
    const { rerender } = render(<CalendarScreen />);

    expect(
      screen.getByRole("button", { name: "15, 1 workout: Push day" })
    ).toBeVisible();

    mockCalendarHookState = {
      ...mockCalendarHookState,
      getEntriesForMonth: (year, month) => {
        const prefix = `${year}-${String(month).padStart(2, "0")}`;
        if (!sessionDate.startsWith(prefix)) return [];
        return [
          {
            date: sessionDate,
            sessions: [{ id: "session-2", title: "Pull day" }],
          },
        ];
      },
    };

    rerender(<CalendarScreen />);

    expect(
      screen.getByRole("button", { name: "15, 1 workout: Pull day" })
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "15, 1 workout: Push day" })
    ).toBeNull();
  });

  it("preserves existing entries when refresh fails", async () => {
    mockRefetch.mockResolvedValue({
      data: undefined,
      error: new Error("network"),
    });

    const { UNSAFE_getByType } = render(<CalendarScreen />);

    expect(
      screen.getByRole("button", { name: "15, 1 workout: Push day" })
    ).toBeVisible();

    await act(async () => {
      await UNSAFE_getByType(RefreshControl).props.onRefresh();
    });

    expect(
      screen.getByRole("button", { name: "15, 1 workout: Push day" })
    ).toBeVisible();
  });

  it("still navigates to workout detail after refresh wiring", () => {
    render(<CalendarScreen />);

    fireEvent.press(
      screen.getByRole("button", { name: "15, 1 workout: Push day" })
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/workout-detail",
      params: { id: "session-1" },
    });
  });
});
