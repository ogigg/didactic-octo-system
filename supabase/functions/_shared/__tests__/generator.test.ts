import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildFallbackWorkout,
  type ExerciseCatalogEntry,
} from "../generator.ts";

function makeCatalogEntry(
  overrides: Partial<ExerciseCatalogEntry> = {}
): ExerciseCatalogEntry {
  return {
    id: "4143d21f-1161-46d2-98b3-976e27040642",
    name: "Barbell Bench Press",
    exercise_type: "weight",
    primary_muscles: ["chest"],
    secondary_muscles: ["triceps"],
    equipment: ["Barbell", "Bench"],
    difficulty_level: "intermediate",
    ...overrides,
  };
}

Deno.test("fallback gives loaded movements a usable non-zero load", () => {
  const workout = buildFallbackWorkout(
    [makeCatalogEntry()],
    "full_body",
    15,
    "hypertrophy"
  );

  assertEquals(
    workout.exercises[0].sets.every((set) => set.target_load_kg === 20),
    true
  );
});

Deno.test("fallback keeps zero load for bodyweight movements", () => {
  const workout = buildFallbackWorkout(
    [
      makeCatalogEntry({
        name: "Push-up",
        equipment: ["Body weight"],
      }),
    ],
    "full_body",
    15,
    "hypertrophy"
  );

  assertEquals(
    workout.exercises[0].sets.every((set) => set.target_load_kg === 0),
    true
  );
});
