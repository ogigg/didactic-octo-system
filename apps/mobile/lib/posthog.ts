import PostHog from "posthog-react-native";

// PostHog Analytics Configuration
// Uses environment variables following Expo's convention
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://app.posthog.com";

// Validate that required environment variables are set
if (!posthogKey) {
  if (__DEV__) {
    console.warn(
      "[PostHog] EXPO_PUBLIC_POSTHOG_KEY not set. Analytics will be disabled."
    );
  }
}

// Create PostHog client instance
export const posthog = posthogKey
  ? new PostHog(posthogKey, {
      host: posthogHost,
      captureApplicationLifecycleEvents: true,
      captureScreenViews: true,
      debug: __DEV__,
      // Additional PostHog configuration options
      flushAt: 20, // Number of events to batch before sending
      flushInterval: 30000, // Flush every 30 seconds
    })
  : null;

/**
 * Initialize PostHog analytics
 * Call this once when the app starts
 */
export function initPostHog(): void {
  if (posthog) {
    posthog.start();
    if (__DEV__) {
      console.log("[PostHog] Initialized successfully");
    }
  }
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
