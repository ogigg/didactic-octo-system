import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateProgression,
  getProgressionSetTarget,
  PROGRESSION_REASON_CODES,
  type ExerciseHistory,
  validateProgressionSetTarget,
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
// Ordered set progression
// ---------------------------------------------------------------------------

Deno.test("preserves a progressive set history across generated sets", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 36, reps: 12, completed: true },
        { load_kg: 41, reps: 12, completed: true },
        { load_kg: 45, reps: 12, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );

  assertEquals(result?.set_targets, [
    { target_load_kg: 38.5, target_reps: 8 },
    { target_load_kg: 43.5, target_reps: 8 },
    { target_load_kg: 47.5, target_reps: 8 },
  ]);

  const generatedTargets = Array.from({ length: 4 }, (_, index) =>
    getProgressionSetTarget(result?.set_targets ?? [], index, 4)
  );
  assertEquals(generatedTargets, [
    { target_load_kg: 38.5, target_reps: 8 },
    { target_load_kg: 43.5, target_reps: 8 },
    { target_load_kg: 43.5, target_reps: 8 },
    { target_load_kg: 47.5, target_reps: 8 },
  ]);
});

Deno.test(
  "anchors ramp progression to the top set instead of the lightest",
  () => {
    const result = calculateProgression(
      makeHistory({
        working_sets: [
          { load_kg: 36, reps: 12, completed: true },
          { load_kg: 41, reps: 10, completed: true },
          { load_kg: 45, reps: 8, completed: true },
        ],
      }),
      ["barbell"],
      "hypertrophy",
      NOW
    );

    assertEquals(result?.target_load_kg, 45);
    assertEquals(result?.progression_type, "reps_up");
    assertEquals(result?.set_targets, [
      { target_load_kg: 36, target_reps: 12 },
      { target_load_kg: 41, target_reps: 12 },
      { target_load_kg: 45, target_reps: 10 },
    ]);
  }
);

Deno.test("keeps a flat set history flat while progressing every set", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 40, reps: 10, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );

  assertEquals(result?.set_targets, [
    { target_load_kg: 40, target_reps: 12 },
    { target_load_kg: 40, target_reps: 12 },
    { target_load_kg: 40, target_reps: 12 },
  ]);
});

Deno.test("preserves a top-set and back-off pattern", () => {
  const result = calculateProgression(
    makeHistory({
      working_sets: [
        { load_kg: 40, reps: 10, completed: true },
        { load_kg: 50, reps: 8, completed: true },
        { load_kg: 40, reps: 10, completed: true },
      ],
    }),
    ["barbell"],
    "hypertrophy",
    NOW
  );

  assertEquals(result?.set_targets, [
    { target_load_kg: 40, target_reps: 12 },
    { target_load_kg: 50, target_reps: 10 },
    { target_load_kg: 40, target_reps: 12 },
  ]);
});

Deno.test(
  "retains the peak and back-off when downsampling four sets to three",
  () => {
    const targets = [
      { target_load_kg: 40, target_reps: 10 },
      { target_load_kg: 50, target_reps: 8 },
      { target_load_kg: 45, target_reps: 10 },
      { target_load_kg: 40, target_reps: 12 },
    ];

    assertEquals(
      Array.from({ length: 3 }, (_, index) =>
        getProgressionSetTarget(targets, index, 3)
      ),
      [targets[0], targets[1], targets[3]]
    );
  }
);

Deno.test(
  "retains the peak and back-off when downsampling five sets to three",
  () => {
    const targets = [
      { target_load_kg: 35, target_reps: 12 },
      { target_load_kg: 42.5, target_reps: 10 },
      { target_load_kg: 50, target_reps: 8 },
      { target_load_kg: 45, target_reps: 10 },
      { target_load_kg: 40, target_reps: 12 },
    ];

    assertEquals(
      Array.from({ length: 3 }, (_, index) =>
        getProgressionSetTarget(targets, index, 3)
      ),
      [targets[0], targets[2], targets[4]]
    );
  }
);

