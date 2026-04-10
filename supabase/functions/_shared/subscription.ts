import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface GenerationAllowance {
  allowed: boolean;
  used: number;
  remaining: number;
  tier: string;
}

/**
 * Checks whether the user may generate `requestedCount` more workouts.
 * Pro users with a valid subscription are always allowed (remaining = 999).
 * Free users are limited to 5 per rolling 7-day window.
 */
export async function checkGenerationAllowance(
  supabaseClient: SupabaseClient,
  userId: string,
  requestedCount = 1
): Promise<GenerationAllowance> {
  const { data, error } = await supabaseClient.rpc(
    "check_generation_allowance",
    {
      p_user_id: userId,
      p_requested_count: requestedCount,
    }
  );

  if (error || !data || data.length === 0) {
    console.error("[subscription] check_generation_allowance error:", error);
    // Fail open — don't block users if the check itself errors
    return { allowed: true, used: 0, remaining: 5, tier: "free" };
  }

  const row = data[0];
  return {
    allowed: row.allowed,
    used: row.used,
    remaining: row.remaining,
    tier: row.tier,
  };
}

/**
 * Records `count` generation events for the user.
 * Should be called after a successful generation.
 */
export async function recordGenerationUsage(
  supabaseClient: SupabaseClient,
  userId: string,
  trigger:
    | "onboarding"
    | "preference_change"
    | "regeneration"
    | "auto_completion",
  count = 1
): Promise<void> {
  const { error } = await supabaseClient.rpc("record_generation_usage", {
    p_user_id: userId,
    p_trigger: trigger,
    p_count: count,
  });

  if (error) {
    // Non-fatal — log but don't fail the generation response
    console.error("[subscription] record_generation_usage error:", error);
  }
}
