import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { persistAndReportGeneration } from "../generation-delivery.ts";

const delivery = {
  userId: "internal-user-id",
  operation: "queue_generation_delivery",
  signalKey: "pending-row",
  durationMs: 42,
  generationSource: "llm" as const,
};

Deno.test("generation delivery reports persistence failure", async () => {
  const originalFetch = globalThis.fetch;
  const captures: unknown[] = [];
  Deno.env.set("POSTHOG_PROJECT_KEY", "test-key");
  Deno.env.set("OBSERVABILITY_IDENTITY_SECRET", "test-secret");
  globalThis.fetch = ((_url: string | URL | Request, init?: RequestInit) => {
    captures.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response(null, { status: 200 }));
  }) as typeof fetch;

  try {
    const delivered = await persistAndReportGeneration(delivery, () =>
      Promise.resolve({
        error: new Error("database detail must stay private"),
      })
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    assertEquals(delivered, false);
    assertEquals(captures.length, 1);
    const capture = captures[0] as {
      properties: Record<string, unknown>;
    };
    assertEquals(capture.properties.outcome, "failure");
    assertEquals(capture.properties.failure_code, "persistence_failed");
  } finally {
    globalThis.fetch = originalFetch;
    Deno.env.delete("POSTHOG_PROJECT_KEY");
    Deno.env.delete("OBSERVABILITY_IDENTITY_SECRET");
  }
});

Deno.test(
  "generation delivery does not mask a thrown persistence failure",
  async () => {
    await assertRejects(
      () =>
        persistAndReportGeneration(delivery, () => {
          throw new Error("connection failed");
        }),
      Error,
      "connection failed"
    );
  }
);
