import { render, screen } from "@testing-library/react-native";

import WorkoutPreviewScreen from "../workout-preview";

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
  useLocalSearchParams: jest.fn(() => ({ id: "pending-1" })),
  useRouter: jest.fn(() => ({ back: jest.fn(), push: jest.fn() })),
}));

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

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: { seconds?: number }) =>
      key === "exerciseList.rest" ? `Rest ${options?.seconds}s` : key,
  })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: jest.fn(() => ({
    label: "kg",
    format: (kg: number) => `${kg}kg`,
  })),
}));

const mockMutation = () => ({
  isError: false,
  isPending: false,
  mutate: jest.fn(),
});

let mockQueue: Record<string, unknown>[] = [];

jest.mock("@/hooks/use-workout-queue", () => ({
  useEditPendingWorkout: jest.fn(() => mockMutation()),
  useRecoverStalePendingWorkouts: jest.fn(() => mockMutation()),
  useRegenerateWorkout: jest.fn(() => mockMutation()),
  useStartPendingWorkout: jest.fn(() => mockMutation()),
  useWorkoutQueueData: jest.fn(() => ({ queue: mockQueue })),
}));

jest.mock("@/hooks/use-exercise-preference-query", () => ({
  useExercisePreferences: jest.fn(() => ({ data: new Map() })),
}));

jest.mock("@/hooks/use-exercise-preference-mutations", () => ({
  useRemoveExercisePreference: jest.fn(() => mockMutation()),
  useSetExercisePreference: jest.fn(() => mockMutation()),
}));

let mockExerciseMap = new Map<string, unknown>();

jest.mock("@/hooks/use-exercises-query", () => ({
  useLocalizedExerciseMap: jest.fn(() => ({ exerciseMap: mockExerciseMap })),
}));

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));

jest.mock("@/stores/pending-workout-store", () => ({
  selectNextWorkout: (queue: unknown[]) => queue[0] ?? null,
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/components/ui/screen-header", () => ({
  ScreenHeader: () => null,
}));

jest.mock("@/components/ui/app-bottom-sheet", () => ({
  AppBottomSheet: () => null,
}));

jest.mock("@/components/exercise/exercise-preference-sheet", () => ({
  ExercisePreferenceSheet: () => null,
}));

jest.mock("@/components/workout/reasoning-disclosure", () => ({
  ReasoningDisclosure: () => null,
}));

function pendingWorkout(exercises: Record<string, unknown>[]) {
  return {
    id: "pending-1",
    status: "ready",
    focus_area: null,
    queue_position: 1,
    generation_source: "ai",
    last_regenerated_at: null,
    updated_at: new Date().toISOString(),
    user_edits: null,
    workout_data: {
      workout_name: "Push day",
      warmup: null,
      reasoning: null,
      exercises,
    },
  };
}

const benchPress = {
  exercise_id: "bench-press",
  exercise_name: "Bench Press",
  rest_duration_seconds: 90,
  notes: null,
  sets: [{ set_type: "working", target_load_kg: 60, target_reps: 8 }],
};

describe("WorkoutPreviewScreen exercise cards", () => {
  afterEach(() => {
    mockQueue = [];
    mockExerciseMap = new Map();
  });

  it("shows the localized primary muscle under the exercise name", () => {
    mockQueue = [pendingWorkout([benchPress])];
    mockExerciseMap = new Map([
      [
        "bench-press",
        {
          name: "Wyciskanie na ławce",
          primary_muscles: ["Pectoralis major"],
          primary_muscle_labels: ["Klatka piersiowa"],
        },
      ],
    ]);

    render(<WorkoutPreviewScreen />);

    expect(screen.getByText("Wyciskanie na ławce")).toBeTruthy();
    expect(screen.getByText("Klatka piersiowa")).toBeTruthy();
    expect(screen.getByText("Rest 90s")).toBeTruthy();
  });

  it("leaves the muscle out while the catalog entry isn't loaded", () => {
    mockQueue = [pendingWorkout([benchPress])];

    render(<WorkoutPreviewScreen />);

    expect(screen.getByText("Bench Press")).toBeTruthy();
    expect(screen.getByText("Rest 90s")).toBeTruthy();
    expect(screen.queryByText("Pectoralis major")).toBeNull();
  });
});
