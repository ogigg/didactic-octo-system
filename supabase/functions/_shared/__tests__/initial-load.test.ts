import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { suggestInitialLoadKg, type ExerciseHistory } from "../progression.ts";
import {
  validateAndCorrectLoads,
  type ExerciseCatalogEntry,
  type LoadValidationTarget,
  type StrengthBaseline,
} from "../generator.ts";

function makeHistory(
  overrides: Partial<ExerciseHistory> = {}
): ExerciseHistory {
  return {
    exercise_id: "similar-1",
    exercise_type: "weight",
    session_completed_at: "2026-04-02T12:00:00Z",
    difficulty_feedback: null,
    working_sets: [
      { load_kg: 80, reps: 10, completed: true },
      { load_kg: 80, reps: 8, completed: true },
      { load_kg: 70, reps: 10, completed: true },
    ],
    ...overrides,
  };
}

function makeCatalogEntry(
  overrides: Partial<ExerciseCatalogEntry>
): ExerciseCatalogEntry {
  return {
    id: "new-1",
    name: "New Exercise",
    exercise_type: "weight",
    primary_muscles: ["Pectoralis major"],
    secondary_muscles: null,
    equipment: ["Barbell"],
    difficulty_level: "intermediate",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// suggestInitialLoadKg
// ---------------------------------------------------------------------------

Deno.test("suggestInitialLoadKg uses similar exercise history", () => {
  const suggested = suggestInitialLoadKg({
    equipment: ["Barbell"],
    similarExerciseHistory: makeHistory(),
    baselineLoadKg: null,
  });
  // Primary load 80kg × 0.75 = 60kg, rounded down to 2.5kg increment.
  assertEquals(suggested, 60);
});

Deno.test("suggestInitialLoadKg falls back to muscle-matched baseline", () => {
  const suggested = suggestInitialLoadKg({
    equipment: ["Dumbbells"],
    similarExerciseHistory: null,
    baselineLoadKg: 40,
  });
  // 40kg × 0.4 = 16kg, rounded down to 2kg increment.
  assertEquals(suggested, 16);
});

Deno.test("suggestInitialLoadKg prefers similar history over baseline", () => {
  const suggested = suggestInitialLoadKg({
    equipment: ["Barbell"],
    similarExerciseHistory: makeHistory(),
    baselineLoadKg: 100,
  });
  assertEquals(suggested, 60);
});

Deno.test("suggestInitialLoadKg uses equipment default without anchors", () => {
  assertEquals(suggestInitialLoadKg({ equipment: ["Cable machine"] }), 15);
  assertEquals(suggestInitialLoadKg({ equipment: ["Barbell"] }), 30);
  assertEquals(suggestInitialLoadKg({ equipment: ["Dumbbells"] }), 10);
});

Deno.test("suggestInitialLoadKg respects equipment floors", () => {
  // Tiny baseline would suggest 2kg but dumbbell floor is 4kg.
  const suggested = suggestInitialLoadKg({
    equipment: ["Dumbbells"],
    baselineLoadKg: 5,
  });
  assertEquals(suggested, 4);
});

// ---------------------------------------------------------------------------
// validateAndCorrectLoads
// ---------------------------------------------------------------------------

function makeValidationParams(
  overrides: Partial<{
    strengthBaselines: StrengthBaseline[];
    histories: ExerciseHistory[];
  }> = {}
) {
  const catalogEntries: ExerciseCatalogEntry[] = [
    makeCatalogEntry({
      id: "new-bench",
      name: "New Bench Variation",
      primary_muscles: ["Pectoralis major"],
      equipment: ["Barbell"],
    }),
    makeCatalogEntry({
      id: "trained-row",
      name: "Trained Row",
      primary_muscles: ["Latissimus dorsi"],
      equipment: ["Barbell"],
    }),
  ];

  return {
    exercises: [
      {
        exercise_id: "new-bench",
        exercise_type: "weight" as const,
        sets: [
          { set_type: "warmup" as const, target_load_kg: 0, target_reps: 10 },
          { set_type: "working" as const, target_load_kg: 0, target_reps: 10 },
          { set_type: "working" as const, target_load_kg: 0, target_reps: 10 },
        ],
      },
      {
        exercise_id: "trained-row",
        exercise_type: "weight" as const,
        sets: [
          { set_type: "working" as const, target_load_kg: 0, target_reps: 8 },
        ],
      },
    ],
    catalogById: new Map(catalogEntries.map((e) => [e.id, e])),
    historyByExerciseId: new Map(
      overrides.histories?.map((h) => [h.exercise_id, h]) ?? []
    ),
    strengthBaselines: overrides.strengthBaselines ?? [],
    trainingStyle: "hypertrophy",
  };
}

Deno.test("corrects zero loads on new exercises using similar history", () => {
  const params = makeValidationParams({
    histories: [makeHistory({ exercise_id: "trained-row" })],
  });

  const corrected = validateAndCorrectLoads(params);

  const bench = params.exercises[0];
  // Similar row history is lat-based, bench is chest-based — no overlap,
  // so falls back to barbell default of 30kg.
  assertEquals(corrected, 3); // 2 working + 1 warmup
  assertEquals(bench.sets[1].target_load_kg, 30);
  assertEquals(bench.sets[2].target_load_kg, 30);
  assertEquals(bench.sets[0].target_load_kg, 15); // half of working load
});

Deno.test("corrects zero loads via muscle-matched similar history", () => {
  const entries: ExerciseCatalogEntry[] = [
    makeCatalogEntry({
      id: "new-incline",
      primary_muscles: ["Pectoralis major"],
      equipment: ["Barbell"],
    }),
    makeCatalogEntry({
      id: "trained-press",
      primary_muscles: ["Pectoralis major"],
      equipment: ["Dumbbells"],
    }),
  ];
  const params = {
    exercises: [
      {
        exercise_id: "new-incline",
        exercise_type: "weight" as const,
        sets: [
          { set_type: "working" as const, target_load_kg: 0, target_reps: 10 },
        ],
      },
    ],
    catalogById: new Map(entries.map((e) => [e.id, e])),
    historyByExerciseId: new Map([
      ["trained-press", makeHistory({ exercise_id: "trained-press" })],
    ]),
    strengthBaselines: [] as StrengthBaseline[],
    trainingStyle: "hypertrophy",
  };

  const corrected = validateAndCorrectLoads(params);

  // Press history primary load 80kg × 0.75 = 60kg.
  assertEquals(corrected, 1);
  assertEquals(params.exercises[0].sets[0].target_load_kg, 60);
});

Deno.test("leaves exercises with resolvable progression untouched", () => {
  const params = makeValidationParams({
    histories: [makeHistory({ exercise_id: "trained-row" })],
  });

  validateAndCorrectLoads(params);

  assertEquals(params.exercises[1].sets[0].target_load_kg, 0);
});

Deno.test("skips bodyweight-only and time exercises", () => {
  const entries: ExerciseCatalogEntry[] = [
    makeCatalogEntry({
      id: "bw-pushup",
      equipment: ["Body weight"],
    }),
    makeCatalogEntry({
      id: "plank",
      exercise_type: "time",
      equipment: ["Mat"],
    }),
  ];
  const params: {
    exercises: LoadValidationTarget[];
    catalogById: Map<string, ExerciseCatalogEntry>;
    historyByExerciseId: Map<string, ExerciseHistory>;
    strengthBaselines: StrengthBaseline[];
    trainingStyle: string;
  } = {
    exercises: [
      {
        exercise_id: "bw-pushup",
        exercise_type: "weight" as const,
        sets: [{ set_type: "working" as const, target_reps: 12 }],
      },
      {
        exercise_id: "plank",
        exercise_type: "time" as const,
        sets: [{ set_type: "working" as const, target_duration_seconds: 40 }],
      },
    ],
    catalogById: new Map(entries.map((e) => [e.id, e])),
    historyByExerciseId: new Map<string, ExerciseHistory>(),
    strengthBaselines: [] as StrengthBaseline[],
    trainingStyle: "hypertrophy",
  };

  const corrected = validateAndCorrectLoads(params);

  assertEquals(corrected, 0);
  assertEquals(params.exercises[0].sets[0].target_load_kg, undefined);
  assertEquals(params.exercises[1].sets[0].target_duration_seconds, 40);
});

Deno.test("returns 0 when all loads are already valid", () => {
  const params = makeValidationParams();
  for (const set of params.exercises[0].sets) {
    set.target_load_kg = 50;
  }
  params.exercises[1].sets[0].target_load_kg = 50;

  const corrected = validateAndCorrectLoads(params);

  assertEquals(corrected, 0);
});
