jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-exercise-preference-query", () => ({
  useExercisePreference: jest.fn(() => ({ data: null })),
}));

jest.mock("@/hooks/use-exercise-preference-mutations", () => ({
  useSetExercisePreference: jest.fn(() => ({ mutate: jest.fn() })),
  useRemoveExercisePreference: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

jest.mock("@/components/workout/set-row", () => ({
  SetRow: () => null,
}));

jest.mock("@/components/workout/set-header", () => ({
  SetHeader: () => null,
}));

jest.mock("@/components/workout/exercise-menu", () => ({
  ExerciseMenu: () => null,
}));

jest.mock("@/components/exercise/exercise-preference-sheet", () => ({
  ExercisePreferenceSheet: () => null,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { ExerciseCard } from "../exercise-card";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";

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

describe("ExerciseCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWorkoutStore.getState().clearWorkout();
    useWorkoutStore.getState().startWorkout("Push day", [exercise], undefined);
  });

  it("triggers subtle haptic feedback when adding a set", () => {
    render(<ExerciseCard exercise={exercise} />);

    fireEvent.press(screen.getByRole("button", { name: "exercise.addSet" }));

    expect(Haptics.impactAsync).toHaveBeenCalledWith("light");
    expect(useWorkoutStore.getState().exercises[0]?.sets).toHaveLength(2);
  });

  it("still adds a set when haptic feedback is unsupported", () => {
    jest
      .mocked(Haptics.impactAsync)
      .mockRejectedValueOnce(new Error("No haptic engine"));

    render(<ExerciseCard exercise={exercise} />);

    fireEvent.press(screen.getByRole("button", { name: "exercise.addSet" }));

    expect(useWorkoutStore.getState().exercises[0]?.sets).toHaveLength(2);
  });
});
