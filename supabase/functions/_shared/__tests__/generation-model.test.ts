import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  expandModelWorkout,
  readModelContent,
  ModelResponseError,
} from "../generation-model.ts";
import {
  planQueueCatalogs,
  shortlistCatalog,
  type ExerciseCatalogEntry,
} from "../generator.ts";

const catalog: ExerciseCatalogEntry[] = Array.from({ length: 40 }, (_, i) => ({
  id: `11111111-1111-4111-8111-${String(i).padStart(12, "0")}`,
  name: `Exercise ${i}`,
  exercise_type: i % 2 ? "time" : "weight",
  primary_muscles: [i % 2 ? "Quadriceps" : "Pectoralis major"],
  secondary_muscles: [],
  equipment: ["Barbell"],
  difficulty_level: "beginner",
}));
const response = () => ({
  workout_name: "Foundation",
  training_strategy: "Build consistent strength.",
  exercises: catalog.slice(0, 3).map((e) => ({
    exercise_id: e.id,
    working_sets: 3,
    load_kg: e.exercise_type === "weight" ? 30 : null,
    reps: e.exercise_type === "weight" ? 10 : null,
    duration_seconds: e.exercise_type === "time" ? 40 : null,
    rest_seconds: 90,
    rationale: "Matches the session focus.",
    notes: null,
  })),
});
Deno.test(
  "compact response expands weight warmup and independent working sets, timed exercise has no warmup",
  () => {
    const result = expandModelWorkout(response(), catalog, 15, {
      min: 3,
      max: 4,
    });
    assertEquals(result.exercises[0].sets.length, 4);
    assertEquals(result.exercises[0].sets[0], {
      set_type: "warmup",
      target_load_kg: 15,
      target_reps: 10,
    });
    assertEquals(result.exercises[1].sets.length, 3);
    assertEquals(result.exercises[1].sets[0], {
      set_type: "working",
      target_duration_seconds: 40,
    });
    assertEquals(
      result.exercises[0].sets[1] === result.exercises[0].sets[2],
      false
    );
  }
);
Deno.test(
  "semantic validation rejects duplicates, wrong IDs, counts and type-incompatible targets",
  () => {
    const duplicate = response();
    duplicate.exercises[2] = duplicate.exercises[0];
    assertThrows(
      () => expandModelWorkout(duplicate, catalog, 15, { min: 3, max: 4 }),
      ModelResponseError,
      "Duplicate"
    );
    assertThrows(
      () =>
        expandModelWorkout(response(), catalog.slice(1), 15, {
          min: 3,
          max: 4,
        }),
      ModelResponseError,
      "eligible catalog"
    );
    assertThrows(
      () => expandModelWorkout(response(), catalog, 90, { min: 8, max: 12 }),
      ModelResponseError,
      "count"
    );
    const wrong = response();
    wrong.exercises[1].load_kg = 20;
    assertThrows(
      () => expandModelWorkout(wrong, catalog, 15, { min: 3, max: 4 }),
      ModelResponseError,
      "exercise type"
    );
  }
);
Deno.test(
  "token exhaustion and empty answers never parse hidden reasoning",
  () => {
    assertThrows(
      () =>
        readModelContent({
          choices: [
            {
              finish_reason: "length",
              message: { content: "", reasoning: "{}" },
            },
          ],
        }),
      ModelResponseError,
      "budget"
    );
    assertThrows(
      () =>
        readModelContent({
          choices: [
            {
              finish_reason: "stop",
              message: { content: "", reasoning: "{}" },
            },
          ],
        }),
      ModelResponseError,
      "no answer"
    );
    assertThrows(
      () => readModelContent({ error: { message: "Unavailable" } }),
      ModelResponseError,
      "Unavailable"
    );
  }
);
Deno.test(
  "queue pools preserve muscle coverage, avoid overlap when feasible and never restore excluded IDs",
  () => {
    const pools = planQueueCatalogs(
      catalog,
      [{ exercise_id: catalog[0].id, preference: "hard_dislike" }],
      [
        { queue_position: 1, focus_area: "full_body" },
        { queue_position: 2, focus_area: "full_body" },
      ],
      45
    );
    assertEquals(
      pools.flat().some((e) => e.id === catalog[0].id),
      false
    );
    assertEquals(
      pools[0].some((e) => pools[1].some((other) => other.id === e.id)),
      false
    );
    for (const pool of pools)
      assertEquals(new Set(pool.flatMap((e) => e.primary_muscles)).size, 2);
    const push = shortlistCatalog(catalog, [], "push");
    assertEquals(
      push.every((e) => e.primary_muscles[0] === "Pectoralis major"),
      true
    );
  }
);

Deno.test(
  "five-session planning uses enough candidates and preserves custom requests",
  () => {
    const expandedCatalog = [
      ...catalog,
      ...catalog.map((e, i) => ({
        ...e,
        id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`,
      })),
    ];
    const slots = Array.from({ length: 5 }, (_, i) => ({
      queue_position: i + 1,
      focus_area: "full_body",
    }));
    const pools = planQueueCatalogs(expandedCatalog, [], slots, 60);
    assertEquals(
      pools.every((pool) => pool.length >= 9),
      true
    );
    assertEquals(
      new Set(pools.flat().map((e) => e.id)).size,
      pools.flat().length
    );
    const custom = planQueueCatalogs(
      expandedCatalog,
      [],
      slots,
      60,
      "Use squats in every workout"
    );
    assertEquals(
      custom.every((pool) => pool.length === expandedCatalog.length),
      true
    );
  }
);
