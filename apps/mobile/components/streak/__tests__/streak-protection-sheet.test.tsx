jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  Reanimated.useReducedMotion = jest.fn(() => true);
  return Reanimated;
});

jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const mockGesture = { onChange: jest.fn(), onEnd: jest.fn() };
  mockGesture.onChange.mockReturnValue(mockGesture);
  mockGesture.onEnd.mockReturnValue(mockGesture);

  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: { Pan: jest.fn(() => mockGesture) },
  };
});

import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "@/i18n";
import type { StreakStatus } from "@/lib/api/streak-protection";
import { StreakProtectionSheet } from "../streak-protection-sheet";

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const baseStatus: StreakStatus = {
  tier: "free",
  is_pro_active: false,
  current_streak_weeks: 0,
  longest_streak_weeks: 6,
  last_workout_at: "2026-06-28T10:00:00Z",
  days_since_last_workout: 10,
  missed_week_count: 1,
  earned_freezes_available: 0,
  pro_freezes_available: 0,
  lifetime_rescue_available: true,
  auto_apply_enabled: true,
  prompt_state: "free_lifetime_rescue",
  should_show_prompt: true,
  covered_week_start: "2026-06-29",
  covered_week_end: "2026-07-05",
};

function makeStatus(overrides: Partial<StreakStatus>): StreakStatus {
  return { ...baseStatus, ...overrides };
}

function renderSheet(
  status: StreakStatus,
  overrides: Partial<React.ComponentProps<typeof StreakProtectionSheet>> = {}
) {
  const handlers = {
    onApplyProtection: jest.fn(),
    onComeback: jest.fn(),
    onAdjustPlan: jest.fn(),
    onUpgrade: jest.fn(),
    onRestart: jest.fn(),
    onDismiss: jest.fn(),
  };

  render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <StreakProtectionSheet
        visible
        status={status}
        pendingAction={null}
        hasError={false}
        {...handlers}
        {...overrides}
      />
    </SafeAreaProvider>
  );

  return handlers;
}

const button = (name: string | RegExp) =>
  screen.getByRole("button", { name, includeHiddenElements: true });
const queryButton = (name: string | RegExp) =>
  screen.queryByRole("button", { name, includeHiddenElements: true });

