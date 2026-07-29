const DEFAULT_POSTHOG_HOST = "https://app.posthog.com";
const ALLOWED_POSTHOG_ORIGINS = new Set([
  "https://app.posthog.com",
  "https://eu.i.posthog.com",
  "https://eu.posthog.com",
  "https://us.i.posthog.com",
]);

export interface AnalyticsConfigHealth {
  keyConfigured: boolean;
  hostOrigin: string | null;
  status: "healthy" | "invalid_host" | "invalid_key" | "missing_key";
}

interface AnalyticsConfig {
  key?: string;
  host?: string;
}

export function getAnalyticsConfigHealth({
  key,
  host = DEFAULT_POSTHOG_HOST,
}: AnalyticsConfig): AnalyticsConfigHealth {
  const keyConfigured = Boolean(key?.trim());
  const keyValid = Boolean(key && /^phc_[A-Za-z0-9_-]{20,}$/.test(key));

  try {
    const url = new URL(host);
    const hostOrigin =
      url.protocol === "https:" && ALLOWED_POSTHOG_ORIGINS.has(url.origin)
        ? url.origin
        : null;

    if (!hostOrigin) {
      return { keyConfigured, hostOrigin: null, status: "invalid_host" };
    }

    return {
      keyConfigured,
      hostOrigin,
      status: !keyConfigured
        ? "missing_key"
        : keyValid
          ? "healthy"
          : "invalid_key",
    };
  } catch {
    return { keyConfigured, hostOrigin: null, status: "invalid_host" };
  }
}

export const postHogConfig = {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
};
