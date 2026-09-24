export interface NormalizedAnalyticsError {
  error_code:
    | "network"
    | "timeout"
    | "auth"
    | "rate_limited"
    | "validation"
    | "server"
    | "unknown";
  retryable: boolean;
  is_offline: boolean;
}

/**
 * Convert transport/API errors into a small, privacy-safe analytics taxonomy.
 * Raw provider messages must never be included in PostHog payloads.
 */
export function normalizeAnalyticsError(
  error: unknown
): NormalizedAnalyticsError {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const value = `${code} ${message}`;

  if (
    value.includes("generation_limit_reached") ||
    value.includes("rate limit") ||
    value.includes("too many requests")
  ) {
    return { error_code: "rate_limited", retryable: false, is_offline: false };
  }
  if (
    value.includes("auth") ||
    value.includes("not authenticated") ||
    value.includes("unauthorized") ||
    value.includes("invalid token")
  ) {
    return { error_code: "auth", retryable: false, is_offline: false };
  }
  if (
    value.includes("timeout") ||
    value.includes("timed out") ||
    value.includes("abort")
  ) {
    return { error_code: "timeout", retryable: true, is_offline: false };
  }
  if (
    value.includes("network") ||
    value.includes("fetch") ||
    value.includes("offline") ||
    value.includes("connection")
  ) {
    return { error_code: "network", retryable: true, is_offline: true };
  }
  if (
    value.includes("validation") ||
    value.includes("invalid response") ||
    value.includes("parse")
  ) {
    return { error_code: "validation", retryable: false, is_offline: false };
  }
  if (value.includes("internal") || value.includes("server")) {
    return { error_code: "server", retryable: true, is_offline: false };
  }

  return { error_code: "unknown", retryable: false, is_offline: false };
}
