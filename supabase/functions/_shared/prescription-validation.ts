export const PRESCRIPTION_ISSUE_CODES = {
  INVALID_LOAD: "invalid_load",
  INVALID_REPS: "invalid_reps",
  INVALID_DURATION: "invalid_duration",
  UNEXPECTED_WEIGHT_FIELDS: "unexpected_weight_fields",
  UNEXPECTED_DURATION_FIELD: "unexpected_duration_field",
} as const;

export interface PrescriptionSet {
  set_type: "warmup" | "working";
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
}

export interface PrescriptionExercise {
  exercise_id: string;
  exercise_type: "weight" | "time";
  equipment: string[];
  sets: PrescriptionSet[];
}

export interface PrescriptionRepairContext {
  trainingStyle: string;
  difficulty: string;
}

export interface PrescriptionIssue {
  code: (typeof PRESCRIPTION_ISSUE_CODES)[keyof typeof PRESCRIPTION_ISSUE_CODES];
  exerciseId: string;
  setIndex: number;
  field:
    | "target_load_kg"
    | "target_reps"
    | "target_duration_seconds"
    | "weight_fields";
  received: number | null;
  repairedTo: number | null;
}

const LOADLESS_EQUIPMENT = new Set([
  "ab wheel",
  "back extension bench",
  "body weight",
  "bodyweight",
  "dip bars",
  "mat",
  "pull-up bar",
]);

const DEFAULT_REPS: Record<string, number> = {
  strength: 5,
  hypertrophy: 10,
  endurance: 15,
  circuit: 12,
};

const DEFAULT_DURATIONS: Record<string, number> = {
  strength: 30,
  hypertrophy: 40,
  endurance: 45,
  circuit: 30,
};

export function isLoadlessExercise(equipment: string[]): boolean {
  return equipment.some((item) =>
    LOADLESS_EQUIPMENT.has(item.trim().toLowerCase())
  );
}

export function getSafeStartingLoadKg(equipment: string[]): number {
  const normalized = equipment.map((item) => item.trim().toLowerCase());

  if (isLoadlessExercise(equipment)) return 0;
  if (normalized.some((item) => item.includes("medicine ball"))) return 3;
  if (normalized.some((item) => item.includes("dumbbell"))) return 5;
  if (normalized.some((item) => item.includes("kettlebell"))) return 8;
  if (normalized.some((item) => item.includes("ez-bar"))) return 10;
  if (normalized.some((item) => item.includes("barbell"))) return 20;

  return 5;
}

function minimumReps(
  setType: PrescriptionSet["set_type"],
  context: PrescriptionRepairContext
): number {
  if (setType === "warmup") return 5;
  if (
    context.trainingStyle === "strength" &&
    context.difficulty !== "beginner"
  ) {
    return 3;
  }
  return 5;
}

/**
 * Repairs generated prescriptions in place and returns structured issues for
 * server-side quality logging. Every generated workout passes through this
 * function before it is returned or persisted.
 */
export function repairWorkoutPrescriptions(
  exercises: PrescriptionExercise[],
  context: PrescriptionRepairContext
): PrescriptionIssue[] {
  const issues: PrescriptionIssue[] = [];

  for (const exercise of exercises) {
    exercise.sets.forEach((set, setIndex) => {
      if (exercise.exercise_type === "time") {
        const duration =
          DEFAULT_DURATIONS[context.trainingStyle] ??
          DEFAULT_DURATIONS.hypertrophy;

        if (
          set.target_duration_seconds == null ||
          set.target_duration_seconds <= 0
        ) {
          issues.push({
            code: PRESCRIPTION_ISSUE_CODES.INVALID_DURATION,
            exerciseId: exercise.exercise_id,
            setIndex,
            field: "target_duration_seconds",
            received: set.target_duration_seconds ?? null,
            repairedTo: duration,
          });
          set.target_duration_seconds = duration;
        }

        if (set.target_load_kg != null || set.target_reps != null) {
          issues.push({
            code: PRESCRIPTION_ISSUE_CODES.UNEXPECTED_WEIGHT_FIELDS,
            exerciseId: exercise.exercise_id,
            setIndex,
            field: "weight_fields",
            received: null,
            repairedTo: null,
          });
          set.target_load_kg = undefined;
          set.target_reps = undefined;
        }
        return;
      }

      const requiredReps = minimumReps(set.set_type, context);
      if (set.target_reps == null || set.target_reps < requiredReps) {
        const repairedReps =
          set.target_reps == null
            ? (DEFAULT_REPS[context.trainingStyle] ?? DEFAULT_REPS.hypertrophy)
            : requiredReps;
        issues.push({
          code: PRESCRIPTION_ISSUE_CODES.INVALID_REPS,
          exerciseId: exercise.exercise_id,
          setIndex,
          field: "target_reps",
          received: set.target_reps ?? null,
          repairedTo: repairedReps,
        });
        set.target_reps = repairedReps;
      }

      const loadless = isLoadlessExercise(exercise.equipment);
      if (
        set.target_load_kg == null ||
        set.target_load_kg < 0 ||
        (!loadless && set.target_load_kg === 0)
      ) {
        const repairedLoad = getSafeStartingLoadKg(exercise.equipment);
        issues.push({
          code: PRESCRIPTION_ISSUE_CODES.INVALID_LOAD,
          exerciseId: exercise.exercise_id,
          setIndex,
          field: "target_load_kg",
          received: set.target_load_kg ?? null,
          repairedTo: repairedLoad,
        });
        set.target_load_kg = repairedLoad;
      }

      if (set.target_duration_seconds != null) {
        issues.push({
          code: PRESCRIPTION_ISSUE_CODES.UNEXPECTED_DURATION_FIELD,
          exerciseId: exercise.exercise_id,
          setIndex,
          field: "target_duration_seconds",
          received: set.target_duration_seconds,
          repairedTo: null,
        });
        set.target_duration_seconds = undefined;
      }
    });
  }

  return issues;
}