Deno.test("single-set mapping uses reps to break equal-load ties", () => {
  const targets = [
    { target_load_kg: 40, target_reps: 8 },
    { target_load_kg: 40, target_reps: 12 },
  ];

  assertEquals(getProgressionSetTarget(targets, 0, 1), targets[1]);
});

Deno.test(
  "single-set mapping keeps the top load ahead of lower high-rep sets",
  () => {
    const targets = [
      { target_load_kg: 40, target_reps: 20 },
      { target_load_kg: 50, target_reps: 5 },
    ];

    assertEquals(getProgressionSetTarget(targets, 0, 1), targets[1]);
  }
);

Deno.test(
  "maintains ordered targets when safety feedback blocks progression",
  () => {
    const result = calculateProgression(
      makeHistory({
        difficulty_feedback: "too_hard",
        working_sets: [
          { load_kg: 36, reps: 12, completed: true },
          { load_kg: 41, reps: 10, completed: true },
          { load_kg: 45, reps: 8, completed: true },
        ],
      }),
      ["barbell"],
      "hypertrophy",
      NOW
    );

    assertEquals(result?.set_targets, [
      { target_load_kg: 36, target_reps: 12 },
      { target_load_kg: 41, target_reps: 10 },
      { target_load_kg: 45, target_reps: 8 },
    ]);
    assertEquals(
      result?.reason_code,
      PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD
    );
  }
);

Deno.test("allows a generated reduction only with a safety reason", () => {
  const historicalTarget = { target_load_kg: 45, target_reps: 8 };
  const generatedReduction = { target_load_kg: 40, target_reps: 6 };

  assertEquals(
    validateProgressionSetTarget(
      generatedReduction,
      historicalTarget,
      PROGRESSION_REASON_CODES.FEEDBACK_TOO_HARD
    ),
    generatedReduction
  );
  assertEquals(
    validateProgressionSetTarget(
      generatedReduction,
      historicalTarget,
      PROGRESSION_REASON_CODES.REP_RANGE_INCREASE
    ),
    historicalTarget
  );
});

Deno.test(
  "bounds malformed safety reductions to configured deload limits",
  () => {
    assertEquals(
      validateProgressionSetTarget(
        { target_load_kg: 0, target_reps: 1 },
        { target_load_kg: 45, target_reps: 8 },
        PROGRESSION_REASON_CODES.HIGH_RPE
      ),
      { target_load_kg: 38.25, target_reps: 6 }
    );
  }
);

Deno.test("keeps bodyweight zero valid while bounding rep reductions", () => {
  assertEquals(
    validateProgressionSetTarget(
      { target_load_kg: 0, target_reps: 1 },
      { target_load_kg: 0, target_reps: 8 },
      PROGRESSION_REASON_CODES.HIGH_RPE
    ),
    { target_load_kg: 0, target_reps: 6 }
  );
});

Deno.test("bounds malformed duration reductions", () => {
  assertEquals(
    validateProgressionSetTarget(
      { target_duration_seconds: 1 },
      { target_duration_seconds: 60 },
      PROGRESSION_REASON_CODES.HIGH_RPE
    ),
    { target_duration_seconds: 51 }
  );
});

Deno.test("rejects weighted zero history but accepts bodyweight zero", () => {
  const zeroLoadHistory = makeHistory({
    working_sets: [
      { load_kg: 0, reps: 10, completed: true },
      { load_kg: 0, reps: 8, completed: true },
    ],
  });

  assertEquals(
    calculateProgression(zeroLoadHistory, ["barbell"], "hypertrophy", NOW),
    null
  );
  assertEquals(
    calculateProgression(zeroLoadHistory, ["bodyweight"], "hypertrophy", NOW)
      ?.set_targets,
    [
      { target_load_kg: 0, target_reps: 12 },
      { target_load_kg: 0, target_reps: 10 },
    ]
  );
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
