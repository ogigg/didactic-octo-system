import PostHog from "posthog-react-native";

import { sanitizePostHogEvent } from "./posthog-privacy";

// PostHog Analytics Configuration
// Uses environment variables following Expo's convention
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const posthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";

// Validate that required environment variables are set
if (!posthogKey) {
  if (__DEV__) {
    console.warn(
      "[PostHog] EXPO_PUBLIC_POSTHOG_KEY not set. Analytics will be disabled."
    );
  }
}

// Create PostHog client instance
// PostHog client starts immediately upon creation
export const posthog = posthogKey
  ? new PostHog(posthogKey, {
      host: posthogHost,
      captureAppLifecycleEvents: true,
      before_send: sanitizePostHogEvent,
      errorTracking: {
        autocapture: {
          uncaughtExceptions: true,
          unhandledRejections: true,
          // Console messages can contain user-entered notes or prompts.
          console: [],
          // Native exception reasons bypass `before_send`. Keep native
          // autocapture disabled until a built-app redaction test can enforce
          // the same privacy contract as JavaScript exceptions.
          nativeCrashes: false,
        },
      },
      // Additional PostHog configuration options
      flushAt: 20, // Number of events to batch before sending
      flushInterval: 30000, // Flush every 30 seconds
    })
  : null;

// Log successful initialization
if (posthog && __DEV__) {
  console.log("[PostHog] Initialized successfully");
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
