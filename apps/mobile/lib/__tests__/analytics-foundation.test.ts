jest.mock("../posthog", () => ({
  analyticsEnvironment: "test",
  getSharedAnalyticsProperties: jest.fn(() => ({
    analytics_schema_version: 1,
    environment: "test",
    app_version: "1.0.0",
    build_number: "1",
    platform: "ios",
    locale: "en",
  })),
  safelyCallPostHog: (action: () => unknown) => {
    try {
      const result = action();
      if (
        result !== null &&
        (typeof result === "object" || typeof result === "function") &&
        "then" in result &&
        typeof (result as { then?: unknown }).then === "function"
      ) {
        void Promise.resolve(result).catch(() => undefined);
      }
    } catch {
      // Analytics failures are intentionally ignored in tests as in app code.
    }
  },
  posthog: {
    capture: jest.fn(),
    identify: jest.fn(),
    setPersonProperties: jest.fn(),
    reset: jest.fn(),
    flush: jest.fn(),
    screen: jest.fn(),
  },
}));

import { posthog } from "../posthog";
import {
  getIdentifiedUserId,
  identifyUser,
  normalizeAuthError,
  resetScreenTrackingState,
  resetUser,
  sanitizeEventPayload,
  setUserProperties,
  screenNameFromPath,
  trackEvent,
  trackScreenView,
} from "../track-event";

const mockPostHog = posthog as unknown as {
  capture: jest.Mock;
  identify: jest.Mock;
  setPersonProperties: jest.Mock;
  reset: jest.Mock;
  flush: jest.Mock;
  screen: jest.Mock;
};

beforeEach(() => {
  resetUser();
  jest.clearAllMocks();
  resetScreenTrackingState();
});

describe("analytics foundation", () => {
  it("keeps only allowlisted, non-sensitive event properties", () => {
    expect(
      sanitizeEventPayload("workout_completed", {
        workout_session_id: "session-1",
        completion_rate: 0.5,
        workout_name: "Private workout title",
        custom_goal_snapshot: "Private goal",
        error: "raw provider error",
        unexpected: "not part of the contract",
      })
    ).toEqual({
      workout_session_id: "session-1",
      completion_rate: 0.5,
    });
  });

  it("adds shared properties and strips free text before capture", () => {
    trackEvent("workout_summary_share_failed", {
      duration_seconds: 120,
      error: "raw exception details",
    });

    expect(mockPostHog.capture).toHaveBeenCalledWith(
      "workout_summary_share_failed",
      expect.objectContaining({
        analytics_schema_version: 1,
        environment: "test",
        duration_seconds: 120,
      })
    );
    expect(mockPostHog.capture.mock.calls[0][1]).not.toHaveProperty("error");
  });

  it("identifies by UUID and never calls identify without a distinct id", () => {
    setUserProperties({
      goal_category: "strength",
      email: "private@example.com",
    });
    expect(mockPostHog.identify).not.toHaveBeenCalled();

    identifyUser("user-uuid", { weekly_frequency: 3 });
    expect(getIdentifiedUserId()).toBe("user-uuid");
    expect(mockPostHog.identify).toHaveBeenCalledWith(
      "user-uuid",
      expect.objectContaining({
        goal_category: "strength",
        weekly_frequency: 3,
      })
    );
    expect(mockPostHog.identify.mock.calls[0][1]).not.toHaveProperty("email");
  });

  it("does not re-identify the same UUID on repeated auth callbacks", () => {
    identifyUser("user-uuid");
    jest.clearAllMocks();

    identifyUser("user-uuid");

    expect(mockPostHog.identify).not.toHaveBeenCalled();
    expect(mockPostHog.reset).not.toHaveBeenCalled();
    expect(mockPostHog.flush).not.toHaveBeenCalled();
  });

  it("flushes and resets before identifying a different UUID", () => {
    identifyUser("first-user");
    jest.clearAllMocks();

    identifyUser("second-user");

    expect(mockPostHog.flush).toHaveBeenCalledTimes(1);
    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
    expect(mockPostHog.identify).toHaveBeenCalledWith("second-user", {});
    expect(mockPostHog.flush.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostHog.identify.mock.invocationCallOrder[0]
    );
    expect(mockPostHog.reset.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostHog.identify.mock.invocationCallOrder[0]
    );
  });

  it("resets the identified person on logout", () => {
    identifyUser("user-uuid");
    resetUser();

    expect(getIdentifiedUserId()).toBeNull();
    expect(mockPostHog.reset).toHaveBeenCalledTimes(1);
  });

  it("normalizes provider errors without returning raw messages", () => {
    expect(normalizeAuthError({ message: "Invalid login credentials" })).toBe(
      "invalid_credentials"
    );
    expect(normalizeAuthError({ code: "ERR_REQUEST_CANCELED" })).toBe(
      "provider_cancelled"
    );
    expect(normalizeAuthError(new Error("something else"))).toBe("unknown");
  });

  it("maps only reviewed Expo Router paths to stable screen names", () => {
    expect(screenNameFromPath("/(auth)/sign-in?token=secret")).toBe("sign_in");
    expect(screenNameFromPath("/(tabs)/index")).toBe("home");
    expect(screenNameFromPath("/(onboarding)/goal")).toBe("onboarding_goal");
    expect(screenNameFromPath("/(onboarding)/not-a-step")).toBeNull();
    expect(screenNameFromPath("/(onboarding)/goal/private-id")).toBeNull();
    expect(screenNameFromPath("/onboarding/custom-step")).toBeNull();
    expect(screenNameFromPath("/workout-detail/private-id")).toBe(
      "workout_detail"
    );
    expect(screenNameFromPath("/unknown/private-id")).toBeNull();

    trackScreenView("/(auth)/sign-in?token=secret");
    expect(mockPostHog.screen).toHaveBeenCalledWith(
      "sign_in",
      expect.objectContaining({ screen_name: "sign_in", environment: "test" })
    );
  });

  it("drops difficulty feedback values outside the reviewed enum", () => {
    expect(
      sanitizeEventPayload("difficulty_feedback_given", {
        exercise_id: "exercise-1",
        feedback: "private free text",
        difficulty: "too_hard",
      })
    ).toEqual({
      exercise_id: "exercise-1",
      difficulty: "too_hard",
    });
  });

  it("does not leak async PostHog screen rejections", async () => {
    mockPostHog.screen.mockRejectedValueOnce(new Error("network"));

    trackScreenView("/history");
    await Promise.resolve();

    expect(mockPostHog.screen).toHaveBeenCalledTimes(1);
  });
});
