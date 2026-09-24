import type {
  StreakPromptState,
  StreakProtectionType,
  StreakStatus,
} from "@/lib/api/streak-protection";

/**
 * Which surface (if any) the Home screen should use for the current streak
 * prompt. Decisions that spend a resource or restart the streak get a bottom
 * sheet; informational states get a calm inline card that never covers the
 * workout queue.
 */
export type StreakPromptPresentation = "sheet" | "card" | null;

interface StreakPromptContext {
  isWorkoutActive: boolean;
  isPaywallOpen: boolean;
  hiddenPromptState: StreakPromptState | null;
}

const CARD_STATES: ReadonlySet<StreakPromptState> = new Set([
  "at_risk",
  "pro_auto_applied",
]);

const SHEET_STATES: ReadonlySet<StreakPromptState> = new Set([
  "free_earned_freeze",
  "free_lifetime_rescue",
  "free_comeback",
  "pro_available_freeze",
  "pro_comeback",
]);

export function getStreakPromptPresentation(
  status: StreakStatus | undefined,
  context: StreakPromptContext
): StreakPromptPresentation {
  if (!status || !status.should_show_prompt) return null;
  if (status.prompt_state === "none") return null;
  if (context.hiddenPromptState === status.prompt_state) return null;

  // Streak prompts must never compete with an in-progress workout or another
  // overlay. The backend cooldown keeps the prompt available for later.
  if (context.isWorkoutActive || context.isPaywallOpen) return null;

  if (CARD_STATES.has(status.prompt_state)) return "card";
  if (SHEET_STATES.has(status.prompt_state)) return "sheet";

  return null;
}

export function getAvailableProtection(
  status: StreakStatus
): StreakProtectionType | null {
  switch (status.prompt_state) {
    case "free_earned_freeze":
      return status.earned_freezes_available > 0 ? "earned_freeze" : null;
    case "free_lifetime_rescue":
      return status.lifetime_rescue_available ? "lifetime_rescue" : null;
    case "pro_available_freeze":
      return status.pro_freezes_available > 0 ? "pro_freeze" : null;
    default:
      return null;
  }
}

/** Free users without a protection left may learn about Pro, quietly. */
export function shouldOfferProHint(status: StreakStatus): boolean {
  return (
    !status.is_pro_active &&
    (status.prompt_state === "free_lifetime_rescue" ||
      status.prompt_state === "free_comeback")
  );
}

/** Restarting only makes sense once no protection can cover the missed week. */
export function canRestartStreak(status: StreakStatus): boolean {
  return (
    status.prompt_state === "free_comeback" ||
    status.prompt_state === "pro_comeback"
  );
}

export function formatCoveredWeekRange(
  status: Pick<StreakStatus, "covered_week_start" | "covered_week_end">,
  locale: string
): string | null {
  if (!status.covered_week_start || !status.covered_week_end) return null;

  const start = new Date(`${status.covered_week_start}T00:00:00`);
  const end = new Date(`${status.covered_week_end}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}
