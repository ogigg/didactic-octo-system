import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  EXERCISE_LOAD_SEMANTICS,
  summarizePrescriptionIssues,
  validateAndRepairWorkoutPrescriptions,
  type PrescriptionExercise,
} from "../prescription-validation.ts";

function makeExercise(
  overrides: Partial<PrescriptionExercise> = {}
): PrescriptionExercise {
  return {
    exercise_id: "exercise-1",
    exercise_type: "weight",
    load_semantics: EXERCISE_LOAD_SEMANTICS.EXTERNAL,
    sets: [
      {
        set_type: "working",
        target_load_kg: 40,
        target_reps: 8,
      },
    ],
    ...overrides,
  };
}

Deno.test(
  "rejects an invalid external working load without fabricating kilograms",
  () => {
    const exercises = [
      makeExercise({
        sets: [
          {
            set_type: "working",
            target_load_kg: 0,
            target_reps: 8,
          },
        ],
      }),
    ];

    const result = validateAndRepairWorkoutPrescriptions(exercises, {
      trainingStyle: "hypertrophy",
      difficulty: "beginner",
    });

    assertEquals(result.valid, false);
    assertEquals(exercises[0].sets[0].target_load_kg, 0);
    assertEquals(result.issues, [
      {
        code: "invalid_load",
        exerciseIndex: 0,
        setIndex: 0,
        repaired: false,
      },
    ]);
  }
);

Deno.test(
  "keeps a positive ability-informed load for a new external exercise",
  () => {
    const exercises = [makeExercise()];

    const result = validateAndRepairWorkoutPrescriptions(exercises, {
      trainingStyle: "hypertrophy",
      difficulty: "advanced",
    });

    assertEquals(result.valid, true);
    assertEquals(result.issues, []);
    assertEquals(exercises[0].sets[0].target_load_kg, 40);
  }
);

Deno.test("derives an external warmup only from a valid working load", () => {
  const exercises = [
    makeExercise({
      sets: [
        {
          set_type: "warmup",
          target_load_kg: 0,
          target_reps: 10,
        },
        {
          set_type: "working",
          target_load_kg: 40,
          target_reps: 8,
        },
      ],
    }),
  ];

  const result = validateAndRepairWorkoutPrescriptions(exercises, {
    trainingStyle: "hypertrophy",
    difficulty: "beginner",
  });

  assertEquals(result.valid, true);
  assertEquals(exercises[0].sets[0].target_load_kg, 20);
  assertEquals(result.issues[0]?.repaired, true);
});

Deno.test(
  "Bench Dip uses canonical bodyweight semantics, not equipment tokens",
  () => {
    const exercises = [
      makeExercise({
        exercise_id: "bench-dip",
        load_semantics: EXERCISE_LOAD_SEMANTICS.BODYWEIGHT,
        sets: [
          {
            set_type: "working",
            target_load_kg: 5,
            target_reps: 8,
          },
        ],
      }),
    ];

    const result = validateAndRepairWorkoutPrescriptions(exercises, {
      trainingStyle: "hypertrophy",
      difficulty: "beginner",
    });

    assertEquals(result.valid, true);
    assertEquals(exercises[0].sets[0].target_load_kg, 0);
  }
);

Deno.test("assisted movements explicitly permit zero assistance load", () => {
  const exercises = [
    makeExercise({
      exercise_id: "assisted-pull-up",
      load_semantics: EXERCISE_LOAD_SEMANTICS.ASSISTED,
      sets: [
        {
          set_type: "working",
          target_load_kg: 0,
          target_reps: 6,
        },
      ],
    }),
  ];

  const result = validateAndRepairWorkoutPrescriptions(exercises, {
    trainingStyle: "hypertrophy",
    difficulty: "beginner",
  });

  assertEquals(result.valid, true);
  assertEquals(result.issues, []);
});

Deno.test(
  "beginner strength repairs three reps but experienced strength keeps them",
  () => {
    const beginner = [
      makeExercise({
        sets: [
          {
            set_type: "working",
            target_load_kg: 40,
            target_reps: 3,
          },
        ],
      }),
    ];
    const intermediate = structuredClone(beginner);
    const advanced = structuredClone(beginner);

    const beginnerResult = validateAndRepairWorkoutPrescriptions(beginner, {
      trainingStyle: "strength",
      difficulty: "beginner",
    });
    const intermediateResult = validateAndRepairWorkoutPrescriptions(
      intermediate,
      {
        trainingStyle: "strength",
        difficulty: "intermediate",
      }
    );
    const advancedResult = validateAndRepairWorkoutPrescriptions(advanced, {
      trainingStyle: "strength",
      difficulty: "advanced",
    });

    assertEquals(beginnerResult.valid, true);
    assertEquals(beginner[0].sets[0].target_reps, 5);
    assertEquals(intermediateResult.valid, true);
    assertEquals(intermediate[0].sets[0].target_reps, 3);
    assertEquals(intermediateResult.issues, []);
    assertEquals(advancedResult.valid, true);
    assertEquals(advanced[0].sets[0].target_reps, 3);
    assertEquals(advancedResult.issues, []);
  }
);

Deno.test("duration semantics repair seconds and remove weight fields", () => {
  const exercises = [
    makeExercise({
      exercise_type: "time",
      load_semantics: EXERCISE_LOAD_SEMANTICS.DURATION,
      sets: [
        {
          set_type: "working",
          target_load_kg: 0,
          target_reps: 10,
        },
      ],
    }),
  ];

  const result = validateAndRepairWorkoutPrescriptions(exercises, {
    trainingStyle: "endurance",
    difficulty: "beginner",
  });

  assertEquals(result.valid, true);
  assertEquals(exercises[0].sets[0], {
    set_type: "working",
    target_load_kg: undefined,
    target_reps: undefined,
    target_duration_seconds: 45,
  });
});

Deno.test(
  "issue summaries expose aggregate codes without fitness values",
  () => {
    assertEquals(
      summarizePrescriptionIssues([
        {
          code: "invalid_load",
          exerciseIndex: 2,
          setIndex: 1,
          repaired: false,
        },
        {
          code: "invalid_load",
          exerciseIndex: 4,
          setIndex: 0,
          repaired: true,
        },
        {
          code: "invalid_reps",
          exerciseIndex: 4,
          setIndex: 0,
          repaired: true,
        },
      ]),
      { invalid_load: 2, invalid_reps: 1 }
    );
  }
);
