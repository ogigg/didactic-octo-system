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
      disabled,
    }: {
      exercise: { id: string; name: string };
      onSelect: (exercise: { id: string; name: string }) => void;
      disabled?: boolean;
    }) =>
      React.createElement(
        Pressable,
        {
          accessibilityLabel: exercise.name,
          accessibilityRole: "button",
          accessibilityState: { disabled },
          disabled,
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
import { Alert } from "react-native";

import ExercisePickerScreen from "../exercise-picker";
import type { Exercise } from "@/lib/api/exercises";
import {
  useWorkoutStore,
  type GenerationMeta,
  type WorkoutExercise,
} from "@/stores/workout-store";

const BENCH_PRESS_ID = "550e8400-e29b-41d4-a716-446655440001";
const ROW_ID = "550e8400-e29b-41d4-a716-446655440002";
const SQUAT_ID = "550e8400-e29b-41d4-a716-446655440003";

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

const squatExercise: Exercise = {
  ...rowExercise,
  id: SQUAT_ID,
  name: "Back Squat",
  external_id: "curated-back-squat",
  primary_muscles: ["Quadriceps"],
  primary_muscle_labels: ["Quads"],
  equipment: ["Barbell"],
  equipment_labels: ["Barbell"],
};

const benchPressCatalogExercise: Exercise = {
  ...rowExercise,
  id: BENCH_PRESS_ID,
  name: "Bench Press",
  external_id: "curated-bench-press",
  primary_muscles: ["Pectoralis major"],
  primary_muscle_labels: ["Chest"],
  equipment: ["Barbell"],
  equipment_labels: ["Barbell"],
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

const replaceableExercise: WorkoutExercise = {
  ...generatedExercise,
  sets: generatedExercise.sets.map((set) => ({
    ...set,
    kg: "",
    reps: "",
    previousDisplay: "77.5×8",
  })),
};

const generationMeta: GenerationMeta = {
  generationSource: "llm",
  goalSnapshot: "build_strength",
  customGoalSnapshot: null,
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void;
  let rejectPromise!: (reason: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

describe("exercise picker previous-set history", () => {
  const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});

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

  it("single-flights double taps and appends the exercise once", async () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    const historyRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    mockFetchPreviousSetDisplays.mockReturnValue(historyRequest.promise);

    render(<ExercisePickerScreen />);
    const row = screen.getByRole("button", { name: "Seated Row" });
    fireEvent.press(row);
    fireEvent.press(row);

    expect(mockFetchPreviousSetDisplays).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Seated Row" }).props
        .accessibilityState.disabled
    ).toBe(true);

    await act(async () => {
      historyRequest.resolve({ [ROW_ID]: [] });
      await historyRequest.promise;
    });

    await waitFor(() => {
      expect(
        useWorkoutStore
          .getState()
          .exercises.filter((exercise) => exercise.id === ROW_ID)
      ).toHaveLength(1);
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores a canceled request even when it finishes after a newer selection", async () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    mockUseExercises.mockReturnValue({
      data: [rowExercise, squatExercise],
      isLoading: false,
    });
    const firstRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    const secondRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    mockFetchPreviousSetDisplays
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    render(<ExercisePickerScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));
    fireEvent.press(screen.getByRole("button", { name: "header.cancel" }));
    fireEvent.press(screen.getByRole("button", { name: "Back Squat" }));

    await act(async () => {
      secondRequest.resolve({
        [SQUAT_ID]: [{ setNumber: 1, display: "100×5" }],
      });
      await secondRequest.promise;
    });
    await act(async () => {
      firstRequest.resolve({
        [ROW_ID]: [{ setNumber: 1, display: "70×10" }],
      });
      await firstRequest.promise;
    });

    await waitFor(() => {
      expect(
        useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
      ).toEqual([BENCH_PRESS_ID, SQUAT_ID]);
      expect(mockBack).toHaveBeenCalledTimes(2);
    });
  });

  it("does not mutate or navigate when history resolves after unmount", async () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    const historyRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    mockFetchPreviousSetDisplays.mockReturnValue(historyRequest.promise);

    const { unmount } = render(<ExercisePickerScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));
    unmount();

    await act(async () => {
      historyRequest.resolve({
        [ROW_ID]: [{ setNumber: 1, display: "70×10" }],
      });
      await historyRequest.promise;
    });

    expect(useWorkoutStore.getState().exercises).toEqual([generatedExercise]);
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("hides canonical exercises that already exist in the active workout", () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    mockUseExercises.mockReturnValue({
      data: [benchPressCatalogExercise, rowExercise],
      isLoading: false,
    });

    render(<ExercisePickerScreen />);

    expect(
      screen.queryByRole("button", { name: "Bench Press" })
    ).not.toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Seated Row" })
    ).toBeOnTheScreen();
  });

  it.each([
    new Error("Network request failed"),
    new Error("Not authenticated"),
    new Error("Invalid progression history"),
  ])(
    "keeps the workout untouched when history loading fails: %s",
    async (error) => {
      useWorkoutStore
        .getState()
        .startWorkout("AI Push", [generatedExercise], generationMeta);
      mockFetchPreviousSetDisplays.mockRejectedValue(error);

      render(<ExercisePickerScreen />);
      fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          "historyError.title",
          expect.any(String),
          expect.any(Array),
          { cancelable: false }
        );
      });
      expect(useWorkoutStore.getState().exercises).toEqual([generatedExercise]);
      expect(mockBack).not.toHaveBeenCalled();
    }
  );

  it("retries a failed history request before applying the selection", async () => {
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [generatedExercise], generationMeta);
    const retryRequest =
      createDeferred<
        Record<string, { setNumber: number; display: string }[]>
      >();
    mockFetchPreviousSetDisplays
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockReturnValueOnce(retryRequest.promise);

    render(<ExercisePickerScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls.at(-1)?.[2];
    const retryButton = buttons?.find(
      (button) => button.text === "historyError.retry"
    );

    act(() => {
      retryButton?.onPress?.();
    });
    expect(mockFetchPreviousSetDisplays).toHaveBeenCalledTimes(2);
    expect(useWorkoutStore.getState().exercises).toEqual([generatedExercise]);

    await act(async () => {
      retryRequest.resolve({
        [ROW_ID]: [{ setNumber: 1, display: "70×10" }],
      });
      await retryRequest.promise;
    });

    await waitFor(() =>
      expect(
        useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
      ).toEqual([BENCH_PRESS_ID, ROW_ID])
    );
  });

  it("requires confirmation before replacement continues without history", async () => {
    mockUseLocalSearchParams.mockReturnValue({
      exerciseId: BENCH_PRESS_ID,
      mode: "replace",
    });
    useWorkoutStore
      .getState()
      .startWorkout("AI Push", [replaceableExercise], generationMeta);
    mockFetchPreviousSetDisplays.mockRejectedValue(
      new Error("Network request failed")
    );

    render(<ExercisePickerScreen />);
    fireEvent.press(screen.getByRole("button", { name: "Seated Row" }));

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "historyError.title",
        expect.any(String),
        expect.any(Array),
        { cancelable: false }
      )
    );
    expect(useWorkoutStore.getState().exercises).toEqual([replaceableExercise]);

    const buttons = alertSpy.mock.calls.at(-1)?.[2];
    const continueButton = buttons?.find(
      (button) => button.text === "historyError.continueWithoutHistory"
    );
    act(() => {
      continueButton?.onPress?.();
    });

    await waitFor(() => {
      const [exercise] = useWorkoutStore.getState().exercises;
      expect(exercise?.id).toBe(ROW_ID);
      expect(exercise?.sets[0]?.previousDisplay).toBeNull();
      expect(mockBack).toHaveBeenCalledTimes(1);
    });
  });
});
