type EventName = "onboarding_step_completed" | "onboarding_completed";
type EventPayload = Record<string, unknown>;

/**
 * Thin analytics wrapper. Replace body with actual provider call
 * (e.g. Amplitude, PostHog) when analytics are wired up.
 */
export function trackEvent(name: EventName, payload: EventPayload = {}): void {
  if (__DEV__) {
    console.log("[analytics]", name, payload);
  }
  // TODO: call analytics provider here
}
