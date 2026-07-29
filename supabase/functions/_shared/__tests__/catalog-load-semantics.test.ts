import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import catalog from "../../../data/exercises.json" with { type: "json" };
import { EXERCISE_LOAD_SEMANTICS } from "../prescription-validation.ts";

const allowedSemantics = new Set<string>(
  Object.values(EXERCISE_LOAD_SEMANTICS)
);

Deno.test(
  "every canonical exercise has valid load semantics matching its type",
  () => {
    assertEquals(catalog.length > 0, true);

    for (const exercise of catalog) {
      assertEquals(
        allowedSemantics.has(exercise.load_semantics),
        true,
        `${exercise.name} has invalid load semantics`
      );
      assertEquals(
        exercise.exercise_type === "time",
        exercise.load_semantics === EXERCISE_LOAD_SEMANTICS.DURATION,
        `${exercise.name} has mismatched type and load semantics`
      );
    }
  }
);

Deno.test(
  "representative catalog movements carry explicit canonical semantics",
  () => {
    const semanticsByName = new Map(
      catalog.map((exercise) => [exercise.name, exercise.load_semantics])
    );

    assertEquals(
      semanticsByName.get("Bench Dip"),
      EXERCISE_LOAD_SEMANTICS.BODYWEIGHT
    );
    assertEquals(
      semanticsByName.get("Assisted Pull-up"),
      EXERCISE_LOAD_SEMANTICS.ASSISTED
    );
    assertEquals(
      semanticsByName.get("Plank"),
      EXERCISE_LOAD_SEMANTICS.DURATION
    );
    assertEquals(
      semanticsByName.get("Walking Lunge"),
      EXERCISE_LOAD_SEMANTICS.BODYWEIGHT_OR_EXTERNAL
    );
    assertEquals(
      semanticsByName.get("Pallof Press"),
      EXERCISE_LOAD_SEMANTICS.VARIABLE_RESISTANCE
    );
    assertEquals(
      semanticsByName.get("Barbell Bench Press"),
      EXERCISE_LOAD_SEMANTICS.EXTERNAL
    );
  }
);
