export const PROGRESSION_REASON_CODES = {
  STALE_HISTORY: "stale_history",
  FEEDBACK_TOO_HARD: "feedback_too_hard",
  HIGH_RPE: "high_rpe",
  FEEDBACK_TOO_EASY_HIGH_RPE_CONFLICT: "feedback_too_easy_high_rpe_conflict",
  FEEDBACK_TOO_EASY: "feedback_too_easy",
  REP_RANGE_INCREASE: "rep_range_increase",
  WEIGHT_INCREMENT: "weight_increment",
  TIME_INCREMENT: "time_increment",
} as const;

export type ProgressionReasonCode =
  (typeof PROGRESSION_REASON_CODES)[keyof typeof PROGRESSION_REASON_CODES];

const STANDARD_REASON_KEYS = {
  feedback_too_easy: "reasoning.progression.feedbackTooEasy",
  rep_range_increase: "reasoning.progression.repRangeIncrease",
  weight_increment: "reasoning.progression.weightIncrement",
  time_increment: "reasoning.progression.timeIncrement",
} as const;

const HOLD_REASON_KEYS = {
  stale_history: "reasoning.progression.staleHistoryHold",
  feedback_too_hard: "reasoning.progression.feedbackTooHardHold",
  high_rpe: "reasoning.progression.highRpeHold",
  feedback_too_easy_high_rpe_conflict:
    "reasoning.progression.feedbackConflictHold",
} as const;

const DELOAD_REASON_KEYS = {
  stale_history: "reasoning.progression.staleHistoryDeload",
  feedback_too_hard: "reasoning.progression.feedbackTooHardDeload",
  high_rpe: "reasoning.progression.highRpeDeload",
  feedback_too_easy_high_rpe_conflict:
    "reasoning.progression.feedbackConflictDeload",
} as const;

export function getProgressionReasonTranslationKey(
  reasonCode: ProgressionReasonCode | null | undefined,
  isDeload: boolean
) {
  if (!reasonCode) return null;

  if (reasonCode in STANDARD_REASON_KEYS) {
    return STANDARD_REASON_KEYS[
      reasonCode as keyof typeof STANDARD_REASON_KEYS
    ];
  }

  const reasonKeys = isDeload ? DELOAD_REASON_KEYS : HOLD_REASON_KEYS;
  return reasonKeys[reasonCode as keyof typeof reasonKeys] ?? null;
}
