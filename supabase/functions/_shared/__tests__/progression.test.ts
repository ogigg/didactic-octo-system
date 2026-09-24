import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateProgression,
  getAchievableIncrements,
  getIncrementEquipmentKey,
  pickWeightIncrement,
  PROGRESSION_REASON_CODES,
  type ExerciseHistory,
  type WeightIncrements,
} from "../progression.ts";

const NOW = new Date("2026-04-05T12:00:00Z");
const RECENT = "2026-04-02T12:00:00Z"; // 3 days ago
const STALE = "2026-03-15T12:00:00Z"; // 21 days ago

function makeHistory(
  overrides: Partial<ExerciseHistory> = {}
): ExerciseHistory {
  return {
    exercise_id: "ex-1",
    exercise_type: "weight",
    session_id: "session-1",
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
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.STALE_HISTORY);
  assertEquals(result?.evidence.max_rpe, null);
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
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD);
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
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY);
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
// RPE precedence
// ---------------------------------------------------------------------------

Deno.test("holds when any completed working-set RPE is >= 9", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 12, completed: true, rpe: 7 },
        { load_kg: 40, reps: 12, completed: true, rpe: 9 },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 12);
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.HIGH_RPE);
  assertEquals(result?.evidence.max_rpe, 9);
});

Deno.test("too_easy plus RPE >= 9 maintains with conflict reason", () => {
  const result = calculateProgression(
    makeHistory({
      difficulty_feedback: "too_easy",
      working_sets: [
        { load_kg: 40, reps: 10, completed: true, rpe: 8 },
        { load_kg: 40, reps: 10, completed: true, rpe: 10 },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_load_kg, 40);
  assertEquals(result?.target_reps, 10);
  assertEquals(
    result?.reason_code,
    PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY_HIGH_RPE_CONFLICT
  );
  assertEquals(result?.evidence.max_rpe, 10);
  assertEquals(result?.evidence.difficulty_feedback, "too_easy");
});

Deno.test("too_hard takes precedence over high RPE for reason code", () => {
  const result = calculateProgression(
    makeHistory({
      difficulty_feedback: "too_hard",
      working_sets: [{ load_kg: 40, reps: 8, completed: true, rpe: 9 }],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD);
  assertEquals(result?.evidence.max_rpe, 9);
});

Deno.test("missing RPE remains backward compatible and progresses", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 12, completed: true },
        { load_kg: 40, reps: 12, completed: true, rpe: null },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.WEIGHT_INCREMENT);
  assertEquals(result?.evidence.max_rpe, null);
});

Deno.test("RPE below 9 does not block normal progression", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 10, completed: true, rpe: 7 },
        { load_kg: 40, reps: 8, completed: true, rpe: 8 },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "reps_up");
  assertEquals(result?.target_reps, 10);
  assertEquals(
    result?.reason_code,
    PROGRESSION_REASON_CODES.REP_RANGE_INCREASE
  );
  assertEquals(result?.evidence.max_rpe, 8);
});

Deno.test("incomplete sets with high RPE are ignored", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 12, completed: true, rpe: 7 },
        { load_kg: 40, reps: 12, completed: false, rpe: 10 },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.WEIGHT_INCREMENT);
  assertEquals(result?.evidence.max_rpe, 7);
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
  assertEquals(
    result?.reason_code,
    PROGRESSION_REASON_CODES.REP_RANGE_INCREASE
  );
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
    assertEquals(
      result?.reason_code,
      PROGRESSION_REASON_CODES.WEIGHT_INCREMENT
    );
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
    assertEquals(
      result?.reason_code,
      PROGRESSION_REASON_CODES.REP_RANGE_INCREASE
    );
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

// ---------------------------------------------------------------------------
// Time exercises
// ---------------------------------------------------------------------------

