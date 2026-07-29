import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { buildOperationalProperties } from "../observability.ts";

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
    "1.2.0"
  );

  assertEquals(properties, {
    $process_person_profile: false,
    area: "generation",
    operation: "generate_single_workout",
    outcome: "fallback",
    severity: "info",
    journey_stage: "generation",
    app_version: "1.2.0",
    platform: "edge",
    duration_ms: 1_250,
    failure_code: null,
    fallback_reason: "response_validation_failed",
    generation_source: "fallback_template",
    count: null,
    fallback_count: null,
    test_incident_id: null,
  });
});

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
