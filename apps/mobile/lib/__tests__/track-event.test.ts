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

  it("does not throw for queue lifecycle events", () => {
    expect(() =>
      trackEvent("workout_queue_initialized", {
        count: 4,
        trigger: "onboarding",
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("pending_workout_generated", {
        generation_source: "llm",
        trigger: "onboarding",
        generation_time_ms: 1500,
        queue_position: 1,
        focus_area: "upper",
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("workout_queue_ready", {
        total_generation_time_ms: 6000,
        count: 4,
        fallback_count: 1,
      })
    ).not.toThrow();
  });

  it("does not throw for preview and edit events", () => {
    expect(() =>
      trackEvent("workout_preview_viewed", {
        queue_position: 2,
        time_on_screen_ms: 3400,
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("pending_workout_started", {
        time_since_generated_ms: 45000,
        was_edited: true,
        edit_count: 2,
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("pending_workout_regenerated", {
        queue_position: 2,
        focus_area: "lower",
        previous_generation_source: "fallback_template",
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("pending_workout_edited", {
        edit_type: "swap_exercise",
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

  it("does not throw for settings and queue open events", () => {
    expect(() =>
      trackEvent("strength_baseline_entered", {
        exercise_key: "bb_squat",
        has_load: true,
        source: "settings",
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("training_preferences_changed", {
        changed_fields: ["difficulty_level", "training_style"],
        triggered_queue_rebuild: true,
      })
    ).not.toThrow();

    expect(() =>
      trackEvent("queue_state_on_open", {
        ready_count: 2,
        generating_count: 1,
        total_count: 4,
        has_active_workout: false,
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
