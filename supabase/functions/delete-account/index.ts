import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { revokeAppleToken } from "./apple-revoke.ts";

const GRACE_DAYS = 14;

const requestSchema = z.object({
  confirmation: z.literal("DELETE"),
  // Optional — the client passes session.provider_refresh_token when the user
  // is signed in via Apple so we can revoke it per App Store 5.1.1(v).
  apple_refresh_token: z.string().min(1).optional(),
});

Deno.serve(async (req: Request) => {
  console.log("[delete-account] Request received", {
    method: req.method,
    url: req.url,
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await admin.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "Confirmation phrase required to delete account",
        400
      );
    }

    // Best-effort Apple revocation — must not block deletion on failure. Only
    // attempt if the user actually has an Apple identity linked.
    const hasAppleIdentity = (user.identities ?? []).some(
      (identity) => identity.provider === "apple"
    );

    let appleRevoke: Awaited<ReturnType<typeof revokeAppleToken>> | null = null;
    if (hasAppleIdentity) {
      appleRevoke = await revokeAppleToken(parsed.data.apple_refresh_token);
      console.log("[delete-account] Apple revoke result:", appleRevoke);
    }

    // Call the SECURITY DEFINER RPC as the end user (using their JWT) so that
    // auth.uid() resolves correctly and the timestamp stamps the right row.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: scheduledAt, error: rpcError } = await userClient.rpc(
      "request_account_deletion",
      { grace_days: GRACE_DAYS }
    );

    if (rpcError || !scheduledAt) {
      console.error(
        "[delete-account] request_account_deletion failed:",
        rpcError
      );
      return errorResponse("Failed to schedule account deletion", 500);
    }

    // Sign the user out of every active session so their app drops to auth.
    // Service-role `signOut` with `global` scope invalidates every refresh
    // token for this user.
    const { error: signOutError } = await admin.auth.admin.signOut(
      token,
      "global"
    );
    if (signOutError) {
      console.warn(
        "[delete-account] signOut warning (deletion still scheduled):",
        signOutError
      );
    }

    console.log("[delete-account] Deletion scheduled", {
      userId: user.id,
      scheduledAt,
      hasAppleIdentity,
      appleRevoked: appleRevoke?.ok ?? null,
    });

    return jsonResponse({
      success: true,
      scheduled_at: scheduledAt,
      grace_days: GRACE_DAYS,
      apple_revoked: appleRevoke?.ok ?? null,
    });
  } catch (err) {
    console.error("[delete-account] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
