jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import "@/i18n";
import type { StreakStatus } from "@/lib/api/streak-protection";
import { StreakStatusCard } from "../streak-status-card";

const baseStatus: StreakStatus = {
  tier: "free",
  is_pro_active: false,
  current_streak_weeks: 5,
  longest_streak_weeks: 5,
  last_workout_at: "2026-06-29T10:00:00Z",
  days_since_last_workout: 8,
  missed_week_count: 0,
  earned_freezes_available: 1,
  pro_freezes_available: 0,
  lifetime_rescue_available: true,
  auto_apply_enabled: true,
  prompt_state: "at_risk",
  should_show_prompt: true,
  covered_week_start: null,
  covered_week_end: null,
};

describe("StreakStatusCard", () => {
  it("reassures an at-risk user and offers a workout without pressure", () => {
    const onStartWorkout = jest.fn();
    const onDismiss = jest.fn();

    render(
      <StreakStatusCard
        status={baseStatus}
        isStarting={false}
        onStartWorkout={onStartWorkout}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole("header")).toHaveTextContent(
      "Your 5-week streak is still going"
    );
    expect(
      screen.getByText(/A workout on any day this week keeps it going/)
    ).toBeTruthy();

    fireEvent.press(screen.getByRole("button", { name: "Start a workout" }));
    expect(onStartWorkout).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByRole("button", { name: "Got it" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("confirms an automatic Pro freeze with the remaining balance", () => {
    render(
      <StreakStatusCard
        status={{
          ...baseStatus,
          tier: "pro",
          is_pro_active: true,
          prompt_state: "pro_auto_applied",
          pro_freezes_available: 1,
          covered_week_start: "2026-06-29",
          covered_week_end: "2026-07-05",
        }}
        isStarting={false}
        onStartWorkout={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(screen.getByRole("header")).toHaveTextContent(
      "Last week is covered"
    );
    expect(screen.getByText(/You have 1 freeze left/)).toBeTruthy();
  });

  it("shows the workout starting and blocks dismissal meanwhile", () => {
    render(
      <StreakStatusCard
        status={baseStatus}
        isStarting
        onStartWorkout={jest.fn()}
        onDismiss={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "Start a workout" })
    ).toHaveAccessibilityState({ busy: true, disabled: true });
    expect(
      screen.getByRole("button", { name: "Got it" })
    ).toHaveAccessibilityState({ disabled: true });
  });
});
