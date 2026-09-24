import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyProgressionResult,
  generateWorkoutResponseSchema,
  type ProgressionMutableExercise,
} from "../generator.ts";
import { calculateProgression, type ExerciseHistory } from "../progression.ts";

const NOW = new Date("2026-04-05T12:00:00Z");
const EXERCISE_ID = "11111111-1111-4111-8111-111111111111";

function makeHistory(
  workingSets: NonNullable<ExerciseHistory["working_sets"]>,
  overrides: Partial<ExerciseHistory> = {}
): ExerciseHistory {
  return {
    exercise_id: EXERCISE_ID,
    exercise_type: "weight",
    session_id: "session-1",
    session_completed_at: "2026-04-02T12:00:00Z",
    difficulty_feedback: null,
    working_sets: workingSets,
    ...overrides,
  };
}

function makeMutableExercise(
  setCount: number,
  targetLoad = 20,
  targetReps = 8
): ProgressionMutableExercise {
  return {
    sets: Array.from({ length: setCount }, () => ({
      set_type: "working" as const,
      target_load_kg: targetLoad,
      target_reps: targetReps,
    })),
    progression_type: null,
    previous_display: null,
    progression_reason_code: null,
    progression_is_deload: false,
  };
}

function parseFinalExercise(exercise: ProgressionMutableExercise) {
  return generateWorkoutResponseSchema.parse({
    workout_name: "Progression Test",
    reasoning: null,
    warmup: null,
    generation_source: "llm",
    goal_snapshot: "build_strength",
    custom_goal_snapshot: null,
    exercises: [
      {
        exercise_id: EXERCISE_ID,
        exercise_name: "Test Exercise",
        exercise_type: "weight",
        image: null,
        rest_duration_seconds: 90,
        notes: null,
        reasoning: null,
        ...exercise,
      },
    ],
  }).exercises[0];
}

function applyHistory(
  history: ExerciseHistory,
  generatedSetCount: number,
  equipment: string[] = ["barbell"]
) {
  const exercise = makeMutableExercise(generatedSetCount);
  const result = calculateProgression(history, equipment, "hypertrophy", NOW);
  applyProgressionResult(exercise, result);
  return parseFinalExercise(exercise);
}

Deno.test(
  "generator mutates and parses progressive, flat, and back-off histories",
  () => {
    const progressive = applyHistory(
      makeHistory([
        { load_kg: 36, reps: 12, completed: true },
        { load_kg: 41, reps: 12, completed: true },
        { load_kg: 45, reps: 12, completed: true },
      ]),
      3
    );
    assertEquals(
      progressive.sets.map((set) => [set.target_load_kg, set.target_reps]),
      [
        [38.5, 8],
        [43.5, 8],
        [47.5, 8],
      ]
    );

    const flat = applyHistory(
      makeHistory([
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 40, reps: 10, completed: true },
      ]),
      3
    );
    assertEquals(
      flat.sets.map((set) => [set.target_load_kg, set.target_reps]),
      [
        [40, 12],
        [40, 12],
        [40, 12],
      ]
    );

    const backOff = applyHistory(
      makeHistory([
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 50, reps: 8, completed: true },
        { load_kg: 40, reps: 10, completed: true },
      ]),
      3
    );
    assertEquals(
      backOff.sets.map((set) => [set.target_load_kg, set.target_reps]),
      [
        [40, 12],
        [50, 10],
        [40, 12],
      ]
    );
  }
);

Deno.test(
  "generator preserves peaks when downsampling four or five sets to three",
  () => {
    const fourSets = applyHistory(
      makeHistory([
        { load_kg: 40, reps: 8, completed: true },
        { load_kg: 50, reps: 8, completed: true },
        { load_kg: 45, reps: 8, completed: true },
        { load_kg: 40, reps: 8, completed: true },
      ]),
      3
    );
    assertEquals(
      fourSets.sets.map((set) => set.target_load_kg),
      [40, 50, 40]
    );

    const fiveSets = applyHistory(
      makeHistory([
        { load_kg: 35, reps: 8, completed: true },
        { load_kg: 42.5, reps: 8, completed: true },
        { load_kg: 50, reps: 8, completed: true },
        { load_kg: 45, reps: 8, completed: true },
        { load_kg: 40, reps: 8, completed: true },
      ]),
      3
    );
    assertEquals(
      fiveSets.sets.map((set) => set.target_load_kg),
      [35, 50, 40]
    );
  }
);

Deno.test(
  "generator leaves missing and invalid weighted histories unchanged",
  () => {
    const missing = makeMutableExercise(2, 30, 10);
    applyProgressionResult(missing, null);
    assertEquals(
      parseFinalExercise(missing)?.sets.map((set) => [
        set.target_load_kg,
        set.target_reps,
      ]),
      [
        [30, 10],
        [30, 10],
      ]
    );

    const invalidWeightedHistory = makeHistory([
      { load_kg: 0, reps: 10, completed: true },
    ]);
    const invalid = applyHistory(invalidWeightedHistory, 1);
    assertEquals(invalid?.progression_reason_code, null);
    assertEquals(invalid?.sets[0]?.target_load_kg, 20);
  }
);

Deno.test(
  "generator preserves valid bodyweight zero loads through final parsing",
  () => {
    const bodyweight = applyHistory(
      makeHistory([
        { load_kg: 0, reps: 8, completed: true },
        { load_kg: 0, reps: 10, completed: true },
      ]),
      2,
      ["bodyweight"]
    );

    assertEquals(
      bodyweight.sets.map((set) => [set.target_load_kg, set.target_reps]),
      [
        [0, 10],
        [0, 12],
      ]
    );
  }
);

Deno.test(
  "generator bounds malformed safety reductions and exposes their reason",
  () => {
    const exercise = makeMutableExercise(1, 0, 1);
    const result = calculateProgression(
      makeHistory([{ load_kg: 45, reps: 8, completed: true, rpe: 9 }], {
        difficulty_feedback: "too_hard",
      }),
      ["barbell"],
      "hypertrophy",
      NOW
    );

    applyProgressionResult(exercise, result);
    const parsed = parseFinalExercise(exercise);

    assertEquals(parsed?.sets[0]?.target_load_kg, 38.25);
    assertEquals(parsed?.sets[0]?.target_reps, 6);
    assertEquals(parsed?.progression_reason_code, "feedback_too_hard");
    assertEquals(parsed?.progression_is_deload, true);
  }
);
