jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(
    () => "mock-uuid-" + Math.random().toString(36).slice(2, 8)
  ),
}));

import type { WorkoutSummary } from "@/stores/workout-store";
import type { WorkoutDetail } from "../workouts";
import { mapDbToWorkoutStore, mapWorkoutStoreToDb } from "../workout-mappers";

const mockSummary: WorkoutSummary = {
  workoutName: "Push Day",
  warmup: {
    durationSeconds: 300,
    isCompleted: true,
  },
  durationMs: 3600000,
  finishedAtMs: 1711108800000,
  exercises: [
    {
      id: "exercise-1",
      name: "Bench Press",
      exerciseType: "weight",
      restDurationSeconds: 90,
      notes: "Keep elbows tucked",
      difficultyFeedback: "ok",
      sets: [
        {
          id: "set-1",
          type: "warmup",
          kg: "40",
          reps: "10",
          durationSeconds: null,
          rpe: null,
          isCompleted: true,
          previousDisplay: null,
        },
        {
          id: "set-2",
          type: "working",
          kg: "80",
          reps: "8",
          durationSeconds: null,
          rpe: 8,
          isCompleted: true,
          previousDisplay: "80 x 8",
        },
        {
          id: "set-3",
          type: "working",
          kg: "",
          reps: "",
          durationSeconds: null,
          rpe: null,
          isCompleted: false,
          previousDisplay: null,
        },
      ],
    },
  ],
};

const mockDetail: WorkoutDetail = {
  id: "session-1",
  name: "Push Day",
  status: "completed",
  generation_source: "llm",
  goal_snapshot: "build_strength",
  started_at: "2026-03-22T10:00:00Z",
  completed_at: "2026-03-22T11:00:00Z",
  created_at: "2026-03-22T10:00:00Z",
  warmup: {
    duration_seconds: 300,
    completed: true,
  },
  exercises: [
    {
      id: "se-1",
      exercise_id: "exercise-1",
      exercise_name: "Bench Press",
      exercise_type: "weight",
      primary_muscles: ["chest"],
      order_index: 0,
      rest_duration_seconds: 90,
      notes: "Keep elbows tucked",
      difficulty_feedback: null,
      sets: [
        {
          id: "ss-1",
          set_number: 1,
          set_type: "working",
          target_load_kg: 80,
          target_reps: 8,
          log: {
            id: "sl-1",
            actual_load_kg: 80,
            actual_reps: 8,
            rpe: 7.5,
            completed: true,
            not_completed_reason: null,
          },
        },
        {
          id: "ss-2",
          set_number: 2,
          set_type: "working",
          target_load_kg: 80,
          target_reps: 8,
          log: null,
        },
      ],
    },
  ],
};

