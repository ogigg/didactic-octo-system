import { supabase } from "@/lib/supabase";

export interface GenerationAllowance {
  allowed: boolean;
  used: number;
  remaining: number;
  tier: string;
}

export interface GenerationLimitError {
  code: "generation_limit_reached";
  used: number;
  remaining: number;
  tier: string;
}

export function isGenerationLimitError(
  error: unknown
): error is GenerationLimitError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as GenerationLimitError).code === "generation_limit_reached"
  );
}

export async function fetchWeeklyUsage(): Promise<GenerationAllowance> {
  const { data, error } = await supabase.rpc("check_generation_allowance", {
    p_user_id: (await supabase.auth.getUser()).data.user?.id ?? "",
    p_requested_count: 0,
  });

  if (error || !data || data.length === 0) {
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