Deno.test("time exercise: increments duration when feedback is ok", () => {
  const result = calculateProgression(
    makeHistory({
      exercise_type: "time",
      working_sets: [
        { load_kg: null, reps: null, duration_seconds: 45, completed: true },
        { load_kg: null, reps: null, duration_seconds: 40, completed: true },
      ],
    }),
    ["bodyweight"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "reps_up");
  assertEquals(result?.target_duration_seconds, 55); // 45 + 10
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.TIME_INCREMENT);
  assertEquals(result?.previous_display, "0:45");
});

Deno.test("time exercise: larger bump when too_easy without high RPE", () => {
  const result = calculateProgression(
    makeHistory({
      exercise_type: "time",
      difficulty_feedback: "too_easy",
      working_sets: [
        {
          load_kg: null,
          reps: null,
          duration_seconds: 60,
          completed: true,
          rpe: 6,
        },
      ],
    }),
    ["bodyweight"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.target_duration_seconds, 75); // 60 + 15
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY);
  assertEquals(result?.evidence.max_rpe, 6);
});

Deno.test("time exercise: holds when RPE >= 9", () => {
  const result = calculateProgression(
    makeHistory({
      exercise_type: "time",
      difficulty_feedback: "too_easy",
      working_sets: [
        {
          load_kg: null,
          reps: null,
          duration_seconds: 60,
          completed: true,
          rpe: 9,
        },
      ],
    }),
    ["bodyweight"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_duration_seconds, 60);
  assertEquals(
    result?.reason_code,
    PROGRESSION_REASON_CODES.FEEDBACK_TOO_EASY_HIGH_RPE_CONFLICT
  );
});

Deno.test("time exercise: holds when stale", () => {
  const result = calculateProgression(
    makeHistory({
      exercise_type: "time",
      session_completed_at: STALE,
      working_sets: [
        { load_kg: null, reps: null, duration_seconds: 90, completed: true },
      ],
    }),
    ["bodyweight"],
    "hypertrophy",
    NOW
  );
  assertEquals(result?.progression_type, "maintained");
  assertEquals(result?.target_duration_seconds, 90);
  assertEquals(result?.reason_code, PROGRESSION_REASON_CODES.STALE_HISTORY);
});

// ---------------------------------------------------------------------------
// User-configured weight increments (per equipment category)
// ---------------------------------------------------------------------------

const MACHINE_INCREMENTS: WeightIncrements = { base_kg: 4, micro_kg: 1.1 };
const BARBELL_MICRO_PLATES: WeightIncrements = { base_kg: 2.5, micro_kg: 0.25 };

Deno.test(
  "getIncrementEquipmentKey maps catalog equipment to categories",
  () => {
    assertEquals(getIncrementEquipmentKey(["Machine"]), "machine");
    assertEquals(getIncrementEquipmentKey(["Barbell"]), "barbell");
    assertEquals(getIncrementEquipmentKey(["Dumbbells"]), "dumbbell");
    assertEquals(getIncrementEquipmentKey(["Cable"]), "cable");
    // barbell wins when both are listed
    assertEquals(getIncrementEquipmentKey(["Dumbbell", "Barbell"]), "barbell");
    assertEquals(getIncrementEquipmentKey(["Body weight"]), null);
    assertEquals(getIncrementEquipmentKey(["band"]), null);
  }
);

Deno.test("getAchievableIncrements combines base and micro steps", () => {
  const deltas = getAchievableIncrements(MACHINE_INCREMENTS);
  assertEquals(deltas.slice(0, 8), [1.1, 2.2, 3.3, 4, 5.1, 6.2, 7.3, 8]);
});

Deno.test(
  "getAchievableIncrements without micro returns base multiples",
  () => {
    const deltas = getAchievableIncrements({ base_kg: 4, micro_kg: null });
    assertEquals(deltas.slice(0, 3), [4, 8, 12]);
  }
);

Deno.test("getAchievableIncrements ignores invalid config", () => {
  assertEquals(getAchievableIncrements({ base_kg: null, micro_kg: 1 }), []);
  assertEquals(getAchievableIncrements({ base_kg: 0, micro_kg: null }), []);
});

Deno.test("pickWeightIncrement finds smallest reachable delta", () => {
  const config = { machine: MACHINE_INCREMENTS };
  // >= 2 → first reachable is 2.2 (two micro-plates)
  assertEquals(pickWeightIncrement(["machine"], config, 2), 2.2);
  // >= 4 → a full machine step
  assertEquals(pickWeightIncrement(["machine"], config, 4), 4);
  // >= 5 → step + one micro-plate
  assertEquals(pickWeightIncrement(["machine"], config, 5), 5.1);
  // >= 7 → step + three micro-plates
  assertEquals(pickWeightIncrement(["machine"], config, 7), 7.3);
});

Deno.test(
  "pickWeightIncrement only applies config for matching category",
  () => {
    const config = { machine: MACHINE_INCREMENTS };
    // barbell exercise ignores the machine config → default 2.5
    assertEquals(pickWeightIncrement(["barbell"], config, 1), 2.5);
  }
);

Deno.test("pickWeightIncrement supports small barbell plates (0.25kg)", () => {
  const config = { barbell: BARBELL_MICRO_PLATES };
  // >= 1 → four 0.25kg plates give exactly 1kg
  assertEquals(pickWeightIncrement(["barbell"], config, 1), 1);
  // a tiny min jump still resolves to a real reachable delta
  assertEquals(pickWeightIncrement(["barbell"], config, 0.25), 0.25);
  // >= 3 → step (2.5) + two micro-plates (0.5)
  assertEquals(pickWeightIncrement(["barbell"], config, 3), 3);
});

Deno.test(
  "pickWeightIncrement falls back to equipment defaults without config",
  () => {
    assertEquals(pickWeightIncrement(["machine"], null, 1), 1.25);
    assertEquals(
      pickWeightIncrement(
        ["barbell"],
        { dumbbell: { base_kg: null, micro_kg: null } },
        1
      ),
      2.5
    );
  }
);

Deno.test("too_easy uses a full configured step (37kg → 41kg)", () => {
  const result = calculateProgression(
    makeHistory({
      difficulty_feedback: "too_easy",
      working_sets: [{ load_kg: 37, reps: 10, completed: true }],
    }),
    ["machine"],
    "hypertrophy",
    NOW,
    { machine: MACHINE_INCREMENTS }
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 41); // +4kg machine step
});

Deno.test("too_easy on barbell uses configured barbell step", () => {
  const result = calculateProgression(
    makeHistory({
      difficulty_feedback: "too_easy",
      working_sets: [{ load_kg: 60, reps: 10, completed: true }],
    }),
    ["barbell"],
    "hypertrophy",
    NOW,
    { barbell: { base_kg: 1.25, micro_kg: 0.25 } }
  );
  assertEquals(result?.target_load_kg, 61.25); // +1.25kg small plates
});

Deno.test(
  "top-of-range progression allows a micro-only jump (40kg → 42.2kg)",
  () => {
    const result = calculateProgression(
      makeHistory({
        working_sets: [{ load_kg: 40, reps: 12, completed: true }],
      }),
      ["machine"],
      "hypertrophy",
      NOW,
      { machine: MACHINE_INCREMENTS }
    );
    assertEquals(result?.progression_type, "weight_up");
    assertEquals(result?.target_load_kg, 42.2); // +2.2kg (two micro-plates)
  }
);

Deno.test("configured increments without micro fall back to full steps", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [{ load_kg: 40, reps: 12, completed: true }],
    }),
    ["machine"],
    "hypertrophy",
    NOW,
    { machine: { base_kg: 4, micro_kg: null } }
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 44); // +4kg
});

Deno.test("null increments keep equipment-based defaults", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [{ load_kg: 30, reps: 12, completed: true }],
    }),
    ["cable"],
    "hypertrophy",
    NOW,
    { cable: { base_kg: null, micro_kg: null } }
  );
  assertEquals(result?.progression_type, "weight_up");
  assertEquals(result?.target_load_kg, 31.25); // +1.25kg default
});
