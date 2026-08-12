import type { WorkoutSet } from "@/stores/workout-store";
import type { ExercisePreviousSets } from "@/lib/workout-previous-sets";

export const DEFAULT_WORKING_SET_COUNT = 3;

let setIdCounter = 0;

export function createWorkoutSetId(): string {
  setIdCounter += 1;
  return `set-${Date.now()}-${setIdCounter}`;
}

export function countWorkingSets(
  sets: Array<{ type?: string; set_type?: string }>
): number {
  return sets.filter((set) => (set.type ?? set.set_type) === "working").length;
}

export function makeEmptyWarmupSet(
  previousDisplay: string | null = null
): WorkoutSet {
  return {
    id: createWorkoutSetId(),
    type: "warmup",
    kg: "",
    reps: "",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay,
  };
}

export function makeEmptyWorkingSet(
  previousDisplay: string | null = null
): WorkoutSet {
  return {
    id: createWorkoutSetId(),
    type: "working",
    kg: "",
    reps: "",
    durationSeconds: null,
    rpe: null,
    isCompleted: false,
    previousDisplay,
  };
}

export function buildExerciseSets(options: {
  exerciseType: "weight" | "time";
  workingCount?: number;
  previous?: ExercisePreviousSets;
}): WorkoutSet[] {
  const workingCount = Math.max(
    1,
    options.workingCount ?? DEFAULT_WORKING_SET_COUNT
  );
  const working = Array.from({ length: workingCount }, (_, index) =>
    makeEmptyWorkingSet(options.previous?.working[index]?.display ?? null)
  );

  if (options.exerciseType === "time") {
    return working;
  }

  return [makeEmptyWarmupSet(options.previous?.warmup ?? null), ...working];
}

export function normalizeSetsForExerciseType(
  exerciseType: "weight" | "time",
  sets: WorkoutSet[]
): WorkoutSet[] {
  const working = sets.filter((set) => set.type === "working");
  const preservedWorking =
    working.length > 0 ? working : [makeEmptyWorkingSet()];

  if (exerciseType === "time") {
    return preservedWorking.map((set) => ({
      ...set,
      type: "working" as const,
    }));
  }

  const firstWarmup = sets.find((set) => set.type === "warmup");
  return [
    firstWarmup
      ? { ...firstWarmup, type: "warmup" as const }
      : makeEmptyWarmupSet(),
    ...preservedWorking.map((set) => ({
      ...set,
      type: "working" as const,
    })),
  ];
}

export interface GeneratedSetLike {
  set_type: "warmup" | "working";
  target_load_kg?: number | null;
  target_reps?: number | null;
  target_duration_seconds?: number | null;
}

/** Idempotent structure normalization for generated / pending set payloads. */
export function normalizeGeneratedExerciseSets<T extends GeneratedSetLike>(
  exerciseType: "weight" | "time",
  sets: T[]
): T[] {
  const working = sets.filter((set) => set.set_type === "working");

  if (exerciseType === "time") {
    if (working.length > 0) {
      return working.map((set) => ({
        ...set,
        set_type: "working" as const,
      }));
    }

    return [
      {
        set_type: "working",
        target_duration_seconds: 40,
      } as T,
    ];
  }

  const preservedWorking =
    working.length > 0
      ? working
      : ([
          {
            set_type: "working",
            target_load_kg: 0,
            target_reps: 10,
          },
        ] as T[]);

  const firstWarmup = sets.find((set) => set.set_type === "warmup");
  const warmup = firstWarmup
    ? { ...firstWarmup, set_type: "warmup" as const }
    : ({
        set_type: "warmup",
        target_load_kg: 0,
        target_reps: 10,
      } as T);

  return [warmup, ...preservedWorking];
}

export function applyPreviousSetsToWorkoutSets(
  sets: WorkoutSet[],
  previous: ExercisePreviousSets | undefined,
  fallbackWorkingDisplay?: string | null
): WorkoutSet[] {
  let workingIndex = 0;

  return sets.map((set) => {
    if (set.type === "warmup") {
      return {
        ...set,
        previousDisplay: previous?.warmup ?? null,
      };
    }

    const previousDisplay =
      previous?.working[workingIndex]?.display ??
      fallbackWorkingDisplay ??
      null;
    workingIndex += 1;

    return {
      ...set,
      previousDisplay,
    };
  });
}

export function getWorkingSetLabel(
  setType: "warmup" | "working",
  workingOrdinalZeroBased: number
): string {
  return setType === "warmup" ? "W" : String(workingOrdinalZeroBased + 1);
}
