import "@/i18n";
import { render, screen, fireEvent } from "@testing-library/react-native";
jest.mock("@/hooks/use-theme-color", () => ({ useThemeColor: () => "#000" }));
import { WorkoutPlanCard } from "../workout-plan-card";

const exercises = [
  { name: "Bench Press", muscleGroup: "Chest", sets: 3, reps: "8" },
  { name: "Squat", muscleGroup: "Legs", sets: 3, reps: "5" },
];

function renderActiveCard(onStartWorkout = jest.fn()) {
  render(
    <WorkoutPlanCard
      title="Push Day"
      exercises={exercises}
      onStartWorkout={onStartWorkout}
      isActive
      startedAtMs={Date.now()}
    />
  );
  return onStartWorkout;
}

it("resumes the workout when tapping anywhere on the card", () => {
  const onStartWorkout = renderActiveCard();
  fireEvent.press(screen.getByText("Push Day"));
  fireEvent.press(screen.getByText("Squat"));
  expect(onStartWorkout).toHaveBeenCalledTimes(2);
});

it("fires a single resume action when tapping the visible button", () => {
  const onStartWorkout = renderActiveCard();
  fireEvent.press(
    screen.getByText("Resume Workout", { includeHiddenElements: true })
  );
  expect(onStartWorkout).toHaveBeenCalledTimes(1);
});

it("exposes one labelled button with a hint to screen readers", () => {
  renderActiveCard();
  const buttons = screen.getAllByRole("button");
  expect(buttons).toHaveLength(1);
  expect(buttons[0].props.accessibilityLabel).toBe("Resume Workout");
  expect(buttons[0].props.accessibilityHint).toBe(
    "Opens your workout in progress"
  );
});