describe("mapWorkoutStoreToDb", () => {
  it("converts a workout summary to DB payload", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    expect(result.session.name).toBe("Push Day");
    expect(result.session.warmup).toEqual({
      duration_seconds: 300,
      completed: true,
    });
    expect(result.session.goal_snapshot).toBe("build_strength");
    expect(result.session.generation_source).toBe("llm");
    expect(result.exercises).toHaveLength(1);

    const exercise = result.exercises[0];
    expect(exercise.sessionExercise.exercise_id).toBe("exercise-1");
    expect(exercise.sessionExercise.order_index).toBe(0);
    expect(exercise.sessionExercise.rest_duration_seconds).toBe(90);
    expect(exercise.sessionExercise.difficulty_feedback).toBe("ok");
    expect(exercise.sets).toHaveLength(3);
  });

  it("saves exercises in their current workout order", () => {
    const reorderedSummary: WorkoutSummary = {
      ...mockSummary,
      exercises: [
        {
          ...mockSummary.exercises[0]!,
          id: "exercise-2",
          name: "Incline Press",
        },
        mockSummary.exercises[0]!,
      ],
    };

    const result = mapWorkoutStoreToDb(reorderedSummary, {
      goalSnapshot: "build_strength",
    });

    expect(
      result.exercises.map((exercise) => ({
        id: exercise.sessionExercise.exercise_id,
        order: exercise.sessionExercise.order_index,
      }))
    ).toEqual([
      { id: "exercise-2", order: 0 },
      { id: "exercise-1", order: 1 },
    ]);
  });

  it("converts string kg/reps to numbers", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    const workingSet = result.exercises[0].sets[1];
    expect(workingSet.sessionSet.target_load_kg).toBe(80);
    expect(workingSet.sessionSet.target_reps).toBe(8);
  });

  it("handles empty string kg/reps (defaults to 0 and 1)", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    const incompleteSet = result.exercises[0].sets[2];
    expect(incompleteSet.sessionSet.target_load_kg).toBe(0);
    expect(incompleteSet.sessionSet.target_reps).toBe(1);
  });

  it("marks completed sets with actual values in log", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    const completedLog = result.exercises[0].sets[1].log;
    expect(completedLog.completed).toBe(true);
    expect(completedLog.actual_load_kg).toBe(80);
    expect(completedLog.actual_reps).toBe(8);
    expect(completedLog.rpe).toBe(8);
  });

  it("marks incomplete sets without actual values in log", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    const incompleteLog = result.exercises[0].sets[2].log;
    expect(incompleteLog.completed).toBe(false);
    expect(incompleteLog.actual_load_kg).toBeUndefined();
    expect(incompleteLog.actual_reps).toBeUndefined();
  });

  it("preserves set type (warmup/working)", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    expect(result.exercises[0].sets[0].sessionSet.set_type).toBe("warmup");
    expect(result.exercises[0].sets[1].sessionSet.set_type).toBe("working");
  });

  it("generates unique UUIDs for session exercises and sets", () => {
    const result = mapWorkoutStoreToDb(mockSummary, {
      goalSnapshot: "build_strength",
    });

    const ids = [
      result.exercises[0].sessionExercise.id,
      ...result.exercises[0].sets.map((s) => s.sessionSet.id),
    ];

    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("handles bodyweight exercises (0 kg)", () => {
    const bodyweightSummary: WorkoutSummary = {
      ...mockSummary,
      exercises: [
        {
          ...mockSummary.exercises[0],
          sets: [
            {
              id: "set-bw",
              type: "working",
              kg: "0",
              reps: "15",
              durationSeconds: null,
              rpe: 6,
              isCompleted: true,
              previousDisplay: null,
            },
          ],
        },
      ],
    };

    const result = mapWorkoutStoreToDb(bodyweightSummary, {
      goalSnapshot: "improve_fitness",
    });

    expect(result.exercises[0].sets[0].sessionSet.target_load_kg).toBe(0);
    expect(result.exercises[0].sets[0].sessionSet.target_reps).toBe(15);
  });
});

describe("mapDbToWorkoutStore", () => {
  it("converts DB detail to store format", () => {
    const result = mapDbToWorkoutStore(mockDetail);

    expect(result.workoutName).toBe("Push Day");
    expect(result.warmup).toEqual({
      durationSeconds: 300,
      isCompleted: true,
    });
    expect(result.exercises).toHaveLength(1);
    expect(result.exercises[0].name).toBe("Bench Press");
    expect(result.exercises[0].restDurationSeconds).toBe(90);
    expect(result.exercises[0].difficultyFeedback).toBeNull();
  });

  it("uses actual values from log when available", () => {
    const result = mapDbToWorkoutStore(mockDetail);

    const completedSet = result.exercises[0].sets[0];
    expect(completedSet.kg).toBe("80");
    expect(completedSet.reps).toBe("8");
    expect(completedSet.rpe).toBe(7.5);
    expect(completedSet.isCompleted).toBe(true);
  });

  it("falls back to target values when no log exists", () => {
    const result = mapDbToWorkoutStore(mockDetail);

    const unloggedSet = result.exercises[0].sets[1];
    expect(unloggedSet.kg).toBe("80");
    expect(unloggedSet.reps).toBe("8");
    expect(unloggedSet.isCompleted).toBe(false);
  });

  it("defaults notes to empty string when null", () => {
    const detailWithNullNotes: WorkoutDetail = {
      ...mockDetail,
      exercises: [
        {
          ...mockDetail.exercises[0],
          notes: null,
        },
      ],
    };

    const result = mapDbToWorkoutStore(detailWithNullNotes);
    expect(result.exercises[0].notes).toBe("");
  });

  it("defaults workoutName to empty string when null", () => {
    const detailWithNullName: WorkoutDetail = {
      ...mockDetail,
      name: null,
    };

    const result = mapDbToWorkoutStore(detailWithNullName);
    expect(result.workoutName).toBe("");
  });
});
