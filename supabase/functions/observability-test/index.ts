import { z } from "npm:zod@3";

import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { sendOperationalEvent } from "../_shared/observability.ts";
import { getObservabilityTestPolicy } from "../_shared/observability-test-policy.ts";

const requestSchema = z.object({
  state: z.enum(["triggered", "resolved"]),
  test_incident_id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const policy = getObservabilityTestPolicy({
    appEnvironment: Deno.env.get("APP_ENVIRONMENT"),
    enabled: Deno.env.get("ENABLE_OBSERVABILITY_TEST_INCIDENTS"),
    serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    posthogProjectKey: Deno.env.get("POSTHOG_PROJECT_KEY"),
    posthogHost: Deno.env.get("POSTHOG_HOST"),
    identitySecret: Deno.env.get("OBSERVABILITY_IDENTITY_SECRET"),
  });
  if (!policy.available) {
    return errorResponse("Not found", 404);
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!policy.configured || !serviceRoleKey) {
    return errorResponse("Observability test is not configured", 503);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader.replace("Bearer ", "") !== serviceRoleKey) {
    return errorResponse("Unauthorized", 401);
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return errorResponse("Invalid test incident request", 400);
  }

  try {
    const capture = await sendOperationalEvent({
      area: "generation",
      operation: "controlled_failure_test",
      outcome: parsed.data.state,
      journeyStage: "generation",
      failureCode:
        parsed.data.state === "triggered" ? "test_incident" : undefined,
      testIncidentId: parsed.data.test_incident_id,
      signalKey: `controlled:${parsed.data.test_incident_id}:${parsed.data.state}`,
    });
    if (!capture.delivered) {
      return errorResponse("Observability capture was not delivered", 502);
    }
  } catch {
    return errorResponse("Observability capture failed", 502);
  }

  return jsonResponse({
    success: true,
    state: parsed.data.state,
    test_incident_id: parsed.data.test_incident_id,
    capture_delivered: true,
  });
});
