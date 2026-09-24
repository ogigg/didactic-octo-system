import {
  buildWorkoutExportFile,
  getWorkoutExportStartIso,
} from "@/lib/workout-history-export";
import {
  buildWorkoutCoachReportFile,
  type CoachReportCopy,
} from "@/lib/workout-coach-report";
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

const reportCopy: CoachReportCopy = {
  title: "Training progress report",
  allTime: "All time",
  workouts: "Workouts",
  completedSets: "Completed sets",
  totalVolume: "Total volume",
  trainingTime: "Training time",
  averageRpe: "Average RPE",
  completionRate: "Completion rate",
  weeklyTitle: "Weekly consistency",
  weeklyEmpty: "No workouts.",
  volumeTitle: "Workout volume",
  completionTitle: "Set completion",
  completedLabel: "Completed",
  incompleteLabel: "Incomplete",
  personalRecordsTitle: "All-time personal records",
  personalRecordsSubtitle: "All completed workouts.",
  personalRecordsEmpty: "No records.",
  exercise: "Exercise",
  bestWeight: "Best weight",
  bestSetVolume: "Best set volume",
  estimatedOneRepMax: "Estimated 1RM",
  recentWorkoutsTitle: "Recent workouts",
  date: "Date",
  workout: "Workout",
  sets: "Sets",
  volume: "Volume",
  duration: "Duration",
  minutes: "min",
  sessions: "sessions",
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

  it("builds a coach PDF source with summaries, charts, and all-time PRs", () => {
    const file = buildWorkoutCoachReportFile({
      copy: reportCopy,
      exportedAt: new Date("2026-09-12T12:00:00.000Z"),
      locale: "en",
      period: "30d",
      personalRecords: [
        {
          exercise_id: "33333333-3333-4333-8333-333333333333",
          exercise_name: "Back Squat <heavy>",
          max_weight_kg: 102.5,
          max_weight_reps: 5,
          max_reps: 5,
          max_reps_weight_kg: 102.5,
          max_volume_set_kg: 512.5,
          est_1rm_kg: 119.6,
        },
      ],
      unit: "kg",
      workouts: [
        workout,
        {
          ...workout,
          id: "88888888-8888-4888-8888-888888888888",
          started_at: "2026-09-11T10:00:00.000Z",
          completed_at: "2026-09-11T11:00:00.000Z",
        },
      ],
    });

    expect(file.name).toBe("sweaty-coach-report-last-30d-2026-09-12.pdf");
    expect(file.mimeType).toBe("application/pdf");
    expect(file.contents).toContain("Training progress report");
    expect(file.contents).toContain("All-time personal records");
    expect(file.contents).toContain("512.5 kg");
    expect(file.contents).toContain('<rect x="');
    expect(file.contents).toContain('<polyline points="');
    expect(file.contents).toContain("Set completion");
    expect(file.contents).toContain('stroke="#0ea5e9"');
    expect(file.contents).toContain("Back Squat &lt;heavy&gt;");
    expect(file.contents).toContain("Aug 13, 2026 - Sep 12, 2026");
    expect(file.contents).not.toContain("Jul 20");
    expect(file.contents).not.toContain(">Aug 3<");
    expect(file.contents).toContain("Aug 10");
    expect(file.contents.match(/<rect x=/g)).toHaveLength(5);
    expect(file.contents).not.toContain("generation_source");
    expect(file.contents).not.toContain(workout.id);
  });
});
