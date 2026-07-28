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
    onReorder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("closes the menu and opens exercise reordering", () => {
    render(<ExerciseMenu {...defaultProps} />);

    fireEvent.press(screen.getByRole("button", { name: "menu.reorder" }));

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    expect(defaultProps.onReorder).toHaveBeenCalledTimes(1);
  });
});
