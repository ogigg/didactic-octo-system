import { z } from "npm:zod@3";

import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { reportOperationalEvent } from "../_shared/observability.ts";

const requestSchema = z.object({
  state: z.enum(["triggered", "resolved"]),
  test_incident_id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader.replace("Bearer ", "") !== serviceRoleKey) {
    return errorResponse("Unauthorized", 401);
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return errorResponse("Invalid test incident request", 400);
  }

  reportOperationalEvent({
    area: "generation",
    operation: "controlled_failure_test",
    outcome: parsed.data.state,
    journeyStage: "generation",
    failureCode:
      parsed.data.state === "triggered" ? "test_incident" : undefined,
    testIncidentId: parsed.data.test_incident_id,
  });

  return jsonResponse({
    success: true,
    state: parsed.data.state,
    test_incident_id: parsed.data.test_incident_id,
  });
});
