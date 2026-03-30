import { posthog } from "./posthog";

// Analytics event types - all events that can be tracked
export type EventName =
  // Onboarding events
  | "onboarding_step_completed"
  | "onboarding_completed"
  // Workout events
  | "workout_generated"
  | "workout_completed"
  | "session_duration"
  | "feedback_given";
// Future events can be added here

export type EventPayload = Record<string, unknown>;

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
      posthog.identify(undefined, properties);
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
