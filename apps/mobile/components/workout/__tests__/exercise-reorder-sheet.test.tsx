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

import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import {
  ExerciseReorderSheet,
  getExerciseReorderTargetIndex,
  type ExerciseOrderItem,
} from "../exercise-reorder-sheet";

const exercises: ExerciseOrderItem[] = [
  { id: "bench", name: "Bench Press" },
  { id: "squat", name: "Squat" },
  { id: "row", name: "Row" },
];

describe("ExerciseReorderSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("moves exercises with accessible controls and haptic feedback", () => {
    const onMove = jest.fn();
    render(
      <ExerciseReorderSheet
        visible
        exercises={exercises}
        highlightedExerciseId="bench"
        onMove={onMove}
        onClose={jest.fn()}
      />
    );

    const moveLaterButtons = screen.getAllByRole("button", {
      name: "menu.moveExerciseLater",
    });
    fireEvent.press(moveLaterButtons[0]!);

    expect(onMove).toHaveBeenCalledWith("bench", 1);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it("disables controls at the workout boundaries", () => {
    render(
      <ExerciseReorderSheet
        visible
        exercises={exercises}
        highlightedExerciseId="squat"
        onMove={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const moveEarlierButtons = screen.getAllByRole("button", {
      name: "menu.moveExerciseEarlier",
    });
    const moveLaterButtons = screen.getAllByRole("button", {
      name: "menu.moveExerciseLater",
    });

    expect(moveEarlierButtons[0]).toBeDisabled();
    expect(moveLaterButtons[moveLaterButtons.length - 1]).toBeDisabled();
  });

  it("calculates bounded drop positions from a vertical drag", () => {
    expect(getExerciseReorderTargetIndex(1, 3, -90)).toBe(0);
    expect(getExerciseReorderTargetIndex(0, 3, 145)).toBe(2);
    expect(getExerciseReorderTargetIndex(2, 3, 500)).toBe(2);
  });
});
