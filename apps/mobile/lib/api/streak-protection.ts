import { z } from "zod";

import { supabase } from "@/lib/supabase";

export const streakPromptStateSchema = z.enum([
  "none",
  "at_risk",
  "free_earned_freeze",
  "free_lifetime_rescue",
  "free_comeback",
  "pro_auto_applied",
  "pro_available_freeze",
  "pro_comeback",
]);

export type StreakPromptState = z.infer<typeof streakPromptStateSchema>;

export const streakProtectionTypeSchema = z.enum([
  "lifetime_rescue",
  "earned_freeze",
  "pro_freeze",
]);

export type StreakProtectionType = z.infer<typeof streakProtectionTypeSchema>;

const streakStatusSchema = z.object({
  tier: z.string(),
  is_pro_active: z.boolean(),
  current_streak_weeks: z.number().int().nonnegative(),
  longest_streak_weeks: z.number().int().nonnegative(),
  last_workout_at: z.string().nullable(),
  days_since_last_workout: z.number().int().nonnegative().nullable(),
  missed_week_count: z.number().int().nonnegative(),
  earned_freezes_available: z.number().int().nonnegative(),
  pro_freezes_available: z.number().int().nonnegative(),
  lifetime_rescue_available: z.boolean(),
  auto_apply_enabled: z.boolean(),
  prompt_state: streakPromptStateSchema,
  should_show_prompt: z.boolean(),
  covered_week_start: z.string().nullable(),
  covered_week_end: z.string().nullable(),
});

export type StreakStatus = z.infer<typeof streakStatusSchema>;

export type ComebackEventType = "comeback_started" | "comeback_completed";

type ComebackMetadata = Record<string, string | number | boolean | null>;

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Not authenticated");
  }

  return user.id;
}

export async function fetchStreakStatus(): Promise<StreakStatus> {
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_streak_status", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const rows = z.array(streakStatusSchema).parse(data ?? []);
  const status = rows[0];

  if (!status) {
    throw new Error("Streak status not found");
  }

  return status;
}

export async function applyStreakProtection(
  protectionType: StreakProtectionType
): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase.rpc("apply_streak_protection", {
    p_user_id: userId,
    p_protection_type: protectionType,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function dismissStreakPrompt(
  promptState: StreakPromptState
): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase.rpc("dismiss_streak_prompt", {
    p_user_id: userId,
    p_prompt_state: promptState,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function restartStreak(): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase.rpc("restart_streak", {
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordComebackEvent(
  eventType: ComebackEventType,
  metadata: ComebackMetadata = {}
): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase.rpc("record_comeback_event", {
    p_user_id: userId,
    p_event_type: eventType,
    p_metadata: metadata,
  });

  if (error) {
    throw new Error(error.message);
  }
}
