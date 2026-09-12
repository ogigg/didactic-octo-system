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

jest.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: (() => {
    const weightUnit = {
      label: "kg",
      convert: (value: number) => value,
      toKg: (value: number) => value,
    };
    return jest.fn(() => weightUnit);
  })(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: jest.fn(() => ({
    t: (key: string, options?: { number?: number }) =>
      options?.number ? `${key}-${options.number}` : key,
  })),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import { ExerciseHistoryEditSheet } from "../exercise-history-edit-sheet";

const set = {
  id: "550e8400-e29b-41d4-a716-446655440030",
  set_number: 1,
  set_type: "working" as const,
  load_kg: 80,
  reps: 8,
  duration_seconds: null,
  rpe: 7,
};

describe("ExerciseHistoryEditSheet", () => {
  it("saves edited load, reps, and RPE", () => {
    const onSave = jest.fn();
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        exerciseType="weight"
        sets={[set]}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.changeText(
      screen.getByLabelText("detail.exerciseEditor.weightForSet-1"),
      "82,5"
    );
    fireEvent.changeText(
      screen.getByLabelText("detail.exerciseEditor.repsForSet-1"),
      "6"
    );
    fireEvent.changeText(
      screen.getByLabelText("detail.exerciseEditor.rpeForSet-1"),
      "8.5"
    );
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.save" })
    );

    expect(onSave).toHaveBeenCalledWith([
      {
        id: set.id,
        set_type: "working",
        actual_load_kg: 82.5,
        actual_reps: 6,
        rpe: 8.5,
      },
    ]);
  });

  it("adds and removes series without allowing an empty history entry", () => {
    const onSave = jest.fn();
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        exerciseType="weight"
        sets={[set]}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.addSet" })
    );
    expect(
      screen.getByLabelText("detail.exerciseEditor.weightForSet-2")
    ).toBeTruthy();
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.removeSet-2" })
    );
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.removeSet-1" })
    );
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.save" })
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "detail.exerciseEditor.atLeastOneSet"
    );
    expect(onSave).not.toHaveBeenCalled();
  });
});
