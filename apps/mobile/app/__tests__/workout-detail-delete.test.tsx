const mockRouterBack = jest.fn();
const mockDeleteWorkout = jest.fn();
const mockShowSuccess = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ id: "workout-session-id" })),
  useRouter: jest.fn(() => ({ back: mockRouterBack })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    i18n: { language: "en", resolvedLanguage: "en" },
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  })),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Error: "error",
    Success: "success",
    Warning: "warning",
  },
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/stores/toast-store", () => ({
  useToastStore: jest.fn(
    (selector: (state: { showSuccess: typeof mockShowSuccess }) => unknown) =>
      selector({ showSuccess: mockShowSuccess })
  ),
}));

jest.mock("@/lib/workout-deletion-logger", () => ({
  logWorkoutDeletionError: jest.fn(),
  logWorkoutDeletionTrace: jest.fn(),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: jest.fn(() => ({
    formatSpaced: (value: number) => `${value} kg`,
  })),
}));

jest.mock("@/hooks/use-workout-mutations", () => ({
  useDeleteSessionExercise: jest.fn(() => ({
    isPending: false,
    mutate: jest.fn(),
  })),
  useDeleteWorkoutSession: jest.fn(() => ({
    isPending: false,
    mutate: mockDeleteWorkout,
  })),
}));

jest.mock("@/hooks/use-workout-queries", () => ({
  useWorkoutDetail: jest.fn(() => ({
    isLoading: false,
    data: {
      id: "workout-session-id",
      name: "Push day",
      status: "completed",
      generation_source: "llm",
      goal_snapshot: "build_strength",
      started_at: "2026-07-28T10:00:00.000Z",
      completed_at: "2026-07-28T11:00:00.000Z",
      created_at: "2026-07-28T10:00:00.000Z",
      warmup: null,
      exercises: [],
    },
  })),
}));

jest.mock("@/hooks/use-workout-session-comments", () => ({
  useCommentsForSession: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/use-heart-rate-samples", () => ({
  useHeartRateSamples: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({ exerciseMap: new Map() })),
  useCatalogLabels: jest.fn(() => ({
    labelMaps: { muscle: new Map() },
  })),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/history/muscle-distribution-card", () => ({
  MuscleDistributionCard: () => null,
}));

jest.mock("@/components/ui/back-button", () => ({
  BackButton: () => null,
}));

jest.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";

import WorkoutDetailScreen from "../workout-detail";

const alertSpy = jest.spyOn(Alert, "alert");

describe("WorkoutDetailScreen workout deletion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requires destructive confirmation before deleting the workout", () => {
    render(<WorkoutDetailScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "detail.deleteWorkout.accessibilityLabel",
      })
    );

    expect(mockDeleteWorkout).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      "detail.deleteWorkout.confirmTitle",
      expect.stringContaining('"workoutName":"Push day"'),
      expect.any(Array)
    );

    const buttons = alertSpy.mock.calls.at(-1)?.[2] as {
      style?: string;
      onPress?: () => void;
    }[];
    const confirmButton = buttons.find(
      (button) => button.style === "destructive"
    );

    act(() => {
      confirmButton?.onPress?.();
    });

    expect(mockDeleteWorkout).toHaveBeenCalledWith(
      "workout-session-id",
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      })
    );
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("warning");

    const mutationOptions = mockDeleteWorkout.mock.calls[0]?.[1] as {
      onSuccess: () => void;
    };
    act(() => {
      mutationOptions.onSuccess();
    });

    expect(mockRouterBack).toHaveBeenCalledTimes(1);
    expect(Haptics.notificationAsync).toHaveBeenCalledWith("success");
    expect(mockShowSuccess).toHaveBeenCalledWith(
      "detail.deleteWorkout.success"
    );
  });
});
