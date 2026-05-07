import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calculateProgression, type ExerciseHistory } from "../progression.ts";

const NOW = new Date("2026-04-05T12:00:00Z");
const RECENT = "2026-04-02T12:00:00Z"; // 3 days ago
const STALE = "2026-03-15T12:00:00Z"; // 21 days ago

function makeHistory(
  overrides: Partial<ExerciseHistory> = {}
): ExerciseHistory {
  return {
    exercise_id: "ex-1",
    exercise_type: "weight",
    session_completed_at: RECENT,
    difficulty_feedback: null,
    working_sets: [
      { load_kg: 40, reps: 10, completed: true },
      { load_kg: 40, reps: 10, completed: true },
      { load_kg: 40, reps: 8, completed: true },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// No history
// ---------------------------------------------------------------------------

Deno.test("returns null for no history (new exercise)", () => {
  const result = calculateProgression(null, ["barbell"], "hypertrophy", NOW);
  assertEquals(result, null);
});

Deno.test("returns null for empty working_sets", () => {
  const result = calculateProgression(
    makeHistory({ working_sets: [] }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result, null);
});

Deno.test("returns null for null working_sets", () => {
  const result = calculateProgression(
    makeHistory({ working_sets: null }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result, null);
});

// ---------------------------------------------------------------------------
// Stale session (>14 days)
// ---------------------------------------------------------------------------

Deno.test("holds weight/reps when session is stale (>14 days)", () => {
  const result = calculateProgression(
    makeHistory({ session_completed_at: STALE }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 8); // worst set
});

// ---------------------------------------------------------------------------
// Feedback: too_hard
// ---------------------------------------------------------------------------

Deno.test("holds when feedback is too_hard", () => {
  const result = calculateProgression(
    makeHistory({ difficulty_feedback: "too_hard" }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 8);
});

// ---------------------------------------------------------------------------
// Feedback: too_easy
// ---------------------------------------------------------------------------

Deno.test("bumps weight when feedback is too_easy (barbell)", () => {
  const result = calculateProgression(
    makeHistory({ difficulty_feedback: "too_easy" }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 42.5); // +2.5kg barbell
  assertEquals(result?.target_reps, 8); // reset to min of hypertrophy range
});

Deno.test("bumps weight when feedback is too_easy (dumbbell)", () => {
  const result = calculateProgression(
    makeHistory({ difficulty_feedback: "too_easy" }),
    ["dumbbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 42); // +2kg dumbbell
});

Deno.test("increases reps when too_easy but bodyweight", () => {
  const result = calculateProgression(
    makeHistory({ difficulty_feedback: "too_easy" }),
    ["bodyweight"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "reps_up");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 10); // worst (8) + 2
});

// ---------------------------------------------------------------------------
// Normal progression: reps below top of range
// ---------------------------------------------------------------------------

Deno.test("increases reps when below top of hypertrophy range", () => {
  const result = calculateProgression(
    makeHistory(),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "reps_up");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 10); // worst (8) + 2
});

Deno.test("caps reps at top of range", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 11, completed: true },
        { load_kg: 40, reps: 12, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  // worst = 11, +2 = 13, but capped at 12
  assertEquals(result?.target_reps, 12);
  assertEquals(result?.progression_type, "reps_up");
});

// ---------------------------------------------------------------------------
// Normal progression: at top of range -> weight up
// ---------------------------------------------------------------------------

Deno.test(
  "bumps weight when all sets at top of hypertrophy range (barbell)",
  () => {
    const result = calculateProgression(
      makeHistory({
        working_sets: [
          { load_kg: 40, reps: 12, completed: true },
          { load_kg: 40, reps: 12, completed: true },
          { load_kg: 40, reps: 12, completed: true },
        ],
      }),
      ["barbell"],
      "hypertrophy",
      NOW
    );
    assertEquals(result?.progression_type, "weight_up");
    assertEquals(result?.target_load_kg, 42.5); // +2.5kg barbell
    assertEquals(result?.target_reps, 8); // reset to min
  }
);

Deno.test("bumps weight with dumbbell increment", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 20, reps: 12, completed: true },
        { load_kg: 20, reps: 12, completed: true },
      ],
    }),
    ["dumbbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 22); // +2kg
});

Deno.test("bumps weight with cable/machine increment", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [{ load_kg: 30, reps: 12, completed: true }],
    }),
    ["cable"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 31.25); // +1.25kg
});

// ---------------------------------------------------------------------------
// Bodyweight: rep-only progression at top of range
// ---------------------------------------------------------------------------

Deno.test(
  "bodyweight: increases reps at top of range instead of weight",
  () => {
    const result = calculateProgression(
      makeHistory({
        working_sets: [
          { load_kg: 0, reps: 12, completed: true },
          { load_kg: 0, reps: 12, completed: true },
        ],
      }),
      ["bodyweight"],
      "hypertrophy",
      NOW
    );
    assertEquals(result?.progression_type, "reps_up");
    assertEquals(result?.target_load_kg, 0);
    assertEquals(result?.target_reps, 14); // 12 + 2
  }
);

// ---------------------------------------------------------------------------
// Strength training style (3-6 range)
// ---------------------------------------------------------------------------

Deno.test("strength style: bumps weight at top of range (6 reps)", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 100, reps: 6, completed: true },
        { load_kg: 100, reps: 6, completed: true },
      ],
    }),
    ["barbell"],
    "strength",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 102.5);
  assertEquals(result?.target_reps, 3); // reset to min of strength range
});

Deno.test("strength style: increases reps below top", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 100, reps: 4, completed: true },
        { load_kg: 100, reps: 5, completed: true },
      ],
    }),
    ["barbell"],
    "strength",
    NOW
  );
  assertEquals(result?.progression_type, "reps_up");
  assertEquals(result?.target_reps, 6); // worst (4) + 2, capped at 6
});

// ---------------------------------------------------------------------------
// previous_display format
// ---------------------------------------------------------------------------

Deno.test("formats previous_display from best set", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 8, completed: true },
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 40, reps: 9, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.previous_display, "40\u00d710"); // 40×10
});

// ---------------------------------------------------------------------------
// Skipped / incomplete sets
// ---------------------------------------------------------------------------

Deno.test("ignores incomplete sets", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 12, completed: true },
        { load_kg: 40, reps: null, completed: false },
        { load_kg: 40, reps: 12, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  // Only completed sets count, both at 12 → weight up
  assertEquals(result?.progression_type, "weight_up");
});

Deno.test("returns null when all sets are incomplete", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: null, completed: false },
        { load_kg: null, reps: null, completed: false },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result, null);
});
