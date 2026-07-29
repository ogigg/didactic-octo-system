import {
  criticalFunnelEventSet,
  type EventName,
  validateEventPayload,
} from "./analytics-contract";
import { posthog } from "./posthog";

type Primitive = string | number | boolean | null;
type EventValue = Primitive | Primitive[];
export type EventPayload = Record<string, EventValue>;
export type { EventName } from "./analytics-contract";

const DUPLICATE_WINDOW_MS = 1_000;
const recentCriticalEvents = new Map<string, number>();

function payloadSignature(name: EventName, payload: EventPayload): string {
  const entries = Object.entries(payload).sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return JSON.stringify([name, entries]);
}

export function resetAnalyticsDuplicateDetector(): void {
  recentCriticalEvents.clear();
}

function isDuplicateCriticalEvent(
  name: EventName,
  payload: EventPayload,
  now = Date.now()
): boolean {
  if (!criticalFunnelEventSet.has(name)) return false;

  const signature = payloadSignature(name, payload);
  const previousTimestamp = recentCriticalEvents.get(signature);
  recentCriticalEvents.set(signature, now);

  for (const [storedSignature, timestamp] of recentCriticalEvents) {
    if (now - timestamp > DUPLICATE_WINDOW_MS) {
      recentCriticalEvents.delete(storedSignature);
    }
  }

  return (
    previousTimestamp !== undefined &&
    now - previousTimestamp <= DUPLICATE_WINDOW_MS
  );
}

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
  const validation = validateEventPayload(name, payload);
  if (!validation.success) {
    console.error("[analytics] Invalid event payload", {
      event: name,
      issues: validation.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (isDuplicateCriticalEvent(name, payload)) {
    console.warn("[analytics] Duplicate critical event suppressed", {
      event: name,
    });
    return;
  }

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
