import Constants from "expo-constants";
import * as Localization from "expo-localization";
import { Platform } from "react-native";
import PostHog from "posthog-react-native";

/** The schema version attached to every custom analytics event. */
export const ANALYTICS_SCHEMA_VERSION = 1;

export type AnalyticsEnvironment =
  | "development"
  | "preview"
  | "production"
  | "test";

interface AnalyticsConfig {
  environment: AnalyticsEnvironment;
  host: string | null;
  key: string | null;
  enabled: boolean;
  localCaptureEnabled: boolean;
}

function getEnvironment(): AnalyticsEnvironment {
  const configured = (
    process.env.EXPO_PUBLIC_APP_ENV ??
    process.env.EXPO_PUBLIC_ANALYTICS_ENV ??
    process.env.APP_ENV ??
    process.env.NODE_ENV
  )?.toLowerCase();

  if (configured === "production" || configured === "preview") {
    return configured;
  }

  if (configured === "test") {
    return "test";
  }

  // Expo exposes __DEV__ in native builds. The fallback keeps this module safe
  // in unit tests and in tooling that does not define the global.
  return typeof __DEV__ !== "undefined" && __DEV__
    ? "development"
    : "production";
}

function normalizeHost(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function isLocalHost(host: string | null): boolean {
  if (!host) return false;

  try {
    const { hostname } = new URL(host);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

function createAnalyticsConfig(): AnalyticsConfig {
  const environment = getEnvironment();
  const key = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim() || null;
  const host = normalizeHost(process.env.EXPO_PUBLIC_POSTHOG_HOST);
  const localCaptureEnabled =
    process.env.EXPO_PUBLIC_POSTHOG_ENABLE_LOCAL === "true";
  const isLocalEnvironment =
    environment === "development" || environment === "test";
  const hasSafeProductionHost =
    isLocalEnvironment ||
    (host !== null &&
      new URL(host).protocol === "https:" &&
      !isLocalHost(host));

  // Local builds are deliberately isolated. A developer must opt in and use a
  // key explicitly; this prevents a production key in a local .env from
  // polluting launch dashboards. Preview and production require a key.
  const enabled = Boolean(
    key &&
      host &&
      hasSafeProductionHost &&
      (!isLocalEnvironment || localCaptureEnabled)
  );

  return {
    environment,
    host,
    key,
    enabled,
    localCaptureEnabled,
  };
}

export const analyticsConfig = createAnalyticsConfig();
export const analyticsEnvironment = analyticsConfig.environment;
export const isAnalyticsEnabled = analyticsConfig.enabled;

if (
  !analyticsConfig.key &&
  analyticsEnvironment !== "development" &&
  analyticsEnvironment !== "test"
) {
  // Do not throw during startup: analytics must never block the app. The
  // warning is intentionally actionable for EAS preview/production builds.
  console.warn(
    `[PostHog] Missing EXPO_PUBLIC_POSTHOG_KEY for ${analyticsEnvironment} environment. Analytics is disabled.`
  );
}

if (
  analyticsConfig.key &&
  !analyticsConfig.enabled &&
  analyticsEnvironment !== "development" &&
  analyticsEnvironment !== "test"
) {
  console.warn(
    `[PostHog] Analytics configuration is unsafe for ${analyticsEnvironment} environment. Analytics is disabled.`
  );
}

// Session replay and touch autocapture stay disabled for the MVP. The app has
// credentials, workout notes, measurements, strength values, and health-related
// screens that require a dedicated masking/privacy review before replay.
export const posthog =
  analyticsConfig.enabled && analyticsConfig.key
    ? new PostHog(analyticsConfig.key, {
        host: analyticsConfig.host ?? undefined,
        captureAppLifecycleEvents: false,
        enableSessionReplay: false,
        flushAt: 20,
        flushInterval: 30000,
      })
    : null;

export interface SharedAnalyticsProperties {
  analytics_schema_version: number;
  environment: AnalyticsEnvironment;
  app_version: string;
  build_number: string;
  platform: string;
  locale: string;
}

function getExpoConfigValue(key: string): string | null {
  const config = Constants.expoConfig as
    | (Record<string, unknown> & {
        ios?: Record<string, unknown>;
        android?: Record<string, unknown>;
      })
    | null;

  const value = config?.[key];
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

function getBuildNumber(): string {
  const config = Constants.expoConfig as {
    ios?: { buildNumber?: string | number };
    android?: { versionCode?: string | number };
  } | null;
  const platformBuild =
    Platform.OS === "ios"
      ? config?.ios?.buildNumber
      : config?.android?.versionCode;
  return platformBuild === undefined || platformBuild === null
    ? "unknown"
    : String(platformBuild);
}

function getLocale(): string {
  try {
    const locale = Localization.getLocales()[0];
    return locale?.languageTag ?? locale?.languageCode ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Properties shared by every custom event and manually captured screen. */
export function getSharedAnalyticsProperties(): SharedAnalyticsProperties {
  return {
    analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
    environment: analyticsEnvironment,
    app_version: getExpoConfigValue("version") ?? "unknown",
    build_number: getBuildNumber(),
    platform: Platform.OS,
    locale: getLocale(),
  };
}

/**
 * Invoke a PostHog SDK method without allowing a synchronous exception or a
 * rejected promise to escape into the application. Most methods are
 * synchronous today, but `flush` and `screen` return promises and SDK
 * versions can change, so every boundary is treated as potentially async.
 */
export function safelyCallPostHog(action: () => unknown): void {
  try {
    const result = action();
    if (
      result !== null &&
      (typeof result === "object" || typeof result === "function") &&
      "then" in result &&
      typeof (result as { then?: unknown }).then === "function"
    ) {
      void Promise.resolve(result).catch(() => undefined);
    }
  } catch {
    // Analytics failures must never affect the user-facing app.
  }
}

/** Flush pending events when the app is backgrounded or before a reset. */
export function flushPostHog(): void {
  if (!posthog) return;

  safelyCallPostHog(() => posthog.flush());
}

export function disablePostHog(): void {
  safelyCallPostHog(() => posthog?.optOut());
}

export function enablePostHog(): void {
  safelyCallPostHog(() => posthog?.optIn());
}