describe("StreakProtectionSheet", () => {
  describe("free user with a one-time restore", () => {
    it("offers the restore first, a workout second, and keeps Pro as a quiet link", () => {
      const handlers = renderSheet(baseStatus);

      expect(screen.getByRole("header")).toHaveTextContent(
        "Fill the gap from last week?"
      );
      expect(screen.getByText("Covers Jun 29 – Jul 5")).toBeTruthy();
      expect(screen.getByText("One-time restore, unused")).toBeTruthy();

      fireEvent.press(button("Use restore"));
      expect(handlers.onApplyProtection).toHaveBeenCalledWith(
        "lifetime_rescue"
      );

      expect(button("Train instead")).toBeTruthy();
      expect(button("Not now")).toBeTruthy();
      expect(queryButton(/Upgrade/)).toBeNull();
      expect(queryButton("Start over")).toBeNull();
      expect(screen.getByRole("link", { name: "See Pro" })).toBeTruthy();
    });

    it("closes the sheet before navigating to Pro details", () => {
      const handlers = renderSheet(baseStatus);

      fireEvent.press(screen.getByRole("link", { name: "See Pro" }));

      expect(handlers.onUpgrade).toHaveBeenCalledTimes(1);
      expect(handlers.onDismiss).not.toHaveBeenCalled();
    });
  });

  describe("free user with an earned freeze", () => {
    it("uses the earned freeze as the primary action", () => {
      const handlers = renderSheet(
        makeStatus({
          prompt_state: "free_earned_freeze",
          earned_freezes_available: 1,
          lifetime_rescue_available: false,
        })
      );

      expect(screen.getByText("1 freeze left")).toBeTruthy();
      fireEvent.press(button("Use freeze"));
      expect(handlers.onApplyProtection).toHaveBeenCalledWith("earned_freeze");
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("pro user with a manual freeze", () => {
    it("uses the pro freeze and shows the remaining balance", () => {
      const handlers = renderSheet(
        makeStatus({
          tier: "pro",
          is_pro_active: true,
          prompt_state: "pro_available_freeze",
          pro_freezes_available: 2,
          auto_apply_enabled: false,
        })
      );

      expect(screen.getByText("2 freezes left")).toBeTruthy();
      fireEvent.press(button("Use freeze"));
      expect(handlers.onApplyProtection).toHaveBeenCalledWith("pro_freeze");
      expect(screen.queryByRole("link")).toBeNull();
    });
  });

  describe("users without protection left", () => {
    it("leads free users with a comeback workout and requires confirmation to restart", () => {
      const handlers = renderSheet(
        makeStatus({
          prompt_state: "free_comeback",
          lifetime_rescue_available: false,
        })
      );

      expect(screen.getByRole("header")).toHaveTextContent("Good to see you");
      expect(screen.queryByText(/Covers/)).toBeNull();

      fireEvent.press(button("Start a workout"));
      expect(handlers.onComeback).toHaveBeenCalledTimes(1);
      expect(handlers.onDismiss).not.toHaveBeenCalled();

      fireEvent.press(button("Start over"));
      expect(handlers.onRestart).not.toHaveBeenCalled();
      expect(screen.getByRole("header")).toHaveTextContent("Start over?");
      expect(screen.getByText(/Everything you’ve logged stays/)).toBeTruthy();

      fireEvent.press(button("Back"));
      expect(screen.getByRole("header")).toHaveTextContent("Good to see you");

      fireEvent.press(button("Start over"));
      fireEvent.press(button("Start over"));
      expect(handlers.onRestart).toHaveBeenCalledTimes(1);
    });

    it("offers pro users a plan adjustment instead of an upgrade", () => {
      const handlers = renderSheet(
        makeStatus({
          tier: "pro",
          is_pro_active: true,
          prompt_state: "pro_comeback",
          lifetime_rescue_available: false,
        })
      );

      fireEvent.press(button("Adjust my plan"));
      expect(handlers.onAdjustPlan).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("link")).toBeNull();
      expect(button("Start over")).toBeTruthy();
    });
  });

  describe("dismissal", () => {
    it("treats Not now as a dismissal without triggering another action", () => {
      const handlers = renderSheet(baseStatus);

      fireEvent.press(button("Not now"));

      expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
      expect(handlers.onApplyProtection).not.toHaveBeenCalled();
      expect(handlers.onComeback).not.toHaveBeenCalled();
    });

    it("treats a backdrop tap as a dismissal", () => {
      const handlers = renderSheet(baseStatus);

      fireEvent.press(
        screen.getByLabelText("Close streak options", {
          includeHiddenElements: true,
        })
      );

      expect(handlers.onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("pending and error states", () => {
    it("marks the in-flight action busy and disables the others", () => {
      renderSheet(baseStatus, { pendingAction: "apply" });

      expect(button("Use restore")).toHaveAccessibilityState({
        busy: true,
        disabled: true,
      });
      expect(button("Train instead")).toHaveAccessibilityState({
        disabled: true,
      });
      expect(button("Not now")).toHaveAccessibilityState({ disabled: true });
    });

    it("shows a recoverable error and keeps the actions available to retry", () => {
      const handlers = renderSheet(baseStatus, { hasError: true });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "That didn’t go through. Your workouts are unaffected — try again."
      );
      expect(button("Use restore")).toHaveAccessibilityState({
        disabled: false,
      });

      fireEvent.press(button("Use restore"));
      expect(handlers.onApplyProtection).toHaveBeenCalledWith(
        "lifetime_rescue"
      );
    });
  });
});
