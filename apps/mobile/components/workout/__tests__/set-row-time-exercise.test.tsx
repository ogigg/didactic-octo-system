jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn((_props: unknown, colorName?: string) => {
    if (colorName === "warning") return "#F5A623";
    return "#000000";
  }),
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

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      if (key === "setRow.warmupSet") return "warmup set";
      if (key === "setRow.workingSet") return `set ${options?.number}`;
      if (key === "setRow.weightForSet") {
        return `Weight in ${options?.unit} for ${options?.set}`;
      }
      if (key === "setRow.repsForSet") return `Reps for ${options?.set}`;
      if (key === "setRow.previousEmpty") return "No previous data";
      if (key === "setRow.rpeNotSet") return "not set";
      if (key === "setRow.rpeForSet") {
        return `RPE for ${options?.set}: ${options?.value}`;
      }
      if (key === "setRow.completeToggle") {
        return `${options?.set}: ${options?.status}${options?.record ?? ""}`;
      }
      if (key === "setRow.completed") return "completed";
      if (key === "setRow.notCompleted") return "not completed";
      if (key === "setRow.personalRecord") return ", personal record";
      return key;
    },
  }),
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

const warmupSet: WorkoutSet = {
  id: "warmup-1",
  type: "warmup",
  kg: "20",
  reps: "10",
  durationSeconds: null,
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

describe("SetRow warmup labeling", () => {
  it("shows W for warmup sets and uses warmup accessibility labels", () => {
    render(
      <SetRow
        set={warmupSet}
        setIndex={0}
        exerciseId="bench"
        exerciseType="weight"
        onToggleComplete={jest.fn()}
        onUpdateField={jest.fn()}
        onUpdateDuration={jest.fn()}
        onUpdateRpe={jest.fn()}
        onRemove={jest.fn()}
      />
    );

    expect(screen.getByText("W")).toBeTruthy();
    expect(screen.getByLabelText("Weight in kg for warmup set")).toBeTruthy();
    expect(screen.getByLabelText("Reps for warmup set")).toBeTruthy();
  });
});
