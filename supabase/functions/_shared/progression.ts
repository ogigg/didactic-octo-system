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
  completed: boolean;
}

export interface ExerciseHistory {
  exercise_id: string;
  exercise_type: "weight" | "time";
  session_completed_at: string;
  difficulty_feedback: "too_easy" | "ok" | "too_hard" | null;
  working_sets: WorkingSetRecord[] | null;
}

export type ProgressionType =
  | "weight_up"
  | "reps_up"
  | "maintained"
  | "new_exercise";

export interface ProgressionResult {
  exercise_id: string;
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
  progression_type: ProgressionType;
  previous_display: string | null;
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

  // Check staleness
  if (
    history.session_completed_at &&
    daysBetween(history.session_completed_at, now) > STALE_THRESHOLD_DAYS
  ) {
    return {
      exercise_id: history.exercise_id,
      target_duration_seconds: bestDuration,
      progression_type: "maintained",
      previous_display: previousDisplay,
    };
  }

  if (history.difficulty_feedback === "too_hard") {
    return {
      exercise_id: history.exercise_id,
      target_duration_seconds: bestDuration,
      progression_type: "maintained",
      previous_display: previousDisplay,
    };
  }

  if (history.difficulty_feedback === "too_easy") {
    return {
      exercise_id: history.exercise_id,
      target_duration_seconds: bestDuration + TIME_INCREMENT_TOO_EASY,
      progression_type: "reps_up",
      previous_display: previousDisplay,
    };
  }

  // feedback = "ok" or null: bump by smaller increment
  return {
    exercise_id: history.exercise_id,
    target_duration_seconds: bestDuration + TIME_INCREMENT_OK,
    progression_type: "reps_up",
    previous_display: previousDisplay,
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

  // Baseline: use the load from the majority of sets (most common load_kg)
  const loadCounts = new Map<number, number>();
  for (const s of completedSets) {
    loadCounts.set(s.load_kg, (loadCounts.get(s.load_kg) ?? 0) + 1);
  }
  const primaryLoad = [...loadCounts.entries()].reduce((a, b) =>
    b[1] > a[1] ? b : a
  )[0];

  // Worst set at primary load (conservative)
  const setsAtPrimaryLoad = completedSets.filter(
    (s) => s.load_kg === primaryLoad
  );
  const worstReps = Math.min(...setsAtPrimaryLoad.map((s) => s.reps));

  // Check staleness
  if (
    history.session_completed_at &&
    daysBetween(history.session_completed_at, now) > STALE_THRESHOLD_DAYS
  ) {
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad,
      target_reps: worstReps,
      progression_type: "maintained",
      previous_display: previousDisplay,
    };
  }

  // Feedback-driven decisions
  if (history.difficulty_feedback === "too_hard") {
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad,
      target_reps: worstReps,
      progression_type: "maintained",
      previous_display: previousDisplay,
    };
  }

  if (history.difficulty_feedback === "too_easy") {
    const increment = getWeightIncrement(equipment);
    if (isBodyweight(equipment) || increment === 0) {
      return {
        exercise_id: exerciseId,
        target_load_kg: primaryLoad,
        target_reps: worstReps + 2,
        progression_type: "reps_up",
        previous_display: previousDisplay,
      };
    }
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad + increment,
      target_reps: range.min,
      progression_type: "weight_up",
      previous_display: previousDisplay,
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
        progression_type: "reps_up",
        previous_display: previousDisplay,
      };
    }
    return {
      exercise_id: exerciseId,
      target_load_kg: primaryLoad + increment,
      target_reps: range.min,
      progression_type: "weight_up",
      previous_display: previousDisplay,
    };
  }

  // Below top of range — increase reps
  return {
    exercise_id: exerciseId,
    target_load_kg: primaryLoad,
    target_reps: Math.min(worstReps + 2, range.max),
    progression_type: "reps_up",
    previous_display: previousDisplay,
  };
}
