export const EXERCISE_LOAD_SEMANTICS = {
  EXTERNAL: "external",
  BODYWEIGHT: "bodyweight",
  BODYWEIGHT_OR_EXTERNAL: "bodyweight_or_external",
  ASSISTED: "assisted",
  VARIABLE_RESISTANCE: "variable_resistance",
  DURATION: "duration",
} as const;

export type ExerciseLoadSemantics =
  (typeof EXERCISE_LOAD_SEMANTICS)[keyof typeof EXERCISE_LOAD_SEMANTICS];

export const PRESCRIPTION_ISSUE_CODES = {
  INVALID_LOAD: "invalid_load",
  INVALID_REPS: "invalid_reps",
  INVALID_DURATION: "invalid_duration",
  INVALID_LOAD_SEMANTICS: "invalid_load_semantics",
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
  load_semantics: ExerciseLoadSemantics;
  sets: PrescriptionSet[];
}

export interface PrescriptionValidationContext {
  trainingStyle: string;
  difficulty: string;
}

export interface PrescriptionIssue {
  code: (typeof PRESCRIPTION_ISSUE_CODES)[keyof typeof PRESCRIPTION_ISSUE_CODES];
  exerciseIndex: number;
  setIndex: number;
  repaired: boolean;
}

export interface PrescriptionValidationResult {
  valid: boolean;
  issues: PrescriptionIssue[];
}

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

export function permitsZeroLoad(loadSemantics: ExerciseLoadSemantics): boolean {
  return loadSemantics !== EXERCISE_LOAD_SEMANTICS.EXTERNAL;
}

function minimumReps(
  setType: PrescriptionSet["set_type"],
  context: PrescriptionValidationContext
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

function deriveWarmupLoad(sets: PrescriptionSet[]): number | null {
  const workingLoads = sets
    .filter(
      (set): set is PrescriptionSet & { target_load_kg: number } =>
        set.set_type === "working" &&
        set.target_load_kg != null &&
        set.target_load_kg > 0
    )
    .map((set) => set.target_load_kg);

  if (workingLoads.length === 0) return null;

  const conservativeLoad = Math.min(...workingLoads) * 0.5;
  return Math.max(0.5, Math.floor(conservativeLoad * 2) / 2);
}

function issue(
  code: PrescriptionIssue["code"],
  exerciseIndex: number,
  setIndex: number,
  repaired: boolean
): PrescriptionIssue {
  return { code, exerciseIndex, setIndex, repaired };
}

/**
 * Repairs only values with a safe, deterministic basis. External working loads
 * are never guessed: an invalid value leaves the workout rejected. Warmup load
 * may be derived from a valid working load for the same exercise.
 */
export function validateAndRepairWorkoutPrescriptions(
  exercises: PrescriptionExercise[],
  context: PrescriptionValidationContext
): PrescriptionValidationResult {
  const issues: PrescriptionIssue[] = [];

  exercises.forEach((exercise, exerciseIndex) => {
    const durationSemantics =
      exercise.load_semantics === EXERCISE_LOAD_SEMANTICS.DURATION;
    const semanticsMatchType =
      (exercise.exercise_type === "time" && durationSemantics) ||
      (exercise.exercise_type === "weight" && !durationSemantics);

    if (!semanticsMatchType) {
      issues.push(
        issue(
          PRESCRIPTION_ISSUE_CODES.INVALID_LOAD_SEMANTICS,
          exerciseIndex,
          0,
          false
        )
      );
      return;
    }

    const warmupLoad =
      exercise.load_semantics === EXERCISE_LOAD_SEMANTICS.EXTERNAL
        ? deriveWarmupLoad(exercise.sets)
        : null;

    exercise.sets.forEach((set, setIndex) => {
      if (durationSemantics) {
        const duration =
          DEFAULT_DURATIONS[context.trainingStyle] ??
          DEFAULT_DURATIONS.hypertrophy;

        if (
          set.target_duration_seconds == null ||
          set.target_duration_seconds <= 0
        ) {
          issues.push(
            issue(
              PRESCRIPTION_ISSUE_CODES.INVALID_DURATION,
              exerciseIndex,
              setIndex,
              true
            )
          );
          set.target_duration_seconds = duration;
        }

        if (set.target_load_kg != null || set.target_reps != null) {
          issues.push(
            issue(
              PRESCRIPTION_ISSUE_CODES.UNEXPECTED_WEIGHT_FIELDS,
              exerciseIndex,
              setIndex,
              true
            )
          );
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
        issues.push(
          issue(
            PRESCRIPTION_ISSUE_CODES.INVALID_REPS,
            exerciseIndex,
            setIndex,
            true
          )
        );
        set.target_reps = repairedReps;
      }

      if (exercise.load_semantics === EXERCISE_LOAD_SEMANTICS.EXTERNAL) {
        if (set.target_load_kg == null || set.target_load_kg <= 0) {
          const canRepairWarmup =
            set.set_type === "warmup" && warmupLoad != null;
          issues.push(
            issue(
              PRESCRIPTION_ISSUE_CODES.INVALID_LOAD,
              exerciseIndex,
              setIndex,
              canRepairWarmup
            )
          );
          if (canRepairWarmup) set.target_load_kg = warmupLoad;
        }
      } else if (
        exercise.load_semantics === EXERCISE_LOAD_SEMANTICS.BODYWEIGHT &&
        set.target_load_kg !== 0
      ) {
        issues.push(
          issue(
            PRESCRIPTION_ISSUE_CODES.INVALID_LOAD,
            exerciseIndex,
            setIndex,
            true
          )
        );
        set.target_load_kg = 0;
      } else if (set.target_load_kg == null) {
        issues.push(
          issue(
            PRESCRIPTION_ISSUE_CODES.INVALID_LOAD,
            exerciseIndex,
            setIndex,
            true
          )
        );
        set.target_load_kg = 0;
      } else if (set.target_load_kg < 0) {
        issues.push(
          issue(
            PRESCRIPTION_ISSUE_CODES.INVALID_LOAD,
            exerciseIndex,
            setIndex,
            false
          )
        );
      }

      if (set.target_duration_seconds != null) {
        issues.push(
          issue(
            PRESCRIPTION_ISSUE_CODES.UNEXPECTED_DURATION_FIELD,
            exerciseIndex,
            setIndex,
            true
          )
        );
        set.target_duration_seconds = undefined;
      }
    });
  });

  return {
    valid: issues.every((item) => item.repaired),
    issues,
  };
}

export function summarizePrescriptionIssues(
  issues: PrescriptionIssue[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of issues) {
    counts[item.code] = (counts[item.code] ?? 0) + 1;
  }
  return counts;
}
