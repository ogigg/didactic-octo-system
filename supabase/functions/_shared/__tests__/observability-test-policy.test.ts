import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { getObservabilityTestPolicy } from "../observability-test-policy.ts";

const fullyConfigured = {
  enabled: "true",
  serviceRoleKey: "service-role",
  posthogProjectKey: "project",
  posthogHost: "https://example.test",
  identitySecret: "identity",
};

Deno.test("controlled incidents are impossible in production", () => {
  assertEquals(
    getObservabilityTestPolicy({
      ...fullyConfigured,
      appEnvironment: "production",
    }),
    { available: false, configured: false }
  );
});

Deno.test(
  "controlled incidents require explicit enablement and all secrets",
  () => {
    assertEquals(
      getObservabilityTestPolicy({
        ...fullyConfigured,
        appEnvironment: "preview",
        enabled: "false",
      }).available,
      false
    );
    assertEquals(
      getObservabilityTestPolicy({
        ...fullyConfigured,
        appEnvironment: "staging",
        identitySecret: undefined,
      }),
      { available: true, configured: false }
    );
  }
);
