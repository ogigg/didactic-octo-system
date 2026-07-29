import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  applyProgressionAndValidatePrescriptions,
  buildFallbackWorkout,
  type ExerciseCatalogEntry,
  type GeneratedExerciseForValidation,
} from "../generator.ts";
import { EXERCISE_LOAD_SEMANTICS } from "../prescription-validation.ts";

function makeCatalogEntry(
  overrides: Partial<ExerciseCatalogEntry> = {}
): ExerciseCatalogEntry {
  return {
    id: "4143d21f-1161-46d2-98b3-976e27040642",
    name: "Barbell Bench Press",
    exercise_type: "weight",
    load_semantics: EXERCISE_LOAD_SEMANTICS.EXTERNAL,
    primary_muscles: ["chest"],
    secondary_muscles: ["triceps"],
    equipment: ["Barbell", "Bench"],
    difficulty_level: "intermediate",
    ...overrides,
  };
}

function makeGeneratedExercise(): GeneratedExerciseForValidation {
  return {
    exercise_id: "4143d21f-1161-46d2-98b3-976e27040642",
    exercise_type: "weight",
    sets: [
      {
        set_type: "warmup",
        target_load_kg: 20,
        target_reps: 8,
      },
      {
        set_type: "working",
        target_load_kg: 40,
        target_reps: 8,
      },
    ],
    progression_type: null,
    previous_display: null,
  };
}

function progressionClient(data: unknown[]) {
  return {
    rpc: () => Promise.resolve({ data }),
  } as unknown as Parameters<
    typeof applyProgressionAndValidatePrescriptions
  >[0]["supabaseClient"];
}

Deno.test(
  "fallback excludes external movements instead of guessing a load",
  () => {
    const benchDip = makeCatalogEntry({
      id: "d0725051-e981-4297-a775-1ca3de4f4a0d",
      name: "Bench Dip",
      load_semantics: EXERCISE_LOAD_SEMANTICS.BODYWEIGHT,
      equipment: ["Bench"],
    });
    const workout = buildFallbackWorkout(
      [makeCatalogEntry(), benchDip],
      "full_body",
      15,
      "hypertrophy"
    );

    assertEquals(
      workout.exercises.map((exercise) => exercise.exercise_id),
      [benchDip.id]
    );
    assertEquals(
      workout.exercises[0].sets.every((set) => set.target_load_kg === 0),
      true
    );
  }
);

Deno.test("fallback rejects an external-only catalog", () => {
  assertThrows(
    () =>
      buildFallbackWorkout(
        [makeCatalogEntry()],
        "full_body",
        15,
        "hypertrophy"
      ),
    Error,
    "No exercises with safely prescribable fallback load semantics"
  );
});

Deno.test(
  "post-progression boundary rejects a zero external working load",
  async () => {
    const exercise = makeGeneratedExercise();
    const history = {
      exercise_id: exercise.exercise_id,
      exercise_type: "weight",
      session_completed_at: new Date().toISOString(),
      difficulty_feedback: "too_hard",
      working_sets: [{ load_kg: 0, reps: 5, completed: true }],
    };

    const result = await applyProgressionAndValidatePrescriptions({
      supabaseClient: progressionClient([history]),
      userId: "user-1",
      exercises: [exercise],
      catalogMap: new Map([[exercise.exercise_id, makeCatalogEntry()]]),
      trainingStyle: "strength",
      difficulty: "beginner",
    });

    assertEquals(result.valid, false);
    assertEquals(exercise.sets[1].target_load_kg, 0);
  }
);

Deno.test(
  "post-progression boundary repairs low reps for beginners but preserves intermediate strength triples",
  async () => {
    const beginnerExercise = makeGeneratedExercise();
    const intermediateExercise = makeGeneratedExercise();
    const history = {
      exercise_id: beginnerExercise.exercise_id,
      exercise_type: "weight",
      session_completed_at: new Date().toISOString(),
      difficulty_feedback: "too_hard",
      working_sets: [{ load_kg: 40, reps: 3, completed: true }],
    };
    const catalogMap = new Map([
      [beginnerExercise.exercise_id, makeCatalogEntry()],
    ]);

    const beginner = await applyProgressionAndValidatePrescriptions({
      supabaseClient: progressionClient([history]),
      userId: "user-1",
      exercises: [beginnerExercise],
      catalogMap,
      trainingStyle: "strength",
      difficulty: "beginner",
    });
    const intermediate = await applyProgressionAndValidatePrescriptions({
      supabaseClient: progressionClient([history]),
      userId: "user-1",
      exercises: [intermediateExercise],
      catalogMap,
      trainingStyle: "strength",
      difficulty: "intermediate",
    });

    assertEquals(beginner.valid, true);
    assertEquals(beginnerExercise.sets[1].target_reps, 5);
    assertEquals(intermediate.valid, true);
    assertEquals(intermediateExercise.sets[1].target_reps, 3);
  }
);

Deno.test(
  "post-progression boundary derives a warmup from working load",
  async () => {
    const exercise = makeGeneratedExercise();
    exercise.sets[0].target_load_kg = 0;

    const result = await applyProgressionAndValidatePrescriptions({
      supabaseClient: progressionClient([]),
      userId: "user-1",
      exercises: [exercise],
      catalogMap: new Map([[exercise.exercise_id, makeCatalogEntry()]]),
      trainingStyle: "hypertrophy",
      difficulty: "beginner",
    });

    assertEquals(result.valid, true);
    assertEquals(exercise.sets[0].target_load_kg, 20);
  }
);
