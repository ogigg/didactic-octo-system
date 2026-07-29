jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-weight-unit", () => ({
  useWeightUnit: jest.fn(() => ({ label: "kg" })),
}));

jest.mock("@/components/workout/duration-picker", () => ({
  DurationPicker: () => null,
}));

jest.mock("@/components/workout/rpe-picker", () => ({
  RpePicker: () => null,
}));

jest.mock("@/components/ui/icon-symbol", () => ({
  IconSymbol: () => null,
}));

jest.mock("expo-haptics", () => ({
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Warning: "warning" },
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
}));

import { render, screen } from "@testing-library/react-native";

import { SetRow } from "@/components/workout/set-row";
import type { WorkoutSet } from "@/stores/workout-store";

const plankSet: WorkoutSet = {
  id: "plank-set-1",
  type: "working",
  kg: "",
  reps: "",
  durationSeconds: 45,
  rpe: null,
  isCompleted: false,
  previousDisplay: null,
};

describe("SetRow time exercise input", () => {
  it("shows a duration control instead of weight and reps inputs", () => {
    render(
      <SetRow
        set={plankSet}
        setIndex={0}
        exerciseId="plank"
        exerciseType="time"
        onToggleComplete={jest.fn()}
        onUpdateField={jest.fn()}
        onUpdateDuration={jest.fn()}
        onUpdateRpe={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", {
        name: "Duration for set 1: 0:45. Tap to edit.",
      })
    ).toBeTruthy();
    expect(screen.queryByLabelText("Weight in kg for set 1")).toBeNull();
    expect(screen.queryByLabelText("Reps for set 1")).toBeNull();
  });
});
