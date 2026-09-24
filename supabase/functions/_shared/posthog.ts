/**
 * Best-effort server-side PostHog capture for Edge Functions.
 *
 * Generation must never depend on analytics availability. Callers intentionally
 * do not await `capturePostHogEvent`; this helper uses EdgeRuntime.waitUntil
 * when available, has a short timeout, and swallows all transport/configuration
 * errors.
 */

export interface PostHogEventProperties {
  analytics_schema_version?: number;
  environment?: string;
  request_id?: string;
  workout_id?: string;
  queue_position?: number;
  generation_source?: string;
  generation_time_ms?: number;
  trigger?: string;
  failure_stage?: string;
  error_code?: string;
  retryable?: boolean;
  count?: number;
  fallback_count?: number;
  total_generation_time_ms?: number;
  ready_count?: number;
  failed_count?: number;
}

export interface GenerationFailure {
  error_code:
    | "generation_failed"
    | "rate_limited"
    | "validation"
    | "profile_missing"
    | "persistence"
    | "auth"
    | "internal";
  failure_stage:
    | "validation"
    | "allowance"
    | "rate_limit"
    | "profile"
    | "generation"
    | "persistence"
    | "handler";
  retryable: boolean;
}

const POSTHOG_CAPTURE_TIMEOUT_MS = 1_500;
const ANALYTICS_SCHEMA_VERSION = 1;

function posthogCaptureUrl(): string | null {
  const projectToken = Deno.env.get("POSTHOG_PROJECT_TOKEN");
  const configuredHost = Deno.env.get("POSTHOG_HOST");
  if (!projectToken || !configuredHost) return null;

  try {
    const host = new URL(configuredHost);
    if (host.protocol !== "https:") return null;
    return `${host.toString().replace(/\/$/, "")}/i/v0/e/`;
  } catch {
    return null;
  }
}

/**
 * Send an event without making the caller wait or exposing event delivery
 * errors to the product path. `$insert_id` lets PostHog deduplicate retries;
 * `event_id` is also retained for operational joins and debugging.
 */
export function capturePostHogEvent(
  event: string,
  distinctId: string,
  properties: PostHogEventProperties = {}
): void {
  const url = posthogCaptureUrl();
  const projectToken = Deno.env.get("POSTHOG_PROJECT_TOKEN");
  if (!url || !projectToken) return;

  const eventId = crypto.randomUUID();
  const body = JSON.stringify({
    api_key: projectToken,
    event,
    distinct_id: distinctId,
    properties: {
      analytics_schema_version: ANALYTICS_SCHEMA_VERSION,
      environment: Deno.env.get("APP_ENV") ?? "production",
      ...properties,
      event_id: eventId,
      $insert_id: eventId,
      source: "supabase_edge_function",
    },
  });

  const delivery = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      POSTHOG_CAPTURE_TIMEOUT_MS
    );
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: controller.signal,
      });
    } catch {
      // Analytics is deliberately non-critical. Do not log body, key, or
      // provider errors because they can contain sensitive request context.
    } finally {
      clearTimeout(timeout);
    }
  })();

  // Supabase Edge Functions can terminate an unreferenced promise as soon as
  // the handler returns. Keep the delivery alive when the runtime exposes the
  // standard waitUntil hook, while retaining a safe local fallback for tests.
  const runtime = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
    }
  ).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(delivery);
  } else {
    void delivery;
  }
}

export function normalizeGenerationFailure(
  stage: GenerationFailure["failure_stage"],
  error: unknown
): GenerationFailure {
  const value =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error ?? "").toLowerCase();

  if (
    stage === "allowance" ||
    value.includes("rate limit") ||
    value.includes("generation_limit_reached")
  ) {
    return {
      error_code: "rate_limited",
      failure_stage: stage === "allowance" ? stage : "rate_limit",
      retryable: false,
    };
  }
  if (stage === "validation") {
    return { error_code: "validation", failure_stage: stage, retryable: false };
  }
  if (stage === "profile") {
    return {
      error_code: "profile_missing",
      failure_stage: stage,
      retryable: false,
    };
  }
  if (stage === "persistence") {
    return {
      error_code: "persistence",
      failure_stage: stage,
      retryable: true,
    };
  }
  if (stage === "generation") {
    return {
      error_code: "generation_failed",
      failure_stage: stage,
      retryable: true,
    };
  }

  return { error_code: "internal", failure_stage: "handler", retryable: true };
}
