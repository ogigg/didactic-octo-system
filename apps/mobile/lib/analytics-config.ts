const DEFAULT_POSTHOG_HOST = "https://app.posthog.com";

export interface AnalyticsConfigHealth {
  keyConfigured: boolean;
  hostOrigin: string | null;
  status: "healthy" | "missing_key" | "invalid_host";
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

  try {
    const url = new URL(host);
    const hostOrigin = url.protocol === "https:" ? url.origin : null;

    if (!hostOrigin) {
      return { keyConfigured, hostOrigin: null, status: "invalid_host" };
    }

    return {
      keyConfigured,
      hostOrigin,
      status: keyConfigured ? "healthy" : "missing_key",
    };
  } catch {
    return { keyConfigured, hostOrigin: null, status: "invalid_host" };
  }
}

export const postHogConfig = {
  host: process.env.EXPO_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST,
  key: process.env.EXPO_PUBLIC_POSTHOG_KEY,
};
