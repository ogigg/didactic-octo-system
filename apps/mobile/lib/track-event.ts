import {
  type EventPayload,
  type EventName,
  operationalJourneyEventSet,
  validateEventPayload,
} from "./analytics-contract";
import { posthog } from "./posthog";

type Primitive = string | number | boolean | null;
type EventValue = Primitive | Primitive[];
export type AnalyticsEventPayload = Record<string, EventValue>;
export type { EventName, EventPayload } from "./analytics-contract";

const trackedOperationalOccurrences = new Set<string>();

export function resetAnalyticsDuplicateDetector(): void {
  trackedOperationalOccurrences.clear();
}

function isDuplicateOperationalEvent<Name extends EventName>(
  name: Name,
  payload: EventPayload<Name>
): boolean {
  if (!operationalJourneyEventSet.has(name)) return false;

  const occurrenceId = payload.occurrence_id;
  if (typeof occurrenceId !== "string") return false;

  const dedupeKey = `${name}:${occurrenceId}`;
  if (trackedOperationalOccurrences.has(dedupeKey)) return true;

  trackedOperationalOccurrences.add(dedupeKey);
  return false;
}

function reportContractViolation(
  name: EventName,
  issues: { code: string; path: (string | number)[] }[]
): void {
  if (!posthog) return;

  try {
    posthog.capture("analytics_contract_violation", {
      event_name: name,
      issue_codes: [...new Set(issues.map((issue) => issue.code))],
      issue_paths: issues.map((issue) => issue.path.join(".")).filter(Boolean),
    });
  } catch (error) {
    console.error("[analytics] Failed to report contract violation:", error);
  }
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
export function trackEvent<Name extends EventName>(
  name: Name,
  payload: EventPayload<Name>
): void {
  const validation = validateEventPayload(name, payload);
  if (!validation.success) {
    reportContractViolation(name, validation.error.issues);
    console.error("[analytics] Invalid event payload", {
      event: name,
      issues: validation.error.issues.map((issue) => ({
        code: issue.code,
        path: issue.path.join("."),
      })),
    });
    return;
  }

  if (isDuplicateOperationalEvent(name, payload)) {
    console.warn("[analytics] Duplicate operational event suppressed", {
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
      posthog.identify(undefined, properties as AnalyticsEventPayload);
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
