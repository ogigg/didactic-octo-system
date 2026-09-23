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

jest.mock("@/hooks/use-streak-protection", () => ({
  useStreakStatus: () => ({
    data: {
      current_streak_weeks: 3,
      longest_streak_weeks: 6,
      earned_freezes_available: 1,
      pro_freezes_available: 0,
    },
  }),
}));

jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => ({ totalWorkouts: 12, streakWeeks: 3 }),
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

jest.mock("@/stores/workout-store", () => {
  const hook = (selector: (state: typeof mockWorkoutState) => unknown) =>
    selector(mockWorkoutState);
  Object.defineProperty(hook, "persist", {
    value: { hasHydrated: () => true, onFinishHydration: () => () => {} },
  });
  return { useWorkoutStore: hook };
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
    mockAuth = { user: { id: "user-1" }, isInitialized: true };
    mockProfile = { weekly_frequency: "4" };
    mockOnboardingCompleted = true;
    mockQueue = [];
    mockWorkoutState = { isActive: false, workoutName: "", ownerUserId: null };
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
      streak: { weeks: 3, longestWeeks: 6 },
      week: { done: 1, target: 4 },
      trainingTime: { totalWorkouts: 12 },
      next: { state: "empty" },
    });
  });

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

    act(() => emitAppState("active"));

    await waitFor(() => expect(mockSetWidgetSnapshot).toHaveBeenCalledTimes(2));
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
      streak: { weeks: 0 },
    });
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
