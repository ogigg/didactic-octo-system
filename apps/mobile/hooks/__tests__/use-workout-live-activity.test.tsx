const mockStartActivity = jest.fn<
  Promise<string | null>,
  [string, LiveActivityState]
>();
const mockUpdateActivity = jest.fn<Promise<void>, [LiveActivityState]>();
const mockEndActivity = jest.fn<
  Promise<void>,
  [{ dismissImmediately?: boolean }?]
>();
const mockAreActivitiesEnabled = jest.fn<Promise<boolean>, []>();

jest.mock("@/modules/workout-live-activity/src", () => ({
  areActivitiesEnabled: () => mockAreActivitiesEnabled(),
  endActivity: (options?: { dismissImmediately?: boolean }) =>
    mockEndActivity(options),
  startActivity: (workoutId: string, state: LiveActivityState) =>
    mockStartActivity(workoutId, state),
  updateActivity: (state: LiveActivityState) => mockUpdateActivity(state),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: () => ({ exerciseMap: new Map() }),
}));

interface MockSet {
  id: string;
  type: "working";
  kg: string;
  reps: string;
  durationSeconds: number | null;
  rpe: number | null;
  isCompleted: boolean;
  previousDisplay: string | null;
}

interface MockExercise {
  id: string;
  occurrenceId: string;
  name: string;
  exerciseType: "weight";
  restDurationSeconds: number;
  notes: string;
  difficultyFeedback: null;
  sets: MockSet[];
}

interface MockState {
  isActive: boolean;
  workoutName: string;
  exercises: MockExercise[];
  startedAtMs: number | null;
  restTimer: {
    exerciseId: string;
    startedAtMs: number;
    durationSeconds: number;
    pausedRemainingSeconds?: number;
  } | null;
}

const mockSet = (id: string, isCompleted = false): MockSet => ({
  id,
  type: "working",
  kg: "80",
  reps: "8",
  durationSeconds: null,
  rpe: null,
  isCompleted,
  previousDisplay: null,
});

const mockExercise = (sets: MockSet[] = [mockSet("set-1")]): MockExercise => ({
  id: "bench-press",
  occurrenceId: "bench-occurrence-1",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 90,
  notes: "",
  difficultyFeedback: null,
  sets,
});

let mockState: MockState;
const mockStoreListeners = new Set<
  (next: MockState, previous: MockState) => void
>();
const mockHydrationListeners = new Set<() => void>();
let mockHydrated = false;

const mockPersist = {
  hasHydrated: () => mockHydrated,
  onFinishHydration: (listener: () => void) => {
    mockHydrationListeners.add(listener);
    return () => mockHydrationListeners.delete(listener);
  },
};

const mockUseWorkoutStore = Object.assign(
  (selector: (state: MockState) => unknown) => selector(mockState),
  {
    getState: () => mockState,
    subscribe: (
      selector: (state: MockState) => MockState,
      listener: (next: MockState, previous: MockState) => void
    ) => {
      let previous = selector(mockState);
      const wrapped = (next: MockState) => {
        const selected = selector(next);
        listener(selected, previous);
        previous = selected;
      };
      mockStoreListeners.add(wrapped);
      return () => mockStoreListeners.delete(wrapped);
    },
    persist: mockPersist,
  }
);

jest.mock("@/stores/workout-store", () => {
  const hook = (selector: (state: MockState) => unknown) =>
    mockUseWorkoutStore(selector);
  Object.defineProperties(hook, {
    getState: { value: () => mockUseWorkoutStore.getState() },
    subscribe: {
      value: (...args: Parameters<typeof mockUseWorkoutStore.subscribe>) =>
        mockUseWorkoutStore.subscribe(...args),
    },
    persist: { get: () => mockPersist },
  });
  return { useWorkoutStore: hook };
});

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AppState, Platform } from "react-native";

import type { LiveActivityState } from "@/modules/workout-live-activity/src";
import { useWorkoutLiveActivity } from "../use-workout-live-activity";

function setMockState(next: Partial<MockState>): void {
  const previous = mockState;
  mockState = { ...mockState, ...next };
  for (const listener of mockStoreListeners) listener(mockState, previous);
}

function finishHydration(): void {
  mockHydrated = true;
  for (const listener of mockHydrationListeners) listener();
  mockHydrationListeners.clear();
}

let appStateListener: ((nextState: string) => void) | null;

