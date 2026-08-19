import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { getObservabilityIdentity } from "../_shared/observability.ts";

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("Missing authorization header", 401);
  }

  const client = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);

  if (error || !user) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    return jsonResponse({
      observability_id: await getObservabilityIdentity(user.id),
    });
  } catch {
    return errorResponse("Observability identity is not configured", 503);
  }
});
