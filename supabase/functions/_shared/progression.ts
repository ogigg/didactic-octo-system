// ---------------------------------------------------------------------------
// Progressive Overload Engine
// ---------------------------------------------------------------------------
// Pure, deterministic progression logic. Applied after LLM workout generation
// to override weights/reps for exercises the user has done before.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkingSetRecord {
  load_kg: number | null;
  reps: number | null;
  duration_seconds?: number | null;
  rpe?: number | null;
  completed: boolean;
}

export interface ExerciseHistory {
  exercise_id: string;
  exercise_type: "weight" | "time";
  session_id?: string;
  session_completed_at: string;
  difficulty_feedback: "too_easy" | "ok" | "too_hard" | null;
  working_sets: WorkingSetRecord[] | null;
}

export type ProgressionType =
  | "weight_up"
  | "reps_up"
  | "maintained"
  | "new_exercise";

/** Machine-readable explanation for every non-null progression decision. */
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

export interface ProgressionEvidence {
  max_rpe: number | null;
  difficulty_feedback: "too_easy" | "ok" | "too_hard" | null;
}

export interface ProgressionSetTarget {
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
}

export interface ProgressionResult {
  exercise_id: string;
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
  set_targets: ProgressionSetTarget[];
  progression_type: ProgressionType;
  previous_display: string | null;
  reason_code: ProgressionReasonCode;
  evidence: ProgressionEvidence;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REP_RANGES: Record<string, { min: number; max: number }> = {
  strength: { min: 3, max: 6 },
  hypertrophy: { min: 8, max: 12 },
  endurance: { min: 12, max: 20 },
  circuit: { min: 8, max: 15 },
};

const DEFAULT_REP_RANGE = REP_RANGES.hypertrophy;

/** Max days since last session before we hold instead of progressing. */
const STALE_THRESHOLD_DAYS = 14;

/** Completed working-set RPE at or above this holds the target. */
const HIGH_RPE_THRESHOLD = 9;

// Default duration increments for time exercises (seconds)
const TIME_INCREMENT_TOO_EASY = 15;
const TIME_INCREMENT_OK = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWeightIncrement(equipment: string[]): number {
  const lowered = equipment.map((e) => e.toLowerCase());
  if (lowered.some((e) => e.includes("barbell"))) return 2.5;
  if (lowered.some((e) => e.includes("dumbbell"))) return 2;
  if (lowered.some((e) => e === "bodyweight")) return 0;
  // cable, machine, other
  return 1.25;
}

function isBodyweight(equipment: string[]): boolean {
  return equipment.length === 1 && equipment[0].toLowerCase() === "bodyweight";
}

function daysBetween(dateStr: string, now: Date): number {
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function formatPreviousDisplay(loadKg: number, reps: number): string {
  return `${loadKg}×${reps}`;
}

export function formatExerciseDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Max RPE across completed working sets; null when no RPE was logged. */
export function getMaxCompletedRpe(
  workingSets: WorkingSetRecord[]
): number | null {
  let maxRpe: number | null = null;
  for (const set of workingSets) {
    if (!set.completed || set.rpe == null) continue;
    if (maxRpe == null || set.rpe > maxRpe) {
      maxRpe = set.rpe;
    }
  }
  return maxRpe;
}

/**
 * Maps an ordered historical prescription onto a generated working-set
 * position. Endpoints are retained when set counts differ so ramp-up and
 * back-off shapes are not flattened.
 */
export function getProgressionSetTarget(
  setTargets: ProgressionSetTarget[],
  generatedSetIndex: number,
  generatedSetCount: number
): ProgressionSetTarget | null {
  if (
    setTargets.length === 0 ||
    generatedSetCount <= 0 ||
    generatedSetIndex < 0 ||
    generatedSetIndex >= generatedSetCount
  ) {
    return null;
  }

  if (generatedSetCount === 1) {
    return setTargets.reduce((best, target) => {
      const bestEffort =
        best.target_load_kg ?? best.target_duration_seconds ?? 0;
      const targetEffort =
        target.target_load_kg ?? target.target_duration_seconds ?? 0;
      return targetEffort > bestEffort ? target : best;
    });
  }

  const sourceIndex = Math.round(
    (generatedSetIndex * (setTargets.length - 1)) / (generatedSetCount - 1)
  );
  return setTargets[sourceIndex] ?? null;
}

/**
 * Keeps generated reductions when a progression hold has an explicit safety
 * reason, while preventing the generator from exceeding the historical
 * per-set ceiling. Normal progression always uses the deterministic target.
 */
export function validateProgressionSetTarget(
  generatedTarget: ProgressionSetTarget,
  progressionTarget: ProgressionSetTarget | null,
  reasonCode: ProgressionReasonCode
): ProgressionSetTarget | null {
  if (!progressionTarget) return null;

  const permitsReduction =
    reasonCode === PROGRESSION_REASON_CODES.STALE_HISTORY ||
    reasonCode === PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD ||
    reasonCode === PROGRESSION_REASON_CODES.HIGH_RPE ||
    reasonCode === PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY_HIGH_RPE_CONFLICT;

  if (!permitsReduction) return progressionTarget;

  if (progressionTarget.target_duration_seconds != null) {
    return {
      target_duration_seconds: Math.min(
        generatedTarget.target_duration_seconds ??
          progressionTarget.target_duration_seconds,
        progressionTarget.target_duration_seconds
      ),
    };
  }

  return {
    target_load_kg: Math.min(
      generatedTarget.target_load_kg ?? progressionTarget.target_load_kg ?? 0,
      progressionTarget.target_load_kg ?? 0
    ),
    target_reps: Math.min(
      generatedTarget.target_reps ?? progressionTarget.target_reps ?? 1,
      progressionTarget.target_reps ?? 1
    ),
  };
}

function buildEvidence(
  history: ExerciseHistory,
  maxRpe: number | null
): ProgressionEvidence {
  return {
    max_rpe: maxRpe,
    difficulty_feedback: history.difficulty_feedback,
  };
}

/**
 * Conservative hold precedence (first match wins):
 * 1. stale history
 * 2. too_hard feedback
 * 3. any completed working-set RPE >= 9 (including too_easy conflict)
 */
function resolveHoldReason(
  history: ExerciseHistory,
  maxRpe: number | null,
  now: Date
): ProgressionReasonCode | null {
  if (
    history.session_completed_at &&
    daysBetween(history.session_completed_at, now) > STALE_THRESHOLD_DAYS
  ) {
    return PROGRESSION_REASON_CODES.STALE_HISTORY;
  }

  if (history.difficulty_feedback === "too_hard") {
    return PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD;
  }

  if (maxRpe != null && maxRpe >= HIGH_RPE_THRESHOLD) {
    if (history.difficulty_feedback === "too_easy") {
      return PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY_HIGH_RPE_CONFLICT;
    }
    return PROGRESSION_REASON_CODES.HIGH_RPE;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Time Exercise Progression
// ---------------------------------------------------------------------------

export function calculateTimeProgression(
  history: ExerciseHistory,
  now: Date = new Date()
): ProgressionResult | null {
  if (!history.working_sets?.length) return null;

  const completedSets = history.working_sets.filter(
    (s): s is WorkingSetRecord & { duration_seconds: number } =>
      s.completed && s.duration_seconds != null && s.duration_seconds > 0
  );

  if (completedSets.length === 0) return null;

  const bestDuration = Math.max(
    ...completedSets.map((s) => s.duration_seconds)
  );
  const previousDisplay = formatExerciseDuration(bestDuration);
  const maxRpe = getMaxCompletedRpe(history.working_sets);
  const evidence = buildEvidence(history, maxRpe);

  const holdReason = resolveHoldReason(history, maxRpe, now);
  if (holdReason) {
    return {
      exercise_id: history.exercise_id,
      target_duration_seconds: bestDuration,
      set_targets: completedSets.map((set) => ({
        target_duration_seconds: set.duration_seconds,
      })),
      progression_type: "maintained",
      previous_display: previousDisplay,
      reason_code: holdReason,
      evidence,
    };
  }

  if (history.difficulty_feedback === "too_easy") {
    return {
      exercise_id: history.exercise_id,
      target_duration_seconds: bestDuration + TIME_INCREMENT_TOO_EASY,
      set_targets: completedSets.map((set) => ({
        target_duration_seconds: set.duration_seconds + TIME_INCREMENT_TOO_EASY,
      })),
      progression_type: "reps_up",
      previous_display: previousDisplay,
      reason_code: PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY,
      evidence,
    };
  }

  // feedback = "ok" or null: bump by smaller increment
  return {
    exercise_id: history.exercise_id,
    target_duration_seconds: bestDuration + TIME_INCREMENT_OK,
    set_targets: completedSets.map((set) => ({
      target_duration_seconds: set.duration_seconds + TIME_INCREMENT_OK,
    })),
    progression_type: "reps_up",
    previous_display: previousDisplay,
    reason_code: PROGRESSION_REASON_CODES.TIME_INCREMENT,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Core Algorithm (weight exercises)
// ---------------------------------------------------------------------------

export function calculateProgression(
  history: ExerciseHistory | null,
  equipment: string[],
  trainingStyle: string,
  now: Date = new Date()
): ProgressionResult | null {
  if (!history || !history.working_sets?.length) {
    return null; // new exercise — keep LLM suggestion
  }

  // Dispatch to time progression for time exercises
  if (history.exercise_type === "time") {
    return calculateTimeProgression(history, now);
  }

  const exerciseId = history.exercise_id;
  const range = REP_RANGES[trainingStyle] ?? DEFAULT_REP_RANGE;

  // Filter to completed working sets with valid data
  const completedSets = history.working_sets.filter(
    (s): s is WorkingSetRecord & { load_kg: number; reps: number } =>
      s.completed && s.load_kg != null && s.reps != null
  );

  if (completedSets.length === 0) {
    return null; // no completed sets — keep LLM suggestion
  }

  // Previous display: best set (highest load, then highest reps)
  const bestSet = completedSets.reduce((best, s) =>
    s.load_kg > best.load_kg ||
    (s.load_kg === best.load_kg && s.reps > best.reps)
      ? s
      : best
  );
  const previousDisplay = formatPreviousDisplay(bestSet.load_kg, bestSet.reps);
  const maxRpe = getMaxCompletedRpe(history.working_sets);
  const evidence = buildEvidence(history, maxRpe);

  // Baseline: use the load from the majority of sets (most common load_kg).
  // When every load is unique in a ramp, anchor the decision to the top set
  // instead of treating the lightest set as demonstrated working capacity.
  const loadCounts = new Map<number, number>();
  for (const s of completedSets) {
    loadCounts.set(s.load_kg, (loadCounts.get(s.load_kg) ?? 0) + 1);
  }
  const primaryLoad = [...loadCounts.entries()].reduce((a, b) =>
    b[1] > a[1] || (b[1] === a[1] && b[0] > a[0]) ? b : a
  )[0];

  // Worst set at primary load (conservative)
  const setsAtPrimaryLoad = completedSets.filter(
    (s) => s.load_kg === primaryLoad
  );
  const worstReps = Math.min(...setsAtPrimaryLoad.map((s) => s.reps));

  const holdReason = resolveHoldReason(history, maxRpe, now);
  if (holdReason) {
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad,
      target_reps: worstReps,
      set_targets: completedSets.map((set) => ({
        target_load_kg: set.load_kg,
        target_reps: set.reps,
      })),
      progression_type: "maintained",
      previous_display: previousDisplay,
      reason_code: holdReason,
      evidence,
    };
  }

  if (history.difficulty_feedback === "too_easy") {
    const increment = getWeightIncrement(equipment);
    if (isBodyweight(equipment) || increment === 0) {
      return {
        exercise_id: exerciseId,
        target_load_kg: primaryLoad,
        target_reps: worstReps + 2,
        set_targets: completedSets.map((set) => ({
          target_load_kg: set.load_kg,
          target_reps: set.reps + 2,
        })),
        progression_type: "reps_up",
        previous_display: previousDisplay,
        reason_code: PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY,
        evidence,
      };
    }
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad + increment,
      target_reps: range.min,
      set_targets: completedSets.map((set) => ({
        target_load_kg: set.load_kg + increment,
        target_reps: range.min,
      })),
      progression_type: "weight_up",
      previous_display: previousDisplay,
      reason_code: PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY,
      evidence,
    };
  }

  // Normal progression (feedback = "ok" or null)
  if (worstReps >= range.max) {
    // Top of rep range — bump weight, reset reps
    const increment = getWeightIncrement(equipment);
    if (isBodyweight(equipment) || increment === 0) {
      // Bodyweight: just keep adding reps
      return {
        exercise_id: exerciseId,
        target_load_kg: primaryLoad,
        target_reps: worstReps + 2,
        set_targets: completedSets.map((set) => ({
          target_load_kg: set.load_kg,
          target_reps: set.reps + 2,
        })),
        progression_type: "reps_up",
        previous_display: previousDisplay,
        reason_code: PROGRESSION_REASON_CODES.REP_RANGE_INCREASE,
        evidence,
      };
    }
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad + increment,
      target_reps: range.min,
      set_targets: completedSets.map((set) => ({
        target_load_kg: set.load_kg + increment,
        target_reps: range.min,
      })),
      progression_type: "weight_up",
      previous_display: previousDisplay,
      reason_code: PROGRESSION_REASON_CODES.WEIGHT_INCREMENT,
      evidence,
    };
  }

  // Below top of range — increase reps
  return {
    exercise_id: exerciseId,
    target_load_kg: primaryLoad,
    target_reps: Math.min(worstReps + 2, range.max),
    set_targets: completedSets.map((set) => ({
      target_load_kg: set.load_kg,
      target_reps: Math.min(set.reps + 2, range.max),
    })),
    progression_type: "reps_up",
    previous_display: previousDisplay,
    reason_code: PROGRESSION_REASON_CODES.REP_RANGE_INCREASE,
    evidence,
  };
}
