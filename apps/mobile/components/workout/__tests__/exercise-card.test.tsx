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

jest.mock("@/hooks/use-stats-queries", () => ({
  usePersonalRecords: jest.fn(() => ({ data: [] })),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: jest.fn(() => ({
    label: "kg",
    toKg: (value: number) => value,
  })),
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Light: "light" },
  impactAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock("expo-router", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));

const mockSetRowProps: {
  set: { id: string };
  onSubmitReps?: () => void;
}[] = [];
const mockSetRowHandles = new Map<string, { focusFirstInput: jest.Mock }>();

jest.mock("@/components/workout/set-row", () => {
  const React = require("react");

  return {
    SetRow: React.forwardRef(
      (
        props: {
          set: { id: string };
          onSubmitReps?: () => void;
        },
        ref: React.Ref<{ focusFirstInput: () => void }>
      ) => {
        const handle = mockSetRowHandles.get(props.set.id) ?? {
          focusFirstInput: jest.fn(),
        };

        mockSetRowHandles.set(props.set.id, handle);
        mockSetRowProps.push(props);
        React.useImperativeHandle(ref, () => handle);

        return null;
      }
    ),
  };
});

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
    mockSetRowProps.length = 0;
    mockSetRowHandles.clear();
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

  it("moves keyboard focus from reps to the next set row", () => {
    const exerciseWithTwoSets: WorkoutExercise = {
      ...exercise,
      sets: [
        exercise.sets[0]!,
        {
          ...exercise.sets[0]!,
          id: "set-2",
          kg: "82.5",
          reps: "5",
        },
      ],
    };

    render(<ExerciseCard exercise={exerciseWithTwoSets} />);

    mockSetRowProps[0]?.onSubmitReps?.();

    expect(mockSetRowHandles.get("set-2")?.focusFirstInput).toHaveBeenCalled();
    expect(mockSetRowProps[1]?.onSubmitReps).toBeUndefined();
  });

  it("reveals exercise reasoning on demand", () => {
    const exerciseWithReasoning: WorkoutExercise = {
      ...exercise,
      reasoning: {
        muscle_groups: "Targets chest and triceps for today's push focus.",
        exercise_selection:
          "Chosen because it fits the available bench setup and strength target.",
      },
    };

    render(<ExerciseCard exercise={exerciseWithReasoning} />);

    expect(
      screen.queryByText("Targets chest and triceps for today's push focus.")
    ).toBeNull();

    fireEvent.press(
      screen.getByRole("button", { name: "reasoning.exerciseAccessibility" })
    );

    expect(
      screen.getByText("Targets chest and triceps for today's push focus.")
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Chosen because it fits the available bench setup and strength target."
      )
    ).toBeTruthy();
  });
});
