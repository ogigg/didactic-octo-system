import PostHog from "posthog-react-native";

import { getAnalyticsConfigHealth, postHogConfig } from "./analytics-config";

export const analyticsConfigHealth = getAnalyticsConfigHealth(postHogConfig);

if (analyticsConfigHealth.status !== "healthy") {
  if (__DEV__) {
    console.warn(
      `[PostHog] Analytics configuration is ${analyticsConfigHealth.status}. Analytics will be disabled.`
    );
  }
}

export const posthog =
  analyticsConfigHealth.status === "healthy" && postHogConfig.key
    ? new PostHog(postHogConfig.key, {
        host: analyticsConfigHealth.hostOrigin ?? undefined,
        captureAppLifecycleEvents: true,
        flushAt: 20,
        flushInterval: 30000,
      })
    : null;

if (__DEV__) {
  if (posthog) {
    console.log("[PostHog] Initialized successfully");
  }
} else {
  console.info("[analytics] configuration health", analyticsConfigHealth);
}

/**
 * Flush any pending events immediately
 * Useful when app is about to go to background or terminate
 */
export function flushPostHog(): void {
  if (posthog) {
    posthog.flush();
  }
}

/**
 * Disable PostHog analytics (e.g., for opt-out scenarios)
 */
export function disablePostHog(): void {
  if (posthog) {
    posthog.optOut();
  }
}

/**
 * Re-enable PostHog analytics
 */
export function enablePostHog(): void {
  if (posthog) {
    posthog.optIn();
  }
}
