export type OperationalArea = "feedback" | "generation" | "sync";
export type OperationalOutcome =
  | "failure"
  | "fallback"
  | "resolved"
  | "success"
  | "triggered";

export interface OperationalEvent {
  area: OperationalArea;
  operation: string;
  outcome: OperationalOutcome;
  journeyStage: string;
  userId?: string;
  durationMs?: number;
  failureCode?: string;
  fallbackReason?: string;
  generationSource?: string;
  count?: number;
  fallbackCount?: number;
  testIncidentId?: string;
}

interface EdgeRuntimeLike {
  waitUntil(promise: Promise<unknown>): void;
}

async function pseudonymousUserId(userId: string): Promise<string> {
  const salt = Deno.env.get("OBSERVABILITY_HASH_SALT") ?? "";
  const bytes = new TextEncoder().encode(`${salt}:${userId}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function buildOperationalProperties(
  input: OperationalEvent,
  appVersion: string
): Record<string, string | number | boolean | null> {
  return {
    $process_person_profile: false,
    area: input.area,
    operation: input.operation,
    outcome: input.outcome,
    severity: input.outcome === "failure" ? "critical" : "info",
    journey_stage: input.journeyStage,
    app_version: appVersion,
    platform: "edge",
    duration_ms: input.durationMs ?? null,
    failure_code: input.failureCode ?? null,
    fallback_reason: input.fallbackReason ?? null,
    generation_source: input.generationSource ?? null,
    count: input.count ?? null,
    fallback_count: input.fallbackCount ?? null,
    test_incident_id: input.testIncidentId ?? null,
  };
}

async function sendOperationalEvent(input: OperationalEvent): Promise<void> {
  const projectKey = Deno.env.get("POSTHOG_PROJECT_KEY");
  if (!projectKey) {
    console.warn(
      "[observability] POSTHOG_PROJECT_KEY is not configured; event dropped",
      { area: input.area, operation: input.operation, outcome: input.outcome }
    );
    return;
  }

  const host = (
    Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  const distinctId = input.userId
    ? await pseudonymousUserId(input.userId)
    : "edge-system";

  const response = await fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: projectKey,
      event: "operational_event",
      distinct_id: distinctId,
      properties: buildOperationalProperties(
        input,
        Deno.env.get("APP_VERSION") ??
          Deno.env.get("DENO_DEPLOYMENT_ID") ??
          "unknown"
      ),
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed with status ${response.status}`);
  }
}

/**
 * Best-effort reporting that never changes the customer-facing operation.
 * Supabase Edge Runtime keeps the promise alive after the response is returned.
 */
export function reportOperationalEvent(input: OperationalEvent): void {
  const promise = sendOperationalEvent(input).catch((error: unknown) => {
    console.warn("[observability] Failed to send operational event", {
      area: input.area,
      operation: input.operation,
      outcome: input.outcome,
      errorType: error instanceof Error ? error.name : "unknown",
    });
  });
  const edgeRuntime = (
    globalThis as typeof globalThis & { EdgeRuntime?: EdgeRuntimeLike }
  ).EdgeRuntime;

  if (edgeRuntime) {
    edgeRuntime.waitUntil(promise);
  }
}
