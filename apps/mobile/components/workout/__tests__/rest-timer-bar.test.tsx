jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/lib/api/exercises", () => ({
  fetchExercises: jest.fn(() => Promise.resolve([])),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => false);
  // Keep timed animations pending so exit animations can be observed.
  Reanimated.withTiming = jest.fn((toValue) => toValue);
  return Reanimated;
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const mockGesture = {
    onChange: jest.fn(),
    onEnd: jest.fn(),
  };
  mockGesture.onChange.mockReturnValue(mockGesture);
  mockGesture.onEnd.mockReturnValue(mockGesture);

  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pan: jest.fn(() => mockGesture),
    },
  };
});

jest.mock("@/lib/rest-timer-sound", () => ({
  playRestTimerCompleteSound: jest.fn(),
}));

jest.mock("@/lib/rest-timer-notifications", () => ({
  cancelScheduledRestTimerNotification: jest.fn(() => Promise.resolve()),
  scheduleRestTimerCompletionNotification: jest.fn(() =>
    Promise.resolve("scheduled")
  ),
}));

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  cancelScheduledRestTimerNotification,
  scheduleRestTimerCompletionNotification,
} from "@/lib/rest-timer-notifications";
import { playRestTimerCompleteSound } from "@/lib/rest-timer-sound";
import { getRestTimerProgress, RestTimerBar } from "../rest-timer-bar";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";

const startedAtMs = new Date("2026-06-03T10:00:00.000Z").getTime();

const exercise: WorkoutExercise = {
  id: "bench-press",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "",
  difficultyFeedback: null,
  progressionType: "new_exercise",
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "80",
      reps: "5",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: null,
    },
  ],
};

function getProgressbar() {
  return screen.UNSAFE_getByProps({ accessibilityRole: "progressbar" });
}

function getProgressFillWidth(): string {
  const progressbar = getProgressbar();
  const fill = progressbar.children[0];

  if (typeof fill === "string") {
    throw new Error("Expected progress fill element");
  }

  return StyleSheet.flatten(fill.props.style).width;
}

describe("getRestTimerProgress", () => {
  it("decreases progress as rest time counts down", () => {
    expect(getRestTimerProgress(startedAtMs, 120, startedAtMs)).toEqual({
      durationSeconds: 120,
      remainingSeconds: 120,
      progress: 1,
    });

    expect(
      getRestTimerProgress(startedAtMs, 120, startedAtMs + 60_000)
    ).toEqual({
      durationSeconds: 120,
      remainingSeconds: 60,
      progress: 0.5,
    });

    expect(
      getRestTimerProgress(startedAtMs, 120, startedAtMs + 120_000)
    ).toEqual({
      durationSeconds: 120,
      remainingSeconds: 0,
      progress: 0,
    });
  });

  it("keeps progress aligned to remaining time after timer adjustments", () => {
    expect(
      getRestTimerProgress(startedAtMs, 150, startedAtMs + 60_000)
    ).toEqual({
      durationSeconds: 150,
      remainingSeconds: 90,
      progress: 0.6,
    });
  });

  it("clamps edge states before start and for invalid durations", () => {
    expect(getRestTimerProgress(startedAtMs, 120, startedAtMs - 1_000)).toEqual(
      {
        durationSeconds: 120,
        remainingSeconds: 120,
        progress: 1,
      }
    );

    expect(getRestTimerProgress(startedAtMs, 0, startedAtMs)).toEqual({
      durationSeconds: 1,
      remainingSeconds: 1,
      progress: 1,
    });
  });
});

describe("RestTimerBar", () => {
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    dateNowSpy = jest.spyOn(Date, "now").mockReturnValue(startedAtMs);
    useWorkoutStore.getState().clearWorkout();
    useWorkoutStore.getState().startWorkout("Push day", [exercise], undefined);
    useWorkoutStore.getState().startRestTimer("bench-press");
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
    jest.mocked(playRestTimerCompleteSound).mockClear();
    jest.mocked(cancelScheduledRestTimerNotification).mockClear();
    jest.mocked(scheduleRestTimerCompletionNotification).mockReset();
    jest
      .mocked(scheduleRestTimerCompletionNotification)
      .mockResolvedValue("scheduled");
  });

  it("plays the completion sound when rest ends", async () => {
    dateNowSpy.mockReturnValue(startedAtMs + 120_000);

    render(<RestTimerBar />);

    await waitFor(() => {
      expect(playRestTimerCompleteSound).toHaveBeenCalledTimes(1);
    });
    expect(cancelScheduledRestTimerNotification).toHaveBeenCalled();
    expect(useWorkoutStore.getState().restTimer).toBeNull();
  });

  it("schedules a background completion notification when rest starts", async () => {
    render(<RestTimerBar />);

    await waitFor(() => {
      expect(scheduleRestTimerCompletionNotification).toHaveBeenCalledWith({
        channelName: "Rest timer",
        title: "Rest complete",
        body: "Up next: Bench Press, set 1",
        endsAtMs: startedAtMs + 120_000,
      });
    });
  });

  it("schedules a final-set body that does not invent a next exercise", async () => {
    useWorkoutStore.getState().clearWorkout();
    useWorkoutStore.getState().startWorkout(
      "Push day",
      [
        {
          ...exercise,
          sets: [{ ...exercise.sets[0], isCompleted: true }],
        },
      ],
      undefined
    );
    useWorkoutStore.getState().startRestTimer("bench-press");

    render(<RestTimerBar />);

    await waitFor(() => {
      expect(scheduleRestTimerCompletionNotification).toHaveBeenCalledWith({
        channelName: "Rest timer",
        title: "Rest complete",
        body: "All sets done — finish strong!",
        endsAtMs: startedAtMs + 120_000,
      });
    });
  });

  it("shows a permission state when background alert sounds are denied", async () => {
    jest
      .mocked(scheduleRestTimerCompletionNotification)
      .mockResolvedValue("permission-denied");

    render(<RestTimerBar />);

    expect(
      await screen.findByText(
        "Enable notification sounds to hear rest timer alerts in the background."
      )
    ).toBeTruthy();
  });

  it("renders the countdown progress as remaining rest time", () => {
    render(<RestTimerBar />);

    expect(getProgressFillWidth()).toBe("100%");
    expect(getProgressbar().props.accessibilityValue).toEqual({
      min: 0,
      max: 120,
      now: 120,
    });
  });

  it("keeps the expanded sheet mounted when rest ends so it can animate out", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider
          initialMetrics={{
            frame: { x: 0, y: 0, width: 390, height: 844 },
            insets: { top: 47, left: 0, right: 0, bottom: 34 },
          }}
        >
          <RestTimerBar />
        </SafeAreaProvider>
      </QueryClientProvider>
    );

    fireEvent.press(screen.getByLabelText("Expand rest timer"));
    expect(screen.getByText("Skip Rest")).toBeTruthy();

    dateNowSpy.mockReturnValue(startedAtMs + 120_000);

    await waitFor(() => {
      expect(useWorkoutStore.getState().restTimer).toBeNull();
    });

    // The timer is cleared, but the sheet must stay mounted so its exit
    // animation can play instead of disappearing instantly.
    expect(screen.getByText("Skip Rest")).toBeTruthy();
  });
});