describe("useWorkoutLiveActivity", () => {
  beforeEach(() => {
    mockState = {
      isActive: true,
      workoutName: "Push day",
      exercises: [mockExercise()],
      startedAtMs: 1_700_000_000_000,
      restTimer: null,
    };
    mockHydrated = true;
    mockStoreListeners.clear();
    mockHydrationListeners.clear();
    appStateListener = null;

    mockAreActivitiesEnabled.mockResolvedValue(true);
    mockStartActivity.mockResolvedValue("activity-1");
    mockUpdateActivity.mockResolvedValue(undefined);
    mockEndActivity.mockResolvedValue(undefined);
    jest.clearAllMocks();

    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener as (nextState: string) => void;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("starts after persisted hydration and keeps the occurrence ID for widget actions", async () => {
    mockHydrated = false;
    const { unmount } = renderHook(() => useWorkoutLiveActivity());

    expect(mockStartActivity).not.toHaveBeenCalled();
    await act(async () => finishHydration());

    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));
    expect(mockStartActivity.mock.calls[0]?.[1]).toMatchObject({
      exerciseId: "bench-occurrence-1",
      setId: "set-1",
      completedSets: 0,
      totalWorkoutSets: 1,
      isWorkoutComplete: false,
    });
    unmount();
  });

  it("updates on store changes and ends only when the workout becomes inactive", async () => {
    const { unmount } = renderHook(() => useWorkoutLiveActivity());
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));

    await act(async () => {
      setMockState({
        exercises: [mockExercise([{ ...mockSet("set-1"), kg: "85" }])],
      });
    });
    await waitFor(() => expect(mockUpdateActivity).toHaveBeenCalledTimes(1));
    expect(mockUpdateActivity.mock.calls[0]?.[0].setDisplay).toContain("85");

    await act(async () => setMockState({ isActive: false }));
    await waitFor(() => expect(mockEndActivity).toHaveBeenCalledTimes(1));
    expect(mockEndActivity).toHaveBeenCalledWith({ dismissImmediately: true });
    unmount();
  });

  it("does not end or restart when the app backgrounds or the hook unmounts", async () => {
    const { unmount } = renderHook(() => useWorkoutLiveActivity());
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));

    await act(async () => appStateListener?.("background"));
    unmount();

    expect(mockEndActivity).not.toHaveBeenCalled();
    expect(mockStartActivity).toHaveBeenCalledTimes(1);
  });

  it("reconciles the native activity again when returning to the foreground", async () => {
    const { unmount } = renderHook(() => useWorkoutLiveActivity());
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));

    await act(async () => appStateListener?.("active"));
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(2));
    unmount();
  });

  it("retries a native start failure on the next foreground transition", async () => {
    mockStartActivity
      .mockRejectedValueOnce(new Error("ActivityKit request failed"))
      .mockResolvedValueOnce("activity-retry");
    const { unmount } = renderHook(() => useWorkoutLiveActivity());

    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));
    expect(mockUpdateActivity).not.toHaveBeenCalled();

    await act(async () => appStateListener?.("active"));
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(2));
    unmount();
  });

  it("keeps the rest countdown when the next exercise becomes current", async () => {
    const secondExercise = {
      ...mockExercise([mockSet("second-set")]),
      id: "incline-press",
      occurrenceId: "incline-occurrence-1",
      name: "Incline Press",
    };
    mockState.exercises = [mockExercise([mockSet("set-1")]), secondExercise];
    const { unmount } = renderHook(() => useWorkoutLiveActivity());
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));

    await act(async () => {
      setMockState({
        exercises: [mockExercise([mockSet("set-1", true)]), secondExercise],
        restTimer: {
          exerciseId: "bench-occurrence-1",
          startedAtMs: 1_700_000_010_000,
          durationSeconds: 90,
        },
      });
    });

    await waitFor(() => expect(mockUpdateActivity).toHaveBeenCalledTimes(1));
    expect(mockUpdateActivity.mock.calls[0]?.[0]).toMatchObject({
      exerciseId: "incline-occurrence-1",
      completedSets: 1,
      totalWorkoutSets: 2,
      restStartedAtMs: 1_700_000_010_000,
      restEndsAtMs: 1_700_000_100_000,
    });
    unmount();
  });

  it("publishes a terminal state instead of leaving the final set stale", async () => {
    const { unmount } = renderHook(() => useWorkoutLiveActivity());
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));

    await act(async () => {
      setMockState({
        exercises: [mockExercise([mockSet("set-1", true)])],
      });
    });
    await waitFor(() => expect(mockUpdateActivity).toHaveBeenCalledTimes(1));
    expect(mockUpdateActivity.mock.calls[0]?.[0]).toMatchObject({
      setId: "set-1",
      completedSets: 1,
      totalWorkoutSets: 1,
      isWorkoutComplete: true,
      restStartedAtMs: null,
      restEndsAtMs: null,
    });
    expect(mockEndActivity).not.toHaveBeenCalled();
    unmount();
  });

  it("cleans up a lingering native activity when hydration restores no workout", async () => {
    mockState.isActive = false;
    const { unmount } = renderHook(() => useWorkoutLiveActivity());

    await waitFor(() => expect(mockEndActivity).toHaveBeenCalledTimes(1));
    expect(mockEndActivity).toHaveBeenCalledWith({ dismissImmediately: true });
    unmount();
  });

  it("retries inactive cleanup after a native end failure on foreground", async () => {
    mockState.isActive = false;
    mockEndActivity
      .mockRejectedValueOnce(new Error("ActivityKit end failed"))
      .mockResolvedValueOnce(undefined);
    const { unmount } = renderHook(() => useWorkoutLiveActivity());

    await waitFor(() => expect(mockEndActivity).toHaveBeenCalledTimes(1));
    await act(async () => appStateListener?.("active"));
    await waitFor(() => expect(mockEndActivity).toHaveBeenCalledTimes(2));
    unmount();
  });

  it("ends stale content while active with no sets, then starts when sets are added", async () => {
    mockState.exercises = [];
    const { unmount } = renderHook(() => useWorkoutLiveActivity());

    await waitFor(() => expect(mockEndActivity).toHaveBeenCalledTimes(1));
    expect(mockStartActivity).not.toHaveBeenCalled();

    await act(async () => setMockState({ exercises: [mockExercise()] }));
    await waitFor(() => expect(mockStartActivity).toHaveBeenCalledTimes(1));
    unmount();
  });
});
