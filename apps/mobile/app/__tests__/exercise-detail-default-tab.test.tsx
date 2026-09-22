const mockVolumeBarChart = jest.fn((_props: unknown) => null);
const mockUseExerciseDetail = jest.fn();
const mockUseExercise = jest.fn();
const mockUseExercisePreference = jest.fn();
const mockUseSetExercisePreference = jest.fn();
const mockUseRemoveExercisePreference = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ exerciseId: "exercise-1" })),
  useRouter: jest.fn(() => ({ push: jest.fn(), back: jest.fn() })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    i18n: { language: "en", resolvedLanguage: "en" },
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: jest.fn(() => ({
    format: (value: number) => `${value}kg`,
    formatSpaced: (value: number) => `${value} kg`,
  })),
}));

jest.mock("@/hooks/use-exercise-detail-query", () => ({
  useExerciseDetail: (...args: unknown[]) => mockUseExerciseDetail(...args),
  useEditableExerciseHistory: jest.fn(() => ({
    data: [],
    isLoading: false,
  })),
}));

jest.mock("@/hooks/use-workout-mutations", () => ({
  useDeleteSessionExercise: jest.fn(() => ({ mutate: jest.fn() })),
  useUpdateCompletedSessionExerciseSets: jest.fn(() => ({
    mutate: jest.fn(),
  })),
}));

jest.mock("@/stores/toast-store", () => ({
  useToastStore: jest.fn(() => jest.fn()),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useExercise: (...args: unknown[]) => mockUseExercise(...args),
}));

jest.mock("@/hooks/use-exercise-preference-query", () => ({
  useExercisePreference: (...args: unknown[]) =>
    mockUseExercisePreference(...args),
}));

jest.mock("@/hooks/use-exercise-preference-mutations", () => ({
  useSetExercisePreference: () => mockUseSetExercisePreference(),
  useRemoveExercisePreference: () => mockUseRemoveExercisePreference(),
}));

jest.mock("@/components/exercise/exercise-image", () => ({
  ExerciseImage: () => null,
}));

jest.mock("@/components/exercise/exercise-preference-icon", () => ({
  ExercisePreferenceIcon: () => null,
}));

jest.mock("@/components/exercise/exercise-preference-sheet", () => ({
  ExercisePreferenceSheet: () => null,
}));

jest.mock("@/components/history/exercise-history-menu", () => ({
  ExerciseHistoryMenu: () => null,
}));

jest.mock("@/components/history/exercise-history-edit-sheet", () => ({
  ExerciseHistoryEditSheet: () => null,
}));

jest.mock("@/components/stats/volume-bar-chart", () => ({
  VolumeBarChart: (props: unknown) => mockVolumeBarChart(props),
}));

jest.mock("@/components/ui/back-button", () => ({
  BackButton: () => null,
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => true);
  return Reanimated;
});

jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");

  const createChain = () => {
    const chain: Record<string, unknown> = {};
    const method = () => chain;
    chain.runOnJS = method;
    chain.activeOffsetX = method;
    chain.failOffsetY = method;
    chain.onUpdate = method;
    chain.onEnd = method;
    return chain;
  };

  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Gesture: {
      Pan: jest.fn(() => createChain()),
    },
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { useWorkoutStore } from "@/stores/workout-store";

import ExerciseDetailScreen from "../exercise-detail";

const emptyRecords = {
  max_weight_kg: 0,
  max_weight_date: null,
  max_reps: 0,
  max_reps_date: null,
  max_volume_set_kg: 0,
  max_volume_set_date: null,
  est_1rm_kg: null,
  max_rpe: null,
};

const exerciseFixture = {
  id: "exercise-1",
  name: "Barbell Bench Press",
  exercise_type: "weight" as const,
  instructions: "Lower the bar to your chest, then press up.",
  image: null,
  primary_muscles: ["chest"],
  primary_muscle_labels: ["Chest"],
  secondary_muscles: ["triceps"],
  secondary_muscle_labels: ["Triceps"],
};

function mockDetailQuery(options: {
  isLoading?: boolean;
  isError?: boolean;
  sessions?: {
    date: string;
    workout_name: string;
    sets: {
      set_number: number;
      load_kg: number | null;
      reps: number | null;
      rpe: number | null;
    }[];
  }[];
}) {
  const { isLoading = false, isError = false, sessions = [] } = options;

  mockUseExerciseDetail.mockReturnValue({
    data: isLoading
      ? undefined
      : {
          exercise_type: "weight",
          records: emptyRecords,
          volume_weeks: [],
          sessions,
        },
    isLoading,
    isError,
    error: isError ? new Error("failed") : null,
    refetch: jest.fn(),
  });
}

