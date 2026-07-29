jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#111111"),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({
    dismiss: jest.fn(),
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

const mockSetExerciseDifficultyFeedback = jest.fn();
jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: (selector: (state: unknown) => unknown) =>
    selector({
      completedWorkoutSummary: mockSummary,
      clearWorkout: jest.fn(),
      setExerciseDifficultyFeedback: mockSetExerciseDifficultyFeedback,
    }),
}));

jest.mock("@/stores/workout-templates-store", () => ({
  useWorkoutTemplatesStore: (selector: (state: unknown) => unknown) =>
    selector({ addTemplate: jest.fn() }),
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (selector: (state: unknown) => unknown) =>
    selector({ goal: "build_strength", customGoal: null }),
}));

const mockSaveMutate = jest.fn();
const mockUpdateFeedbackMutate = jest.fn();
let mockSaveWorkoutState: {
  data: {
    id: string;
    exerciseOccurrences: {
      exerciseId: string;
      sessionExerciseId: string;
      orderIndex: number;
    }[];
  } | null;
  isSuccess: boolean;
  mutate: typeof mockSaveMutate;
} = {
  data: null,
  isSuccess: false,
  mutate: mockSaveMutate,
};

jest.mock("@/hooks/use-workout-mutations", () => ({
  useSaveCompletedWorkout: () => mockSaveWorkoutState,
  useUpdateExerciseDifficultyFeedback: () => ({
    mutate: mockUpdateFeedbackMutate,
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
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import WorkoutSummaryScreen from "../workout-summary";
import { trackEvent } from "@/lib/track-event";

const SESSION_EXERCISE_ID = "550e8400-e29b-41d4-a716-446655440020";

describe("WorkoutSummaryScreen difficulty feedback persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSummary.exercises[0].difficultyFeedback = null;
    mockSaveWorkoutState = {
      data: null,
      isSuccess: false,
      mutate: mockSaveMutate,
    };
  });

  it("persists later difficulty feedback against the saved session exercise", async () => {
    mockSaveMutate.mockImplementation((_input, options) => {
      mockSaveWorkoutState = {
        data: {
          id: "550e8400-e29b-41d4-a716-446655440010",
          exerciseOccurrences: [
            {
              exerciseId: "bench",
              sessionExerciseId: SESSION_EXERCISE_ID,
              orderIndex: 0,
            },
          ],
        },
        isSuccess: true,
        mutate: mockSaveMutate,
      };
      options?.onSuccess?.(mockSaveWorkoutState.data);
    });

    const { rerender } = render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalled();
      expect(trackEvent).toHaveBeenCalledWith(
        "workout_completed",
        expect.objectContaining({
          occurrence_id: "550e8400-e29b-41d4-a716-446655440010",
        })
      );
    });

    // Re-render so the screen sees the saved session + exercise occurrence map.
    rerender(<WorkoutSummaryScreen />);

    fireEvent.press(screen.getByLabelText("Too Easy"));

    expect(mockSetExerciseDifficultyFeedback).toHaveBeenCalledWith(
      "bench",
      "too_easy"
    );
    expect(mockUpdateFeedbackMutate).toHaveBeenCalledWith(
      {
        sessionExerciseId: SESSION_EXERCISE_ID,
        feedback: "too_easy",
      },
      expect.any(Object)
    );
  });

  it("queues feedback selected before save completes, then persists it", async () => {
    let resolveSave: (() => void) | undefined;
    mockSaveMutate.mockImplementation((_input, options) => {
      // Keep save pending until we explicitly complete it.
      resolveSave = () => {
        mockSaveWorkoutState = {
          data: {
            id: "550e8400-e29b-41d4-a716-446655440010",
            exerciseOccurrences: [
              {
                exerciseId: "bench",
                sessionExerciseId: SESSION_EXERCISE_ID,
                orderIndex: 0,
              },
            ],
          },
          isSuccess: true,
          mutate: mockSaveMutate,
        };
        options?.onSuccess?.(mockSaveWorkoutState.data);
      };
    });

    const { rerender } = render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByLabelText("Too Hard"));
    expect(mockSetExerciseDifficultyFeedback).toHaveBeenCalledWith(
      "bench",
      "too_hard"
    );
    expect(mockUpdateFeedbackMutate).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave?.();
    });
    rerender(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(mockUpdateFeedbackMutate).toHaveBeenCalledWith(
        {
          sessionExerciseId: SESSION_EXERCISE_ID,
          feedback: "too_hard",
        },
        expect.any(Object)
      );
    });
  });

  it("persists only the latest feedback selected before save completes", async () => {
    let resolveSave: (() => void) | undefined;
    mockSaveMutate.mockImplementation((_input, options) => {
      resolveSave = () => {
        mockSaveWorkoutState = {
          data: {
            id: "550e8400-e29b-41d4-a716-446655440010",
            exerciseOccurrences: [
              {
                exerciseId: "bench",
                sessionExerciseId: SESSION_EXERCISE_ID,
                orderIndex: 0,
              },
            ],
          },
          isSuccess: true,
          mutate: mockSaveMutate,
        };
        options?.onSuccess?.(mockSaveWorkoutState.data);
      };
    });

    const { rerender } = render(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(mockSaveMutate).toHaveBeenCalled();
    });

    fireEvent.press(screen.getByLabelText("Too Easy"));
    fireEvent.press(screen.getByLabelText("Too Hard"));

    await act(async () => {
      resolveSave?.();
    });
    rerender(<WorkoutSummaryScreen />);

    await waitFor(() => {
      expect(mockUpdateFeedbackMutate).toHaveBeenCalledTimes(1);
      expect(mockUpdateFeedbackMutate).toHaveBeenCalledWith(
        {
          sessionExerciseId: SESSION_EXERCISE_ID,
          feedback: "too_hard",
        },
        expect.any(Object)
      );
    });
  });
});
