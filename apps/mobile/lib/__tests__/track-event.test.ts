import { trackEvent, setUserProperties, resetUser } from "../track-event";

describe("trackEvent", () => {
  it("does not throw when called", () => {
    expect(() => trackEvent("onboarding_completed", {})).not.toThrow();
  });

  it("does not throw with step payload", () => {
    expect(() =>
      trackEvent("onboarding_step_completed", {
        step: "gender",
        skipped: false,
      })
    ).not.toThrow();
  });

  it("does not throw for workout_generated event", () => {
    expect(() =>
      trackEvent("workout_generated", {
        generation_source: "llm",
        training_split: "full_body",
        duration_minutes: 30,
        equipment: "dumbbells",
        training_style: "strength",
        difficulty: "beginner",
        exercise_count: 5,
        has_custom_prompt: false,
      })
    ).not.toThrow();
  });

  it("does not throw for workout_completed event", () => {
    expect(() =>
      trackEvent("workout_completed", {
        workout_name: "Full Body Workout",
        exercise_count: 5,
        total_sets: 20,
        completed_sets: 18,
        completion_rate: 90,
        total_volume_kg: 5000,
        duration_seconds: 1200,
        goal_snapshot: "build_strength",
        custom_goal_snapshot: null,
      })
    ).not.toThrow();
  });

  it("does not throw for session_duration event", () => {
    expect(() =>
      trackEvent("session_duration", {
        workout_name: "Full Body Workout",
        duration_seconds: 1200,
        exercise_count: 5,
        completion_rate: 90,
      })
    ).not.toThrow();
  });

  it("does not throw for feedback_given event", () => {
    expect(() =>
      trackEvent("feedback_given", {
        exercise_id: "exercise-123",
        difficulty: "ok",
        session_id: "session-456",
      })
    ).not.toThrow();
  });
});

describe("setUserProperties", () => {
  it("does not throw when called", () => {
    expect(() =>
      setUserProperties({
        goal: "build_strength",
        frequency: 3,
        equipment: "dumbbells",
      })
    ).not.toThrow();
  });
});

describe("resetUser", () => {
  it("does not throw when called", () => {
    expect(() => resetUser()).not.toThrow();
  });
});
