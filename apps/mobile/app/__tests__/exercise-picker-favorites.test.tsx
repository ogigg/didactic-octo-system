jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => true);
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

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ back: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({ mode: "add" })),
}));

jest.mock("@/hooks/use-exercises-query", () => ({
  useExercise: jest.fn(() => ({ data: undefined })),
  useExerciseFilterOptions: jest.fn(),
  useExercises: jest.fn(),
}));

jest.mock("@/hooks/use-exercise-preference-query", () => ({
  useExercisePreferences: jest.fn(),
}));

jest.mock("@/hooks/use-profile-query", () => ({
  useProfile: jest.fn(() => ({ data: { weight_unit: "kg" } })),
}));

jest.mock("@/stores/workout-store", () => ({
  useWorkoutStore: (selector: (state: { exercises: unknown[] }) => unknown) =>
    selector({ exercises: [] }),
}));

jest.mock("@/stores/pending-swap-store", () => ({
  usePendingSwapStore: (
    selector: (state: { setResult: () => void }) => unknown
  ) => selector({ setResult: jest.fn() }),
}));

jest.mock("@/lib/api/workouts", () => ({
  fetchPreviousSetDisplays: jest.fn(),
}));

jest.mock("@/components/exercise/exercise-image", () => ({
  ExerciseImage: () => null,
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

import { act, fireEvent, render, screen } from "@testing-library/react-native";

import type { Exercise } from "@/lib/api/exercises";
import {
  useExerciseFilterOptions,
  useExercises,
} from "@/hooks/use-exercises-query";
import { useExercisePreferences } from "@/hooks/use-exercise-preference-query";
import ExercisePickerScreen from "../exercise-picker";

const benchPress: Exercise = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Bench Press",
  external_id: "ext-1",
  exercise_type: "weight",
  primary_muscles: ["chest"],
  primary_muscle_labels: ["Chest"],
  secondary_muscles: ["triceps"],
  secondary_muscle_labels: ["Triceps"],
  equipment: ["barbell"],
  equipment_labels: ["Barbell"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: null,
  image: null,
  image_url: null,
  video_url: null,
};

const squat: Exercise = {
  id: "550e8400-e29b-41d4-a716-446655440002",
  name: "Squat",
  external_id: "ext-2",
  exercise_type: "weight",
  primary_muscles: ["quads"],
  primary_muscle_labels: ["Quads"],
  secondary_muscles: ["glutes"],
  secondary_muscle_labels: ["Glutes"],
  equipment: ["barbell"],
  equipment_labels: ["Barbell"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: null,
  image: null,
  image_url: null,
  video_url: null,
};

const curl: Exercise = {
  id: "550e8400-e29b-41d4-a716-446655440003",
  name: "Dumbbell Curl",
  external_id: "ext-3",
  exercise_type: "weight",
  primary_muscles: ["biceps"],
  primary_muscle_labels: ["Biceps"],
  secondary_muscles: null,
  secondary_muscle_labels: [],
  equipment: ["dumbbell"],
  equipment_labels: ["Dumbbell"],
  difficulty_level: "beginner",
  difficulty_label: "Beginner",
  instructions: null,
  image: null,
  image_url: null,
  video_url: null,
};

const allExercises = [benchPress, squat, curl];

function applyCatalogFilters(
  filters:
    | {
        search?: string;
        muscles?: string[];
        equipment?: string[];
      }
    | undefined
): Exercise[] {
  let data = allExercises;
  const search = filters?.search?.trim().toLowerCase();
  if (search) {
    data = data.filter((exercise) =>
      exercise.name.toLowerCase().includes(search)
    );
  }
  if (filters?.muscles?.length) {
    data = data.filter((exercise) =>
      exercise.primary_muscles.some((muscle) =>
        filters.muscles?.includes(muscle)
      )
    );
  }
  if (filters?.equipment?.length) {
    data = data.filter((exercise) =>
      exercise.equipment.some((item) => filters.equipment?.includes(item))
    );
  }
  return data;
}

function renderPicker() {
  return render(<ExercisePickerScreen />);
}

describe("ExercisePickerScreen favorites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useExerciseFilterOptions as jest.Mock).mockReturnValue({
      filterOptions: {
        muscles: ["chest", "quads", "biceps"],
        equipment: ["barbell", "dumbbell"],
      },
      labelMaps: {
        muscle: new Map([
          ["chest", "Chest"],
          ["quads", "Quads"],
          ["biceps", "Biceps"],
        ]),
        equipment: new Map([
          ["barbell", "Barbell"],
          ["dumbbell", "Dumbbell"],
        ]),
      },
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    });
    (useExercises as jest.Mock).mockImplementation((filters) => ({
      data: applyCatalogFilters(filters),
      isLoading: false,
    }));
    (useExercisePreferences as jest.Mock).mockReturnValue({
      data: new Map([
        [benchPress.id, "preferred"],
        [squat.id, "preferred"],
        [curl.id, "soft_dislike"],
      ]),
      isLoading: false,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("surfaces favorite exercises and lets the user filter to them", () => {
    renderPicker();

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "filters.favorites" }));

    expect(screen.getByText("sections.favorites")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeNull();
  });

  it("composes the favorites filter with search text", () => {
    jest.useFakeTimers();
    renderPicker();

    fireEvent.press(screen.getByRole("button", { name: "filters.favorites" }));
    fireEvent.changeText(screen.getByLabelText("search.placeholder"), "bench");
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeNull();

    jest.useRealTimers();
  });

  it("composes the favorites filter with a muscle filter", () => {
    renderPicker();

    fireEvent.press(screen.getByRole("button", { name: "filters.favorites" }));
    fireEvent.press(screen.getByRole("button", { name: "filters.allMuscles" }));
    fireEvent.press(screen.getByRole("checkbox", { name: "Chest" }));
    fireEvent.press(
      screen.getByRole("button", { name: "filters.showResults" })
    );

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeNull();
  });

  it("composes the favorites filter with an equipment filter", () => {
    renderPicker();

    fireEvent.press(screen.getByRole("button", { name: "filters.favorites" }));
    fireEvent.press(
      screen.getByRole("button", { name: "filters.allEquipment" })
    );
    fireEvent.press(screen.getByRole("checkbox", { name: "Dumbbell" }));
    fireEvent.press(
      screen.getByRole("button", { name: "filters.showResults" })
    );

    expect(
      screen.queryByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeNull();
    expect(screen.getByText("list.empty")).toBeTruthy();
    expect(screen.queryByText("list.emptyFavorites")).toBeNull();
  });

  it("clears search and selected filters from the global action", () => {
    jest.useFakeTimers();
    renderPicker();

    fireEvent.changeText(screen.getByLabelText("search.placeholder"), "bench");
    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(
      screen.queryByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "filters.clearAll" }));

    expect(
      screen.getByRole("button", { name: "Bench Press, Chest, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Squat, Quads, row.favorite" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Dumbbell Curl, Biceps" })
    ).toBeTruthy();
  });

  it("shows a useful empty state when the user has no favorite exercises", () => {
    (useExercisePreferences as jest.Mock).mockReturnValue({
      data: new Map(),
      isLoading: false,
    });
    renderPicker();

    fireEvent.press(screen.getByRole("button", { name: "filters.favorites" }));

    expect(screen.getByText("list.emptyFavorites")).toBeTruthy();
    expect(screen.getByText("list.emptyFavoritesHint")).toBeTruthy();
    expect(screen.queryByText("list.empty")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Bench Press, Chest" })
    ).toBeNull();
  });
});