function expectSelectedTab(label: string) {
  expect(screen.getByRole("button", { name: label })).toHaveAccessibilityState({
    selected: true,
  });
}

function expectTabNotSelected(label: string) {
  expect(screen.getByRole("button", { name: label })).toHaveAccessibilityState({
    selected: false,
  });
}

describe("ExerciseDetailScreen default tab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWorkoutStore.setState({ isActive: false, exercises: [] });

    mockUseExercise.mockReturnValue({
      data: exerciseFixture,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    mockUseExercisePreference.mockReturnValue({ data: null });
    mockUseSetExercisePreference.mockReturnValue({ mutate: jest.fn() });
    mockUseRemoveExercisePreference.mockReturnValue({ mutate: jest.fn() });
  });

  it("updates today's chart from checked sets even without historical volume", () => {
    mockDetailQuery({ sessions: [] });
    useWorkoutStore.setState({
      isActive: true,
      weightUnit: "kg",
      exercises: [
        {
          id: "exercise-1",
          name: "Bench",
          exerciseType: "weight",
          notes: "",
          restDurationSeconds: 60,
          difficultyFeedback: null,
          sets: [true, true, false].map((isCompleted, index) => ({
            id: String(index),
            type: "working",
            kg: "20",
            reps: "5",
            durationSeconds: null,
            rpe: null,
            isCompleted,
            previousDisplay: null,
          })),
        },
      ],
    });
    render(<ExerciseDetailScreen />);
    fireEvent.press(screen.getByRole("button", { name: "tabs.overview" }));
    expect(mockVolumeBarChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        today: {
          completed: 200,
          forecast: 300,
          completedSets: 2,
          totalSets: 3,
        },
      })
    );
    act(() =>
      useWorkoutStore.setState((state) => ({
        exercises: state.exercises.map((exercise) => ({
          ...exercise,
          sets: exercise.sets.map((set) => ({ ...set, isCompleted: true })),
        })),
      }))
    );
    expect(mockVolumeBarChart).toHaveBeenLastCalledWith(
      expect.objectContaining({
        today: {
          completed: 300,
          forecast: 300,
          completedSets: 3,
          totalSets: 3,
        },
      })
    );
    act(() => useWorkoutStore.setState({ isActive: false, exercises: [] }));
    expect(screen.getByText("overview.emptyTitle")).toBeTruthy();
  });

  it("defaults to How To when the exercise has no execution history", () => {
    mockDetailQuery({ sessions: [] });

    render(<ExerciseDetailScreen />);

    expectSelectedTab("tabs.howTo");
    expectTabNotSelected("tabs.overview");
    expect(screen.getByText("howTo.instructions")).toBeVisible();
  });

  it("defaults to Overview when the exercise has execution history", () => {
    mockDetailQuery({
      sessions: [
        {
          date: "2026-07-01",
          workout_name: "Push",
          sets: [
            {
              set_number: 1,
              load_kg: 60,
              reps: 8,
              rpe: 7,
            },
          ],
        },
      ],
    });

    render(<ExerciseDetailScreen />);

    expectSelectedTab("tabs.overview");
    expectTabNotSelected("tabs.howTo");
  });

  it("does not show a provisional tab selection while history status is loading", () => {
    mockDetailQuery({ isLoading: true });

    const { rerender } = render(<ExerciseDetailScreen />);

    expect(screen.queryByRole("button", { name: "tabs.overview" })).toBeNull();
    expect(screen.queryByRole("button", { name: "tabs.howTo" })).toBeNull();

    mockDetailQuery({ sessions: [] });
    rerender(<ExerciseDetailScreen />);

    expectSelectedTab("tabs.howTo");
    expectTabNotSelected("tabs.overview");
  });

  it("keeps a manual tab choice after later detail refreshes", () => {
    mockDetailQuery({ sessions: [] });

    const { rerender } = render(<ExerciseDetailScreen />);

    expectSelectedTab("tabs.howTo");

    fireEvent.press(screen.getByRole("button", { name: "tabs.overview" }));

    expectSelectedTab("tabs.overview");
    expectTabNotSelected("tabs.howTo");

    mockDetailQuery({
      sessions: [
        {
          date: "2026-07-02",
          workout_name: "Push",
          sets: [
            {
              set_number: 1,
              load_kg: 62.5,
              reps: 8,
              rpe: 8,
            },
          ],
        },
      ],
    });
    rerender(<ExerciseDetailScreen />);

    expectSelectedTab("tabs.overview");
    expectTabNotSelected("tabs.howTo");
  });
});
