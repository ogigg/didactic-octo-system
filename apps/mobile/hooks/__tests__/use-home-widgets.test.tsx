const mockSetWidgetSnapshot = jest.fn<Promise<void>, [string]>();
const mockClearWidgetSnapshot = jest.fn<Promise<void>, []>();
const mockHasInstalledHomeWidgets = jest.fn<Promise<boolean>, []>();

jest.mock("@/modules/home-widgets/src", () => ({
  setWidgetSnapshot: (json: string) => mockSetWidgetSnapshot(json),
  clearWidgetSnapshot: () => mockClearWidgetSnapshot(),
  hasInstalledHomeWidgets: () => mockHasInstalledHomeWidgets(),
}));

interface MockAuth {
  user: { id: string } | null;
  isInitialized: boolean;
}

let mockAuth: MockAuth;
let mockProfile: { weekly_frequency: string };
let mockOnboardingCompleted: boolean;
let mockQueue: unknown[];
let mockWorkoutState: {
  isActive: boolean;
  workoutName: string;
  ownerUserId: string | null;
};

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: () => ({ data: mockAuth.user ? mockProfile : undefined }),
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (
    selector: (state: { isCompleted: boolean }) => unknown
  ) => selector({ isCompleted: mockOnboardingCompleted }),
}));

jest.mock("@/hooks/use-workout-queue", () => ({
  useWorkoutQueueData: () => ({ queue: mockQueue, isSuccess: true }),
}));

let mockStreakStatus: {
  current_streak_weeks: number;
  longest_streak_weeks: number;
  earned_freezes_available: number;
  pro_freezes_available: number;
  is_pro_active: boolean;
  auto_apply_enabled: boolean;
};

jest.mock("@/hooks/use-streak-protection", () => ({
  useStreakStatus: () => ({ data: mockStreakStatus }),
}));

let mockWorkoutStats: {
  totalWorkouts: number | null;
  streakWeeks: number | null;
  isTotalLoading: boolean;
  isStreakLoading: boolean;
};
jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => mockWorkoutStats,
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: () => ({ exerciseMap: new Map() }),
}));

jest.mock("@/hooks/use-calendar-today", () => ({
  useCalendarToday: () => "2026-09-23",
}));

jest.mock("@/lib/api/streak-calendar", () => ({
  fetchStreakCalendarData: jest.fn(() =>
    Promise.resolve({
      qualifyingCompletedAtDates: [new Date().toISOString()],
      protectedWeekStarts: [],
    })
  ),
}));

jest.mock("@/lib/api/workouts", () => ({
  fetchWeeklyDurations: jest.fn(() => Promise.resolve([])),
  fetchWorkoutHistoryPage: jest.fn(() => Promise.resolve([])),
}));

let mockHydrated: boolean;

