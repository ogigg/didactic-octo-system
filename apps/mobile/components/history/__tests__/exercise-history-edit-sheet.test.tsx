jest.mock("@/components/ui/app-bottom-sheet", () => {
  const React = require("react");
  const { Pressable, View } = require("react-native");
  return {
    AppBottomSheet: React.forwardRef(
      (
        {
          children,
          closeAccessibilityLabel,
          onClose,
          onRequestClose,
          visible,
        }: {
          children: React.ReactNode;
          closeAccessibilityLabel: string;
          onClose: () => void;
          onRequestClose?: () => void;
          visible: boolean;
        },
        ref: React.Ref<{ dismiss: (callback?: () => void) => void }>
      ) => {
        React.useImperativeHandle(ref, () => ({
          dismiss: (callback?: () => void) => {
            onClose();
            callback?.();
          },
        }));
        return visible
          ? React.createElement(
              View,
              null,
              React.createElement(Pressable, {
                accessibilityLabel: closeAccessibilityLabel,
                accessibilityRole: "button",
                onPress: onRequestClose,
              }),
              children
            )
          : null;
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
    t: (
      key: string,
      options?: { number?: number; workoutName?: string; workoutDate?: string }
    ) =>
      options?.number
        ? `${key}-${options.number}`
        : options?.workoutName
          ? `${options.workoutName} · ${options.workoutDate}`
          : key,
  })),
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

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
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("saves edited load, reps, and an integer RPE from 1 to 10", () => {
    const onSave = jest.fn();
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        workoutName="Full body Workout"
        workoutDate="Sep 12, 2026"
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
    const rpeInput = screen.getByLabelText("detail.exerciseEditor.rpeForSet-1");
    fireEvent.changeText(rpeInput, "8.5");
    expect(rpeInput).toHaveProp("value", "7");
    fireEvent.changeText(rpeInput, "11");
    expect(rpeInput).toHaveProp("value", "11");
    expect(screen.getByText("detail.exerciseEditor.rpeHint")).toBeTruthy();
    fireEvent.changeText(rpeInput, "0");
    expect(rpeInput).toHaveProp("value", "0");
    fireEvent.changeText(rpeInput, "10");
    fireEvent.press(
      screen.getByRole("button", { name: "detail.exerciseEditor.save" })
    );

    expect(onSave).toHaveBeenCalledWith([
      {
        id: set.id,
        set_type: "working",
        actual_load_kg: 82.5,
        actual_reps: 6,
        rpe: 10,
      },
    ]);
  });

  it("adds and removes series without allowing an empty history entry", () => {
    const onSave = jest.fn();
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        workoutName="Full body Workout"
        workoutDate="Sep 12, 2026"
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
    const removeAlert = alertSpy.mock.calls.at(-1);
    const removeButton = removeAlert?.[2]?.find(
      (button) => button.style === "destructive"
    );
    act(() => removeButton?.onPress?.());

    expect(screen.getByRole("alert")).toHaveTextContent(
      "detail.exerciseEditor.atLeastOneSet"
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it("requires weight to be greater than zero", () => {
    const onSave = jest.fn();
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        workoutName="Full body Workout"
        workoutDate="Sep 12, 2026"
        exerciseType="weight"
        sets={[set]}
        onClose={jest.fn()}
        onSave={onSave}
      />
    );

    fireEvent.changeText(
      screen.getByLabelText("detail.exerciseEditor.weightForSet-1"),
      "0"
    );
    expect(screen.getByText("detail.exerciseEditor.positiveHint")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "detail.exerciseEditor.save" })
    ).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("warns before closing only while changes are unsaved", () => {
    const onClose = jest.fn();
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        workoutName="Full body Workout"
        workoutDate="Sep 12, 2026"
        exerciseType="weight"
        sets={[set]}
        onClose={onClose}
        onSave={jest.fn()}
      />
    );

    const repsInput = screen.getByLabelText(
      "detail.exerciseEditor.repsForSet-1"
    );
    const closeButton = screen.getByRole("button", {
      name: "detail.exerciseEditor.close",
    });

    fireEvent.changeText(repsInput, "9");
    fireEvent.press(closeButton);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.changeText(repsInput, "8");
    fireEvent.press(closeButton);
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows workout context, an iOS Done toolbar, and prevents duplicate saves", async () => {
    let resolveSave: (() => void) | undefined;
    const onClose = jest.fn();
    const onSave = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        })
    );
    render(
      <ExerciseHistoryEditSheet
        visible
        exerciseName="Bench Press"
        workoutName="Full body Workout"
        workoutDate="Sep 12, 2026"
        exerciseType="weight"
        sets={[set]}
        onClose={onClose}
        onSave={onSave}
      />
    );

    expect(screen.getByText("Full body Workout · Sep 12, 2026")).toBeTruthy();
    expect(screen.getByText("Done")).toBeTruthy();

    fireEvent.changeText(
      screen.getByLabelText("detail.exerciseEditor.repsForSet-1"),
      "9"
    );
    const saveButton = screen.getByRole("button", {
      name: "detail.exerciseEditor.save",
    });
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(saveButton).toHaveAccessibilityState({ busy: true, disabled: true });

    await act(async () => resolveSave?.());
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
