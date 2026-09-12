import {
  buildWorkoutExportFile,
  getWorkoutExportStartIso,
} from "@/lib/workout-history-export";
import type { WorkoutHistoryExportEntry } from "@/lib/api/workouts";

const workout: WorkoutHistoryExportEntry = {
  id: "11111111-1111-4111-8111-111111111111",
  name: '=Legs, "heavy"',
  status: "completed",
  generation_source: "llm",
  goal_snapshot: "build_strength",
  started_at: "2026-09-10T10:00:00.000Z",
  completed_at: "2026-09-10T11:00:00.000Z",
  created_at: "2026-09-10T09:55:00.000Z",
  warmup: { duration_seconds: 300, completed: true },
  comments: [
    {
      id: "66666666-6666-4666-8666-666666666666",
      user_id: "77777777-7777-4777-8777-777777777777",
      workout_session_id: "11111111-1111-4111-8111-111111111111",
      comment: "Strong session",
      created_at: "2026-09-10T11:01:00.000Z",
    },
  ],
  exercises: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      exercise_id: "33333333-3333-4333-8333-333333333333",
      exercise_name: "Back Squat",
      exercise_type: "weight",
      primary_muscles: ["quadriceps"],
      order_index: 0,
      rest_duration_seconds: 120,
      notes: "Controlled descent",
      difficulty_feedback: "ok",
      sets: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          set_number: 1,
          set_type: "working",
          target_load_kg: 100,
          target_reps: 5,
          log: {
            id: "55555555-5555-4555-8555-555555555555",
            actual_load_kg: 102.5,
            actual_reps: 5,
            rpe: 8,
            completed: true,
            not_completed_reason: null,
          },
        },
      ],
    },
  ],
};

describe("workout history export", () => {
  it("calculates rolling date ranges and leaves all-time unbounded", () => {
    const now = new Date("2026-09-12T12:00:00.000Z");

    expect(getWorkoutExportStartIso("7d", now)).toBe(
      "2026-09-05T12:00:00.000Z"
    );
    expect(getWorkoutExportStartIso("all", now)).toBeUndefined();
  });

  it("keeps only user-facing training history in JSON", () => {
    const file = buildWorkoutExportFile(
      [workout],
      "30d",
      "json",
      new Date("2026-09-12T12:00:00.000Z")
    );
    const data = JSON.parse(file.contents);

    expect(file.name).toBe("sweaty-workout-history-last-30d-2026-09-12.json");
    expect(data.period_days).toBe(30);
    expect(data.workouts[0].exercises[0].sets[0]).toEqual({
      set_number: 1,
      set_type: "working",
      completed: true,
      weight_kg: 102.5,
      reps: 5,
      rpe: 8,
    });
    expect(data.workouts[0].comments[0].comment).toBe("Strong session");
    expect(data.workouts[0]).not.toHaveProperty("id");
    expect(data.workouts[0]).not.toHaveProperty("generation_source");
    expect(data.workouts[0]).not.toHaveProperty("goal_snapshot");
    expect(data.workouts[0].exercises[0]).not.toHaveProperty("order_index");
    expect(data.workouts[0].exercises[0].sets[0]).not.toHaveProperty(
      "target_load_kg"
    );
  });

  it("creates one spreadsheet-safe CSV row per set", () => {
    const file = buildWorkoutExportFile(
      [workout],
      "all",
      "csv",
      new Date("2026-09-12T12:00:00.000Z")
    );
    const lines = file.contents.split("\n");

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "workout_name,started_at,completed_at,workout_comments,exercise_name,exercise_notes,difficulty_feedback,set_number,set_type,completed,weight_kg,reps,duration_seconds,rpe,not_completed_reason"
    );
    expect(lines[1]).toContain('"\'=Legs, ""heavy"""');
    expect(lines[1]).toContain("Strong session");
    expect(lines[1]).toContain("true,102.5,5,,8,");
    expect(file.contents).not.toContain("build_strength");
    expect(file.contents).not.toContain(workout.id);
  });
});
