import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  repairWorkoutPrescriptions,
  type PrescriptionExercise,
} from "../prescription-validation.ts";

function makeExercise(
  overrides: Partial<PrescriptionExercise> = {}
): PrescriptionExercise {
  return {
    exercise_id: "exercise-1",
    exercise_type: "weight",
    equipment: ["Barbell"],
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

Deno.test("repairs zero loads for exercises that require external load", () => {
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

  const issues = repairWorkoutPrescriptions(exercises, {
    trainingStyle: "hypertrophy",
    difficulty: "intermediate",
  });

  assertEquals(exercises[0].sets[0].target_load_kg, 20);
  assertEquals(
    issues.map((issue) => issue.code),
    ["invalid_load"]
  );
});

Deno.test(
  "keeps zero load for bodyweight and explicitly loadless exercises",
  () => {
    const exercises = [
      makeExercise({
        equipment: ["Body weight", "Mat"],
        sets: [
          {
            set_type: "working",
            target_load_kg: 0,
            target_reps: 12,
          },
        ],
      }),
      makeExercise({
        exercise_id: "pull-up",
        equipment: ["Pull-up bar"],
        sets: [
          {
            set_type: "working",
            target_load_kg: 0,
            target_reps: 6,
          },
        ],
      }),
    ];

    const issues = repairWorkoutPrescriptions(exercises, {
      trainingStyle: "hypertrophy",
      difficulty: "intermediate",
    });

    assertEquals(exercises[0].sets[0].target_load_kg, 0);
    assertEquals(exercises[1].sets[0].target_load_kg, 0);
    assertEquals(issues, []);
  }
);

Deno.test("repairs impractical low reps outside strength context", () => {
  const exercises = [
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

  const issues = repairWorkoutPrescriptions(exercises, {
    trainingStyle: "hypertrophy",
    difficulty: "advanced",
  });

  assertEquals(exercises[0].sets[0].target_reps, 5);
  assertEquals(
    issues.map((issue) => issue.code),
    ["invalid_reps"]
  );
});

Deno.test(
  "keeps three-rep working sets for experienced strength training",
  () => {
    const exercises = [
      makeExercise({
        sets: [
          {
            set_type: "working",
            target_load_kg: 60,
            target_reps: 3,
          },
        ],
      }),
    ];

    const issues = repairWorkoutPrescriptions(exercises, {
      trainingStyle: "strength",
      difficulty: "advanced",
    });

    assertEquals(exercises[0].sets[0].target_reps, 3);
    assertEquals(issues, []);
  }
);

Deno.test("repairs missing time targets and removes weight fields", () => {
  const exercises = [
    makeExercise({
      exercise_type: "time",
      equipment: ["Body weight"],
      sets: [
        {
          set_type: "working",
          target_load_kg: 0,
          target_reps: 10,
        },
      ],
    }),
  ];

  const issues = repairWorkoutPrescriptions(exercises, {
    trainingStyle: "endurance",
    difficulty: "beginner",
  });

  assertEquals(exercises[0].sets[0], {
    set_type: "working",
    target_load_kg: undefined,
    target_reps: undefined,
    target_duration_seconds: 45,
  });
  assertEquals(
    issues.map((issue) => issue.code),
    ["invalid_duration", "unexpected_weight_fields"]
  );
});
