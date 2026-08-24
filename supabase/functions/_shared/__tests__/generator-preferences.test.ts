import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  ExerciseCatalogEntry,
  ExercisePreference,
  filterCatalogByPreferences,
} from "../generator.ts";

function entry(id: string): ExerciseCatalogEntry {
  return {
    id,
    name: `Exercise ${id}`,
    exercise_type: "weight",
    primary_muscles: ["chest"],
    secondary_muscles: [],
    equipment: ["Barbell"],
    difficulty_level: "intermediate",
    image_url: null,
    image: null,
  };
}

const CATALOG = [entry("a"), entry("b"), entry("c")];

Deno.test("filterCatalogByPreferences removes hard_dislike exercises", () => {
  const prefs: ExercisePreference[] = [
    { exercise_id: "b", preference: "hard_dislike" },
  ];

  assertEquals(
    filterCatalogByPreferences(CATALOG, prefs).map((e) => e.id),
    ["a", "c"]
  );
});

Deno.test("filterCatalogByPreferences keeps soft_dislike and preferred exercises", () => {
  const prefs: ExercisePreference[] = [
    { exercise_id: "a", preference: "soft_dislike" },
    { exercise_id: "b", preference: "preferred" },
  ];

  assertEquals(filterCatalogByPreferences(CATALOG, prefs), CATALOG);
});

Deno.test("filterCatalogByPreferences returns full catalog without preferences", () => {
  assertEquals(filterCatalogByPreferences(CATALOG, undefined), CATALOG);
  assertEquals(filterCatalogByPreferences(CATALOG, []), CATALOG);
});

Deno.test("filterCatalogByPreferences ignores exclusions when they empty the catalog", () => {
  const prefs: ExercisePreference[] = CATALOG.map((e) => ({
    exercise_id: e.id,
    preference: "hard_dislike" as const,
  }));

  assertEquals(filterCatalogByPreferences(CATALOG, prefs), CATALOG);
});
