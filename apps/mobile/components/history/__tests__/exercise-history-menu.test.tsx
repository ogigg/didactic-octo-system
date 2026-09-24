jest.mock("@/components/ui/app-bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppBottomSheet: React.forwardRef(
      (
        { children, visible }: { children: React.ReactNode; visible: boolean },
        ref: React.Ref<{ dismiss: (callback?: () => void) => void }>
      ) => {
        React.useImperativeHandle(ref, () => ({
          dismiss: (callback?: () => void) => callback?.(),
        }));
        return visible ? React.createElement(View, null, children) : null;
      }
    ),
  };
});

jest.mock("@/components/ui/icon-symbol", () => ({ IconSymbol: () => null }));
jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({ t: (key: string) => key })),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { ExerciseHistoryMenu } from "../exercise-history-menu";

describe("ExerciseHistoryMenu", () => {
  it("offers edit and delete actions", () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    render(
      <ExerciseHistoryMenu
        visible
        exerciseName="Bench Press"
        dateLabel="Sep 12, 2026"
        setCount={3}
        onClose={jest.fn()}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseMenu.edit" })
    );
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseMenu.delete" })
    );

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
