// External cron entrypoint for purging expired account deletions. Point any
// scheduler (Supabase scheduled function, GitHub Action, cron-job.org, etc.)
// at this endpoint with the `CRON_SECRET` env var as a Bearer token.
//
// When pg_cron is available, this function is redundant — the migration
// schedules the same RPC to run directly in the database.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  const expectedSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || provided !== expectedSecret) {
    return errorResponse("Unauthorized", 401);
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data, error } = await admin.rpc("purge_expired_deletions");
    if (error) {
      console.error("[purge-expired-deletions] RPC error:", error);
      return errorResponse("Purge failed", 500);
    }

    console.log("[purge-expired-deletions] Purged", { count: data });
    return jsonResponse({ success: true, purged: data ?? 0 });
  } catch (err) {
    console.error("[purge-expired-deletions] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
