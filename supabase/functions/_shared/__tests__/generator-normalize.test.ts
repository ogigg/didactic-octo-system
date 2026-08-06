import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeGeneratedExerciseSets } from "../generator.ts";

Deno.test(
  "normalizeGeneratedExerciseSets prepends default warmup when weight has zero warmups",
  () => {
    const result = normalizeGeneratedExerciseSets("weight", [
      { set_type: "working", target_load_kg: 40, target_reps: 10 },
      { set_type: "working", target_load_kg: 40, target_reps: 10 },
    ]);

    assertEquals(
      result.map((set) => set.set_type),
      ["warmup", "working", "working"]
    );
    assertEquals(result[0]?.target_load_kg, 0);
    assertEquals(result[0]?.target_reps, 10);
  }
);

Deno.test(
  "normalizeGeneratedExerciseSets keeps first warmup and drops extras",
  () => {
    const result = normalizeGeneratedExerciseSets("weight", [
      { set_type: "warmup", target_load_kg: 20, target_reps: 10 },
      { set_type: "warmup", target_load_kg: 30, target_reps: 8 },
      { set_type: "working", target_load_kg: 40, target_reps: 10 },
    ]);

    assertEquals(
      result.map((set) => set.set_type),
      ["warmup", "working"]
    );
    assertEquals(result[0]?.target_load_kg, 20);
  }
);

Deno.test(
  "normalizeGeneratedExerciseSets strips warmup from time exercises",
  () => {
    const result = normalizeGeneratedExerciseSets("time", [
      { set_type: "warmup", target_load_kg: 0, target_reps: 10 },
      { set_type: "working", target_duration_seconds: 40 },
    ]);

    assertEquals(
      result.map((set) => set.set_type),
      ["working"]
    );
    assertEquals(result[0]?.target_duration_seconds, 40);
  }
);

Deno.test(
  "normalizeGeneratedExerciseSets uses duration fallback when time has no working rows",
  () => {
    const result = normalizeGeneratedExerciseSets("time", [
      {
        set_type: "warmup" as const,
        target_load_kg: 0,
        target_reps: 10,
      },
    ] as Array<{
      set_type: "warmup" | "working";
      target_load_kg?: number;
      target_reps?: number;
      target_duration_seconds?: number;
    }>);

    assertEquals(result, [
      {
        set_type: "working",
        target_duration_seconds: 40,
      },
    ]);
    assertEquals("target_load_kg" in result[0]!, false);
    assertEquals("target_reps" in result[0]!, false);
  }
);

Deno.test(
  "normalizeGeneratedExerciseSets is idempotent for weight and time",
  () => {
    const weightOnce = normalizeGeneratedExerciseSets("weight", [
      { set_type: "working", target_load_kg: 40, target_reps: 10 },
    ]);
    assertEquals(
      normalizeGeneratedExerciseSets("weight", weightOnce),
      weightOnce
    );

    const timeOnce = normalizeGeneratedExerciseSets("time", []);
    assertEquals(normalizeGeneratedExerciseSets("time", timeOnce), timeOnce);
  }
);
