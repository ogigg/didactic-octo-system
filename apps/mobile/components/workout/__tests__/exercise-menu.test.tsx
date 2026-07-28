jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { ExerciseMenu } from "../exercise-menu";

describe("ExerciseMenu", () => {
  const defaultProps = {
    visible: true,
    exerciseName: "Bench Press",
    currentPreference: null,
    onClose: jest.fn(),
    onReplace: jest.fn(),
    onRemove: jest.fn(),
    canMoveEarlier: true,
    canMoveLater: true,
    onMoveEarlier: jest.fn(),
    onMoveLater: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens reorder controls and moves the exercise", () => {
    render(<ExerciseMenu {...defaultProps} />);

    fireEvent.press(screen.getByRole("button", { name: "menu.reorder" }));
    fireEvent.press(screen.getByRole("button", { name: "menu.moveEarlier" }));
    fireEvent.press(screen.getByRole("button", { name: "menu.moveLater" }));

    expect(defaultProps.onMoveEarlier).toHaveBeenCalledTimes(1);
    expect(defaultProps.onMoveLater).toHaveBeenCalledTimes(1);
  });

  it("disables moves that would leave the workout bounds", () => {
    render(
      <ExerciseMenu
        {...defaultProps}
        canMoveEarlier={false}
        canMoveLater={false}
      />
    );

    fireEvent.press(screen.getByRole("button", { name: "menu.reorder" }));

    expect(
      screen.getByRole("button", { name: "menu.moveEarlier" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "menu.moveLater" })
    ).toBeDisabled();
  });
});
