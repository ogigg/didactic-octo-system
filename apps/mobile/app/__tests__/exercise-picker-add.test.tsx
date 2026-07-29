const mockRouterBack = jest.fn();
const mockAddExercise = jest.fn();
const mockAddExerciseAfter = jest.fn();
const mockReplaceExercise = jest.fn();
const mockFetchPreviousSetDisplays = jest.fn();

const exercise = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Barbell Squat",
  external_id: null,
  exercise_type: "weight" as const,
  primary_muscles: ["quadriceps"],
  primary_muscle_labels: ["Quadriceps"],
  secondary_muscles: ["glutes"],
  secondary_muscle_labels: ["Glutes"],
  equipment: ["barbell"],
  equipment_labels: ["Barbell"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: "Squat with control.",
  image: null,
  image_url: null,
  video_url: null,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(() => ({ mode: "add" })),
  useRouter: jest.fn(() => ({ back: mockRouterBack })),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    i18n: { language: "en", resolvedLanguage: "en" },
    t: (key: string) => key,
  })),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: jest.fn(() => ({ data: { weight_unit: "kg" } })),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useExercise: jest.fn(() => ({ data: undefined })),
  useExerciseFilterOptions: jest.fn(() => ({
    filterOptions: { muscles: [], equipment: [] },
    labelMaps: { muscle: new Map(), equipment: new Map() },
  })),
  useExercises: jest.fn(() => ({
    data: [exercise],
    isLoading: false,
  })),
}));

jest.mock("@/lib/api/workouts", () => ({
  fetchPreviousSetDisplays: (...args: unknown[]) =>
    mockFetchPreviousSetDisplays(...args),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: jest.fn(
    (
      selector: (state: {
        addExercise: typeof mockAddExercise;
        addExerciseAfter: typeof mockAddExerciseAfter;
        exercises: never[];
        replaceExercise: typeof mockReplaceExercise;
      }) => unknown
    ) =>
      selector({
        addExercise: mockAddExercise,
        addExerciseAfter: mockAddExerciseAfter,
        exercises: [],
        replaceExercise: mockReplaceExercise,
      })
  ),
}));

jest.mock("@/stores/pending-swap-store", () => ({
  usePendingSwapStore: jest.fn(
    (selector: (state: { setResult: jest.Mock }) => unknown) =>
      selector({ setResult: jest.fn() })
  ),
}));

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
      exercise: item,
      onSelect,
    }: {
      exercise: typeof exercise;
      onSelect: (selectedExercise: typeof exercise) => void;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: item.name,
          accessibilityRole: "button",
          onPress: () => onSelect(item),
        },
        React.createElement(Text, null, item.name)
      ),
  };
});

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");

  return {
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import ExercisePickerScreen from "../exercise-picker";

const alertSpy = jest.spyOn(Alert, "alert");

describe("ExercisePickerScreen add flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchPreviousSetDisplays.mockResolvedValue({
      [exercise.id]: [{ setNumber: 1, display: "100×5" }],
    });
  });

  it("adds the selected exercise before returning to the active workout", async () => {
    render(<ExercisePickerScreen />);

    fireEvent.press(screen.getByRole("button", { name: exercise.name }));

    await waitFor(() => {
      expect(mockAddExercise).toHaveBeenCalledWith({
        id: exercise.id,
        name: exercise.name,
        image: exercise.image,
        exerciseType: exercise.exercise_type,
        previousDisplays: ["100×5"],
      });
      expect(mockRouterBack).toHaveBeenCalledTimes(1);
    });

    expect(mockAddExercise.mock.invocationCallOrder[0]).toBeLessThan(
      mockRouterBack.mock.invocationCallOrder[0]
    );
  });

  it("keeps the picker open and surfaces an error when adding fails", async () => {
    mockAddExercise.mockImplementationOnce(() => {
      throw new Error("store failure");
    });
    render(<ExercisePickerScreen />);

    fireEvent.press(screen.getByRole("button", { name: exercise.name }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        "addError.title",
        "addError.message"
      );
    });
    expect(mockRouterBack).not.toHaveBeenCalled();
  });
});
