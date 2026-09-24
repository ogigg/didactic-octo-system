import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";

const requestSchema = z.object({
  email: z.string().email(),
});

// Simple in-memory per-IP rate limit. The lookup only happens after a failed
// password sign-in, but it still reveals which provider an email is linked
// to, so keep it tight. Resets on function cold start — good enough to stop
// casual enumeration, not a hard security boundary.
const RATE_LIMIT_MAX_REQUESTS = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter(
    (ts) => now - ts < RATE_LIMIT_WINDOW_MS
  );
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  return false;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}***@${domain}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    console.warn("[login-provider-hint] Rate limited", { ip });
    return errorResponse("Too many requests", 429);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("A valid email is required", 400);
    }
    const email = parsed.data.email;
    console.log("[login-provider-hint] Lookup", maskEmail(email));

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabase = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await supabase.rpc("get_login_provider_hint", {
      p_email: email,
    });

    if (error) {
      console.error("[login-provider-hint] RPC failed:", error);
      return errorResponse("Internal server error", 500);
    }

    return jsonResponse(data);
  } catch (err) {
    console.error("[login-provider-hint] Unhandled error:", err);
    return errorResponse("Internal server error", 500);
  }
});
