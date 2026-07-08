jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#111111"),
}));

const mockDismiss = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    dismiss: mockDismiss,
  })),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/history/muscle-distribution-card", () => ({
  MuscleDistributionCard: () => null,
}));

jest.mock("@/components/workout/heart-rate-chart", () => ({
  HeartRateChart: () => null,
}));

jest.mock("@/components/ui/icon-symbol", () => {
  const React = require("react");
  const { Text } = require("react-native");

  return {
    IconSymbol: ({ name }: { name: string }) =>
      React.createElement(Text, null, name),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) => React.createElement(View, { style }, children),
    useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
  };
});

const mockSummary = {
  workoutName: "Push day",
  warmup: null,
  durationMs: 54 * 60 * 1000,
  finishedAtMs: new Date("2026-07-07T18:30:00.000Z").getTime(),
  exercises: [
    {
      id: "bench",
      name: "Bench Press",
      exerciseType: "weight" as const,
      restDurationSeconds: 120,
      notes: "",
      difficultyFeedback: null,
      sets: [
        {
          id: "set-1",
          type: "working" as const,
          kg: "80",
          reps: "8",
          durationSeconds: null,
          rpe: null,
          isCompleted: true,
          previousDisplay: null,
        },
      ],
    },
  ],
};

const mockClearWorkout = jest.fn();
const mockSetExerciseDifficultyFeedback = jest.fn();
jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: (selector: (state: unknown) => unknown) =>
    selector({
      completedWorkoutSummary: mockSummary,
      clearWorkout: mockClearWorkout,
      setExerciseDifficultyFeedback: mockSetExerciseDifficultyFeedback,
    }),
}));

const mockAddTemplate = jest.fn();
jest.mock("@/stores/workout-templates-store", () => ({
  useWorkoutTemplatesStore: (selector: (state: unknown) => unknown) =>
    selector({ addTemplate: mockAddTemplate }),
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (selector: (state: unknown) => unknown) =>
    selector({ goal: "build_strength", customGoal: null }),
}));

const mockSaveWorkoutMutate = jest.fn();
jest.mock("@/hooks/use-workout-mutations", () => ({
  useSaveCompletedWorkout: () => ({
    data: null,
    isSuccess: false,
    mutate: mockSaveWorkoutMutate,
  }),
}));

jest.mock("@/hooks/use-workout-session-comments", () => ({
  useCreateWorkoutSessionComment: () => ({
    isPending: false,
    mutateAsync: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: () => ({
    unit: "kg",
    label: "kg",
    convert: (kg: number) => kg,
    format: (kg: number) => `${kg}kg`,
    formatVolume: (kg: number) => `${Math.round((kg / 1000) * 10) / 10}t`,
  }),
}));

jest.mock("@/hooks/use-exercise-muscles", () => ({
  useExerciseMuscles: () => ({
    isLoading: false,
    primaryMusclesByExerciseId: {},
  }),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useCatalogLabels: () => ({ labelMaps: { muscle: new Map() } }),
  useLocalizedExerciseMap: () => ({
    exerciseMap: new Map([["bench", { name: "Barbell Bench Press" }]]),
  }),
}));

jest.mock("@/hooks/use-workout-stats", () => ({
  useWorkoutStats: () => ({
    isLoading: false,
    streakWeeks: 2,
    totalWorkouts: 4,
  }),
}));

jest.mock("@/hooks/use-heart-rate-samples", () => ({
  useHeartRateSamples: () => ({ data: undefined }),
}));

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

import "@/i18n";

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

import WorkoutSummaryScreen from "../workout-summary";

const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
const mockedSharing = Sharing as jest.Mocked<typeof Sharing>;
const mockedCaptureRef = captureRef as jest.MockedFunction<typeof captureRef>;

beforeEach(() => {
  jest.clearAllMocks();
  mockedSharing.isAvailableAsync.mockResolvedValue(true);
  mockedSharing.shareAsync.mockResolvedValue(undefined);
  mockedCaptureRef.mockResolvedValue("file://workout-share.png");
});

describe("WorkoutSummaryScreen share action", () => {
  it("captures the share story and opens the native share sheet", async () => {
    render(<WorkoutSummaryScreen />);

    fireEvent.press(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(mockedCaptureRef).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          format: "png",
          height: 1920,
          result: "tmpfile",
          width: 1080,
        })
      );
      expect(mockedSharing.shareAsync).toHaveBeenCalledWith(
        "file://workout-share.png",
        expect.objectContaining({
          mimeType: "image/png",
        })
      );
    });
  });

  it("shows an alert when native sharing is unavailable", async () => {
    mockedSharing.isAvailableAsync.mockResolvedValueOnce(false);

    render(<WorkoutSummaryScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Sharing unavailable",
        "Sharing is not available on this device right now."
      );
      expect(mockedCaptureRef).not.toHaveBeenCalled();
    });
  });

  it("re-enables the share button after capture failure", async () => {
    mockedCaptureRef.mockRejectedValueOnce(new Error("capture failed"));

    render(<WorkoutSummaryScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "Could not share",
        "We could not create the workout image. Try again."
      );
    });

    expect(screen.getByRole("button", { name: "Share" })).not.toBeDisabled();
  });
});
