jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/ui/app-bottom-sheet", () => ({
  AppBottomSheet: require("react").forwardRef(
    (
      {
        visible,
        onClose,
        children,
      }: {
        visible: boolean;
        onClose: () => void;
        children: React.ReactNode;
      },
      ref: React.Ref<{ dismiss: (afterClose?: () => void) => void }>
    ) => {
      require("react").useImperativeHandle(ref, () => ({
        dismiss: (afterClose?: () => void) => {
          onClose();
          afterClose?.();
        },
      }));
      return visible ? children : null;
    }
  ),
}));

jest.mock("@/components/exercise/exercise-image", () => ({
  ExerciseImage: () => null,
}));

jest.mock("expo-haptics", () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
}));

import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { mapWorkoutStoreToDb } from "@/lib/api/workout-mappers";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";
import { ExerciseMenu } from "../exercise-menu";
import { ExerciseReorderSheet } from "../exercise-reorder-sheet";

const baseExercise: WorkoutExercise = {
  id: "bench",
  name: "Bench Press",
  exerciseType: "weight",
  restDurationSeconds: 90,
  notes: "",
  difficultyFeedback: null,
  sets: [],
};

function ReorderFlowHarness() {
  const [menuVisible, setMenuVisible] = useState(true);
  const [reorderExerciseId, setReorderExerciseId] = useState<string | null>(
    null
  );
  const exercises = useWorkoutStore((state) => state.exercises);
  const reorderExercise = useWorkoutStore((state) => state.reorderExercise);

  return (
    <>
      <ExerciseMenu
        visible={menuVisible}
        exerciseName="Bench Press"
        currentPreference={null}
        onClose={() => setMenuVisible(false)}
        onReplace={jest.fn()}
        onRemove={jest.fn()}
        onReorder={() => setReorderExerciseId("bench")}
      />
      <ExerciseReorderSheet
        visible={reorderExerciseId !== null}
        exercises={exercises}
        highlightedExerciseId={reorderExerciseId}
        onMove={reorderExercise}
        onClose={() => setReorderExerciseId(null)}
      />
    </>
  );
}

describe("active workout exercise reorder flow", () => {
  beforeEach(() => {
    useWorkoutStore.getState().clearWorkout();
    useWorkoutStore
      .getState()
      .startWorkout(
        "Push day",
        [
          baseExercise,
          { ...baseExercise, id: "squat", name: "Squat" },
          { ...baseExercise, id: "row", name: "Row" },
        ],
        undefined
      );
  });

  it("opens from the exercise menu and persists the reordered save order", () => {
    render(<ReorderFlowHarness />);

    fireEvent.press(screen.getByRole("button", { name: "menu.reorder" }));
    const moveLaterButtons = screen.getAllByRole("button", {
      name: "menu.moveExerciseLater",
    });
    fireEvent.press(moveLaterButtons[0]!);

    expect(
      useWorkoutStore.getState().exercises.map((exercise) => exercise.id)
    ).toEqual(["squat", "bench", "row"]);

    useWorkoutStore.getState().finishWorkout();
    const summary = useWorkoutStore.getState().completedWorkoutSummary;
    expect(summary).not.toBeNull();
    const payload = mapWorkoutStoreToDb(summary!, {
      goalSnapshot: "build_strength",
    });

    expect(
      payload.exercises.map((exercise) => ({
        id: exercise.sessionExercise.exercise_id,
        order: exercise.sessionExercise.order_index,
      }))
    ).toEqual([
      { id: "squat", order: 0 },
      { id: "bench", order: 1 },
      { id: "row", order: 2 },
    ]);
  });
});
