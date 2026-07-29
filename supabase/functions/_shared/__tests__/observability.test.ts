import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildOperationalProperties,
  getObservabilityIdentity,
  validateObservabilityIdentityClaim,
} from "../observability.ts";

Deno.test("operational properties contain only allowlisted metadata", () => {
  const properties = buildOperationalProperties(
    {
      area: "generation",
      operation: "generate_single_workout",
      outcome: "fallback",
      journeyStage: "generation",
      userId: "must-not-be-in-properties",
      durationMs: 1_250,
      fallbackReason: "response_validation_failed",
      generationSource: "fallback_template",
    },
    "1.2.0",
    "sig_test"
  );

  assertEquals(properties, {
    $process_person_profile: false,
    $insert_id: "sig_test",
    area: "generation",
    operation: "generate_single_workout",
    outcome: "fallback",
    severity: "info",
    journey_stage: "generation",
    app_version: "1.2.0",
    platform: "edge",
    authoritative_source: "edge",
    correlation_id: "sig_test",
    duration_ms: 1_250,
    failure_code: null,
    fallback_reason: "response_validation_failed",
    generation_source: "fallback_template",
    count: null,
    fallback_count: null,
    test_incident_id: null,
  });
});

Deno.test(
  "opaque identity is stable and never contains the auth UUID",
  async () => {
    Deno.env.set("OBSERVABILITY_IDENTITY_SECRET", "unit-test-secret");
    try {
      const userId = "96df4bf6-0ff8-47f2-b51a-ae73a8fd7152";
      const identity = await getObservabilityIdentity(userId);

      assertEquals(identity.startsWith("obs_"), true);
      assertEquals(identity.includes(userId), false);
      assertEquals(
        await validateObservabilityIdentityClaim(
          new Request("https://example.test", {
            headers: { "x-observability-id": identity },
          }),
          userId
        ),
        true
      );
      assertEquals(
        await validateObservabilityIdentityClaim(
          new Request("https://example.test", {
            headers: { "x-observability-id": "obs_invalid" },
          }),
          userId
        ),
        false
      );
    } finally {
      Deno.env.delete("OBSERVABILITY_IDENTITY_SECRET");
    }
  }
);

Deno.test("failures are marked critical", () => {
  const properties = buildOperationalProperties(
    {
      area: "feedback",
      operation: "feedback_delivery",
      outcome: "failure",
      journeyStage: "profile",
      failureCode: "email_provider_failed",
    },
    "edge-test"
  );

  assertEquals(properties.severity, "critical");
});
