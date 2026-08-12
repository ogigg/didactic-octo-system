import { capturePostHogEvent, normalizeGenerationFailure } from "../posthog.ts";

Deno.test(
  "uses the regional event ingestion endpoint and current payload shape",
  async () => {
    const originalFetch = globalThis.fetch;
    const originalToken = Deno.env.get("POSTHOG_PROJECT_TOKEN");
    const originalHost = Deno.env.get("POSTHOG_HOST");
    let capturedUrl = "";
    let capturedBody: Record<string, unknown> = {};

    try {
      Deno.env.set("POSTHOG_PROJECT_TOKEN", "phc_test");
      Deno.env.set("POSTHOG_HOST", "https://eu.i.posthog.com");
      globalThis.fetch = ((
        input: string | URL | Request,
        init?: RequestInit
      ) => {
        capturedUrl = String(input);
        capturedBody = JSON.parse(String(init?.body)) as Record<
          string,
          unknown
        >;
        return Promise.resolve(new Response(null, { status: 200 }));
      }) as typeof fetch;

      capturePostHogEvent("workout_generation_completed", "user-uuid", {
        request_id: "request-uuid",
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      if (capturedUrl !== "https://eu.i.posthog.com/i/v0/e/") {
        throw new Error(`Unexpected capture URL: ${capturedUrl}`);
      }
      if (
        capturedBody?.api_key !== "phc_test" ||
        capturedBody?.distinct_id !== "user-uuid"
      ) {
        throw new Error(
          "Capture payload must use the project token and distinct ID"
        );
      }
      const properties = capturedBody?.properties as
        | Record<string, unknown>
        | undefined;
      if (
        properties?.request_id !== "request-uuid" ||
        properties?.distinct_id !== undefined
      ) {
        throw new Error("Event properties do not match the ingestion contract");
      }
    } finally {
      globalThis.fetch = originalFetch;
      if (originalToken === undefined) Deno.env.delete("POSTHOG_PROJECT_TOKEN");
      else Deno.env.set("POSTHOG_PROJECT_TOKEN", originalToken);
      if (originalHost === undefined) Deno.env.delete("POSTHOG_HOST");
      else Deno.env.set("POSTHOG_HOST", originalHost);
    }
  }
);

Deno.test("normalizes model failures without retaining provider text", () => {
  const failure = normalizeGenerationFailure(
    "generation",
    "provider returned an untrusted prompt"
  );

  if (failure.error_code !== "generation_failed") {
    throw new Error(`Unexpected error code: ${failure.error_code}`);
  }
  if (!failure.retryable || failure.failure_stage !== "generation") {
    throw new Error("Generation failures should be retryable and categorized");
  }
});

Deno.test("normalizes allowance and persistence outcomes", () => {
  const rateLimited = normalizeGenerationFailure(
    "allowance",
    "generation_limit_reached"
  );
  const persistence = normalizeGenerationFailure(
    "persistence",
    new Error("database provider details")
  );

  if (rateLimited.error_code !== "rate_limited" || rateLimited.retryable) {
    throw new Error("Allowance failures should be non-retryable rate limits");
  }
  if (persistence.error_code !== "persistence" || !persistence.retryable) {
    throw new Error("Persistence failures should be retryable");
  }
});
