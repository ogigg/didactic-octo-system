import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (req: Request) => {
  console.log("[cancel-account-deletion] Request received", {
    method: req.method,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Missing authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await userClient.rpc("cancel_account_deletion");

    if (error) {
      console.error("[cancel-account-deletion] RPC error:", error);
      return errorResponse("Failed to cancel account deletion", 500);
    }

    return jsonResponse({ success: true, cancelled: Boolean(data) });
  } catch (err) {
    console.error("[cancel-account-deletion] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
