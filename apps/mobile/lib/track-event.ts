import { posthog } from "./posthog";

// Analytics event types - all events that can be tracked
export type EventName =
  // Onboarding events
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "strength_baseline_entered"
  // Workout events
  | "workout_generated"
  | "workout_queue_initialized"
  | "workout_queue_ready"
  | "pending_workout_generated"
  | "pending_workout_started"
  | "pending_workout_regenerated"
  | "pending_workout_edited"
  | "workout_preview_viewed"
  | "workout_completed"
  | "session_duration"
  | "feedback_given"
  | "difficulty_feedback_given"
  | "workout_comment_submitted"
  | "workout_summary_share_requested"
  | "workout_summary_share_unavailable"
  | "workout_summary_share_completed"
  | "workout_summary_share_failed"
  | "training_preferences_changed"
  | "queue_state_on_open"
  | "activation_recovery_exposed"
  | "activation_recovery_attempted"
  | "activation_recovery_succeeded"
  // Streak protection events
  | "streak_status_viewed"
  | "streak_prompt_shown"
  | "streak_prompt_dismissed"
  | "streak_protection_applied"
  | "streak_lifetime_rescue_used"
  | "streak_freeze_earned"
  | "streak_restarted"
  | "comeback_workout_started"
  | "comeback_workout_completed"
  | "streak_upgrade_tapped";
// Future events can be added here

type Primitive = string | number | boolean | null;
type EventValue = Primitive | Primitive[];
export type EventPayload = Record<string, EventValue>;

/**
 * Thin analytics wrapper using PostHog.
 *
 * Events are sent to PostHog for production analytics.
 * In development, events are logged to console for debugging.
 *
 * @param name - The event name to track
 * @param payload - Event data to send with the event
 */
export function trackEvent(name: EventName, payload: EventPayload = {}): void {
  // Always log in development for debugging
  if (__DEV__) {
    console.log("[analytics]", name, payload);
  }

  // Send event to PostHog if initialized
  if (posthog) {
    try {
      posthog.capture(name, payload);
    } catch (error) {
      // Log errors but don't crash the app
      console.error("[analytics] Failed to track event:", error);
    }
  } else if (__DEV__) {
    // Warn in development if PostHog is not configured
    console.warn(
      "[analytics] PostHog not configured. Events will not be tracked in production."
    );
  }
}

/**
 * Set user properties in PostHog.
 * Use this to attach user-specific data like goals, preferences, etc.
 *
 * @param properties - User properties to set
 */
export function setUserProperties(properties: Record<string, unknown>): void {
  if (posthog) {
    try {
      // PostHog identify sets user ID and properties
      posthog.identify(undefined, properties as EventPayload);
    } catch (error) {
      console.error("[analytics] Failed to set user properties:", error);
    }
  }
}

/**
 * Reset user analytics (e.g., on logout).
 * Clears any user-specific data from the analytics session.
 */
export function resetUser(): void {
  if (posthog) {
    try {
      posthog.reset();
    } catch (error) {
      console.error("[analytics] Failed to reset user:", error);
    }
  }
}
