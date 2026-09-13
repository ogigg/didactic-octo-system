import {
  streakPromptStateSchema,
  type StreakStatus,
} from "@/lib/api/streak-protection";

const MOCK_PROMPT_ENV = "EXPO_PUBLIC_MOCK_STREAK_PROMPT_STATE";
const MOCK_FAIL_ENV = "EXPO_PUBLIC_MOCK_STREAK_PROMPT_FAIL";
const MOCK_LATENCY_MS = 900;

function isDevBuild(): boolean {
  return typeof __DEV__ === "undefined" || __DEV__;
}

/** Returns a local-only streak status for manually previewing the prompt UI. */
export function getMockStreakStatus(): StreakStatus | null {
  if (!isDevBuild()) return null;

  const result = streakPromptStateSchema.safeParse(
    process.env[MOCK_PROMPT_ENV]
  );
  if (!result.success) return null;

  const promptState = result.data;
  const isPro = promptState.startsWith("pro_");
  const hasEarnedFreeze = promptState === "free_earned_freeze";
  const hasLifetimeRescue = promptState === "free_lifetime_rescue";
  const hasProFreeze = promptState === "pro_available_freeze";
  const hasCoveredWeek =
    hasEarnedFreeze ||
    hasLifetimeRescue ||
    hasProFreeze ||
    promptState === "pro_auto_applied";

  return {
    tier: isPro ? "pro" : "free",
    is_pro_active: isPro,
    current_streak_weeks: promptState === "at_risk" ? 6 : 0,
    longest_streak_weeks: 8,
    last_workout_at: "2026-08-30T10:00:00Z",
    days_since_last_workout: 14,
    missed_week_count: 1,
    earned_freezes_available: hasEarnedFreeze ? 1 : 0,
    pro_freezes_available:
      hasProFreeze || promptState === "pro_auto_applied" ? 2 : 0,
    lifetime_rescue_available: hasLifetimeRescue,
    auto_apply_enabled: isPro,
    prompt_state: promptState,
    should_show_prompt: promptState !== "none",
    covered_week_start: hasCoveredWeek ? "2026-09-01" : null,
    covered_week_end: hasCoveredWeek ? "2026-09-07" : null,
  };
}

/**
 * Simulates a streak mutation while the mock is active. Adds a short delay so
 * the busy state is visible, and rejects when the fail flag is set so the
 * inline error and retry path can be exercised.
 */
export function runMockStreakMutation(): Promise<void> {
  const shouldFail = process.env[MOCK_FAIL_ENV] === "true";

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error("Mocked streak mutation failure"));
        return;
      }
      resolve();
    }, MOCK_LATENCY_MS);
  });
}
