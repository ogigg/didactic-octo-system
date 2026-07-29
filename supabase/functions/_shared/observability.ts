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
  /**
   * A server-only stable key used to correlate and deduplicate retries. The
   * value itself is never sent to PostHog.
   */
  signalKey?: string;
}

interface EdgeRuntimeLike {
  waitUntil(promise: Promise<unknown>): void;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function opaqueDigest(purpose: string, value: string): Promise<string> {
  const secret = Deno.env.get("OBSERVABILITY_IDENTITY_SECRET");
  if (!secret) {
    throw new Error("OBSERVABILITY_IDENTITY_SECRET is not configured");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${purpose}:${value}`)
  );
  return bytesToHex(digest);
}

export async function getObservabilityIdentity(
  userId: string
): Promise<string> {
  return `obs_${await opaqueDigest("identity-v1", userId)}`;
}

export async function validateObservabilityIdentityClaim(
  request: Request,
  userId: string
): Promise<boolean> {
  const claim = request.headers.get("x-observability-id");
  if (!claim) {
    // Older app versions do not send the header. The backend still derives the
    // authoritative identity from the validated auth user.
    return true;
  }

  return claim === (await getObservabilityIdentity(userId));
}

export function buildOperationalProperties(
  input: OperationalEvent,
  appVersion: string,
  correlationId?: string
): Record<string, string | number | boolean | null> {
  return {
    $process_person_profile: false,
    $insert_id: correlationId ?? null,
    area: input.area,
    operation: input.operation,
    outcome: input.outcome,
    severity: input.outcome === "failure" ? "critical" : "info",
    journey_stage: input.journeyStage,
    app_version: appVersion,
    platform: "edge",
    authoritative_source: "edge",
    correlation_id: correlationId ?? null,
    duration_ms: input.durationMs ?? null,
    failure_code: input.failureCode ?? null,
    fallback_reason: input.fallbackReason ?? null,
    generation_source: input.generationSource ?? null,
    count: input.count ?? null,
    fallback_count: input.fallbackCount ?? null,
    test_incident_id: input.testIncidentId ?? null,
  };
}

export interface OperationalCaptureResult {
  delivered: boolean;
  status: number | null;
}

export async function sendOperationalEvent(
  input: OperationalEvent
): Promise<OperationalCaptureResult> {
  const projectKey = Deno.env.get("POSTHOG_PROJECT_KEY");
  if (!projectKey) {
    console.warn(
      "[observability] POSTHOG_PROJECT_KEY is not configured; event dropped",
      { area: input.area, operation: input.operation, outcome: input.outcome }
    );
    return { delivered: false, status: null };
  }

  const host = (
    Deno.env.get("POSTHOG_HOST") ?? "https://us.i.posthog.com"
  ).replace(/\/$/, "");
  const distinctId = input.userId
    ? await getObservabilityIdentity(input.userId)
    : "edge-system";
  const correlationId = input.signalKey
    ? `sig_${await opaqueDigest("signal-v1", input.signalKey)}`
    : `sig_${crypto.randomUUID()}`;

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
          "unknown",
        correlationId
      ),
      timestamp: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`PostHog capture failed with status ${response.status}`);
  }

  return { delivered: true, status: response.status };
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
