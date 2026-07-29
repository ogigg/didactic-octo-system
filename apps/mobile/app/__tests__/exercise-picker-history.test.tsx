const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();
const mockFetchPreviousSetDisplays = jest.fn();
const mockUseExercises = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: mockBack,
  }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: () => "#000000",
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: () => ({ data: { weight_unit: "kg" } }),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useExercise: () => ({ data: undefined }),
  useExerciseFilterOptions: () => ({
    filterOptions: { muscles: [], equipment: [] },
    labelMaps: { muscle: new Map(), equipment: new Map() },
  }),
  useExercises: (...args: unknown[]) => mockUseExercises(...args),
}));

jest.mock("@/lib/api/workouts", () => ({
  fetchPreviousSetDisplays: (...args: unknown[]) =>
    mockFetchPreviousSetDisplays(...args),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock("@/components/exercise-picker/search-bar", () => ({
  SearchBar: () => null,
}));

jest.mock("@/components/exercise-picker/filter-pills", () => ({
  FilterPills: () => null,
}));

jest.mock("@/components/exercise-picker/filter-sheet", () => ({
  FilterSheet: () => null,
}));

jest.mock("@/components/exercise-picker/exercise-row", () => {
  const React = require("react");
  const { Pressable, Text } = require("react-native");

  return {
    ExerciseRow: ({
      exercise,
      onSelect,
    }: {
      exercise: { id: string; name: string };
      onSelect: (exercise: { id: string; name: string }) => void;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: exercise.name,
          accessibilityRole: "button",
          onPress: () => onSelect(exercise),
        },
        React.createElement(Text, null, exercise.name)
      ),
  };
});

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import ExercisePickerScreen from "../exercise-picker";
import type { Exercise } from "@/lib/api/exercises";
import {
  useWorkoutStore,
  type GenerationMeta,
  type WorkoutExercise,
} from "@/stores/workout-store";

const BENCH_PRESS_ID = "550e8400-e29b-41d4-a716-446655440001";
const ROW_ID = "550e8400-e29b-41d4-a716-446655440002";

const rowExercise: Exercise = {
  id: ROW_ID,
  name: "Seated Row",
  external_id: "curated-seated-row",
  exercise_type: "weight",
  primary_muscles: ["Latissimus dorsi"],
  primary_muscle_labels: ["Lats"],
  secondary_muscles: [],
  secondary_muscle_labels: [],
  equipment: ["Cable machine"],
  equipment_labels: ["Cable machine"],
  difficulty_level: "beginner",
  difficulty_label: "Beginner",
  instructions: null,
  image: null,
  image_url: null,
  video_url: null,
};

const generatedExercise: WorkoutExercise = {
  id: BENCH_PRESS_ID,
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 120,
  notes: "",
  difficultyFeedback: null,
  sets: [
    {
      id: "set-1",
      type: "working",
      kg: "80",
      reps: "8",
      durationSeconds: null,
      rpe: null,
      isCompleted: false,
      previousDisplay: "77.5×8",
    },
  ],
};

const generationMeta: GenerationMeta = {
  generationSource: "llm",
  goalSnapshot: "build_strength",
  customGoalSnapshot: null,
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

describe("exercise picker previous-set history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocalSearchParams.mockReturnValue({ mode: "add" });
    mockUseExercises.mockReturnValue({
      data: [rowExercise],
      isLoading: false,
    });
    useWorkoutStore.getState().clearWorkout();
  });

  it("hydrates a manually added AI-workout exercise without disturbing the workout while history loads", async () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    const historyRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    mockFetchPreviousSetDisplays.mockReturnValue(historyRequest.promise);

    render(<ExercisePickerScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));

    await waitFor(() =>
      expect(mockFetchPreviousSetDisplays).toHaveBeenCalledWith([ROW_ID], "kg")
    );
    expect(useWorkoutStore.getState().exercises).toEqual([generatedExercise]);

    await act(async () => {
      historyRequest.resolve({
        [ROW_ID]: [
          { setNumber: 1, display: "70×10" },
          { setNumber: 2, display: "70×8" },
        ],
      });
      await historyRequest.promise;
    });

    await waitFor(() => {
      const exercises = useWorkoutStore.getState().exercises;
      expect(exercises.map((exercise) => exercise.id)).toEqual([
        BENCH_PRESS_ID,
        ROW_ID,
      ]);
      expect(exercises[1]?.sets.map((set) => set.previousDisplay)).toEqual([
        "70×10",
        "70×8",
        null,
      ]);
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