jest.mock("@/stores/workout-store", () => {
  const hook = (selector: (state: typeof mockWorkoutState) => unknown) =>
    selector(mockWorkoutState);
  // Like a failed hydration: zustand never reports it as finished.
  Object.defineProperty(hook, "persist", {
    value: {
      hasHydrated: () => mockHydrated,
      onFinishHydration: () => () => {},
    },
  });
  return {
    useWorkoutStore: hook,
    waitForWorkoutStoreHydration: () => Promise.resolve(),
  };
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { AppState } from "react-native";

import type { WidgetSnapshot } from "@/lib/home-widgets/types";

import {
  useHasInstalledHomeWidgets,
  useHomeWidgets,
} from "../use-home-widgets";

let queryClient: QueryClient;
let appStateListeners: ((state: string) => void)[];

function renderUseHomeWidgets() {
  // No garbage-collection timers, so Jest can exit after the run.
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useHomeWidgets(), { wrapper });
}

function publishedSnapshots(): WidgetSnapshot[] {
  return mockSetWidgetSnapshot.mock.calls.map(
    ([json]) => JSON.parse(json) as WidgetSnapshot
  );
}

function emitAppState(state: string) {
  for (const listener of appStateListeners) listener(state);
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("useHomeWidgets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetWidgetSnapshot.mockResolvedValue(undefined);
    mockHydrated = true;
    mockAuth = { user: { id: "user-1" }, isInitialized: true };
    mockProfile = { weekly_frequency: "4" };
    mockOnboardingCompleted = true;
    mockQueue = [];
    mockStreakStatus = {
      current_streak_weeks: 3,
      longest_streak_weeks: 6,
      earned_freezes_available: 1,
      pro_freezes_available: 0,
      is_pro_active: false,
      auto_apply_enabled: true,
    };
    mockWorkoutState = { isActive: false, workoutName: "", ownerUserId: null };
    mockWorkoutStats = {
      totalWorkouts: 12,
      streakWeeks: 3,
      isTotalLoading: false,
      isStreakLoading: false,
    };
    appStateListeners = [];
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListeners.push(listener as (state: string) => void);
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    queryClient?.clear();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("publishes a ready snapshot once the widget data has loaded", async () => {
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    const [snapshot] = publishedSnapshots();
    expect(snapshot).toMatchObject({
      status: "ready",
      week: { done: 1, target: 4 },
      trainingTime: { totalWorkouts: 12 },
      next: { state: "empty" },
    });
    expect(snapshot?.summaries[0]?.streak).toMatchObject({
      weeks: 3,
      longestWeeks: 6,
    });
  });

  it.each([
    ["applies them automatically", true, true, 4],
    ["has auto-apply turned off", true, false, 0],
    ["is not Pro", false, true, 0],
  ])(
    "projects the streak with Pro freezes when the account %s",
    async (_case, isPro, autoApply, weeksAfterMissedWeek) => {
      mockStreakStatus = {
        ...mockStreakStatus,
        earned_freezes_available: 0,
        pro_freezes_available: 1,
        is_pro_active: isPro,
        auto_apply_enabled: autoApply,
      };
      renderUseHomeWidgets();

      await waitFor(() =>
        expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1)
      );
      // This week has a session, so the week after next is the first missed.
      expect(publishedSnapshots()[0]?.summaries[2]?.streak.weeks).toBe(
        weeksAfterMissedWeek
      );
    }
  );

  it("does not republish identical content", async () => {
    const { rerender } = renderUseHomeWidgets();
    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));

    rerender({});
    await wait(400);

    expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1);
  });

  it("republishes on resume so the widget recovers without app changes", async () => {
    renderUseHomeWidgets();
    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    await wait(20);

    act(() => emitAppState("active"));

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2));
    const [first, second] = publishedSnapshots();
    // Rebuilt at publish time, so the snapshot's time is current.
    expect(Date.parse(second!.generatedAt)).toBeGreaterThan(
      Date.parse(first!.generatedAt)
    );
  });

  it("publishes even when the workout store fails to hydrate", async () => {
    mockHydrated = false;
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
  });

  it("ignores a failed publish that newer content already replaced", async () => {
    jest.useFakeTimers();
    let failFirst!: (error: Error) => void;
    mockSetWidgetSnapshot.mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          failFirst = reject;
        })
    );
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const { rerender } = renderUseHomeWidgets();
    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));

    mockOnboardingCompleted = false;
    rerender({});
    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2));
    await act(async () => failFirst(new Error("late failure")));
    // Past the retry delay, then past the publish delay a retry would use.
    await act(async () => {
      jest.advanceTimersByTime(6_000);
    });
    await act(async () => {
      jest.advanceTimersByTime(1_000);
    });

    expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it("retries a failed publish", async () => {
    jest.useFakeTimers();
    mockSetWidgetSnapshot.mockRejectedValueOnce(new Error("App Group missing"));
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    await act(async () => {
      jest.advanceTimersByTime(5_000);
    });

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2));
  });

  it("publishes an in-progress workout", async () => {
    mockWorkoutState = {
      isActive: true,
      workoutName: "Legs B",
      ownerUserId: "user-1",
    };
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    expect(publishedSnapshots()[0]?.next).toMatchObject({
      state: "inProgress",
      title: "Legs B",
      deepLink: "sweaty://workout",
    });
  });

  it("never publishes another account's workout", async () => {
    mockWorkoutState = {
      isActive: true,
      workoutName: "Legs B",
      ownerUserId: "user-2",
    };
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    expect(publishedSnapshots()[0]?.next).toMatchObject({
      state: "empty",
      deepLink: null,
    });
  });

  it("asks users to finish setup while onboarding is incomplete", async () => {
    mockOnboardingCompleted = false;
    renderUseHomeWidgets();

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    expect(publishedSnapshots()[0]).toMatchObject({
      status: "setupRequired",
      message: "Finish setting up in Sweaty",
    });
  });

  it("switches the widgets to a sign-in prompt after sign-out", async () => {
    const { rerender } = renderUseHomeWidgets();
    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));

    mockAuth = { user: null, isInitialized: true };
    rerender({});

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2));
    expect(publishedSnapshots()[1]).toMatchObject({
      status: "signedOut",
      message: "Sign in to Sweaty to see your workouts",
    });
    expect(publishedSnapshots()[1]?.summaries[0]?.streak.weeks).toBe(0);
  });

  it("keeps the previous snapshot until the streak and count finish loading", async () => {
    // Local fallback streak, before the server streak arrives.
    mockWorkoutStats = {
      ...mockWorkoutStats,
      streakWeeks: 1,
      isStreakLoading: true,
    };
    const { rerender } = renderUseHomeWidgets();

    await wait(400);
    expect(mockSetWidgetSnapshot).not.toHaveBeenCalled();

    mockWorkoutStats = {
      ...mockWorkoutStats,
      streakWeeks: 3,
      isStreakLoading: false,
    };
    rerender(undefined);

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(1));
    expect(publishedSnapshots()[0]?.summaries[0]?.streak.weeks).toBe(3);
  });

  it("waits for auth to initialize before publishing", async () => {
    mockAuth = { user: null, isInitialized: false };
    renderUseHomeWidgets();

    await wait(400);

    expect(mockSetWidgetSnapshot).not.toHaveBeenCalled();
  });
});

describe("useHasInstalledHomeWidgets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockClearWidgetSnapshot.mockResolvedValue(undefined);
  });

  it("reports placed widgets and keeps their snapshot", async () => {
    mockHasInstalledHomeWidgets.mockResolvedValue(true);
    const { result } = renderHook(() => useHasInstalledHomeWidgets());

    await waitFor(() => expect(result.current).toBe(true));
    expect(mockClearWidgetSnapshot).not.toHaveBeenCalled();
  });

  it("clears stale data when no widget is placed", async () => {
    mockHasInstalledHomeWidgets.mockResolvedValue(false);
    const { result } = renderHook(() => useHasInstalledHomeWidgets());

    await waitFor(() => expect(mockClearWidgetSnapshot).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
