import type { WorkoutHistoryExportEntry } from "@/lib/api/workouts";

export const WORKOUT_EXPORT_PERIODS = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
} as const;

export const WORKOUT_EXPORT_FORMATS = {
  json: "json",
  csv: "csv",
} as const;

export type WorkoutExportPeriod = keyof typeof WORKOUT_EXPORT_PERIODS;
export type WorkoutExportFormat = keyof typeof WORKOUT_EXPORT_FORMATS;

export interface WorkoutExportFile {
  contents: string;
  mimeType: string;
  name: string;
  uti: string;
}

export function getWorkoutExportStartIso(
  period: WorkoutExportPeriod,
  now: Date
): string | undefined {
  const days = WORKOUT_EXPORT_PERIODS[period];
  if (days === null) return undefined;

  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export function buildWorkoutExportFile(
  workouts: WorkoutHistoryExportEntry[],
  period: WorkoutExportPeriod,
  format: WorkoutExportFormat,
  exportedAt: Date
): WorkoutExportFile {
  const date = exportedAt.toISOString().slice(0, 10);
  const periodName = period === "all" ? "all" : `last-${period}`;
  const name = `sweaty-workout-history-${periodName}-${date}.${format}`;

  if (format === "json") {
    return {
      contents: JSON.stringify(
        {
          exported_at: exportedAt.toISOString(),
          period_days: WORKOUT_EXPORT_PERIODS[period],
          workouts: workouts.map(toUserFacingWorkout),
        },
        null,
        2
      ),
      mimeType: "application/json",
      name,
      uti: "public.json",
    };
  }

  return {
    contents: workoutsToCsv(workouts),
    mimeType: "text/csv",
    name,
    uti: "public.comma-separated-values-text",
  };
}

const CSV_COLUMNS = [
  "workout_name",
  "started_at",
  "completed_at",
  "workout_comments",
  "exercise_name",
  "exercise_notes",
  "difficulty_feedback",
  "set_number",
  "set_type",
  "completed",
  "weight_kg",
  "reps",
  "duration_seconds",
  "rpe",
  "not_completed_reason",
] as const;

function toUserFacingWorkout(workout: WorkoutHistoryExportEntry) {
  return {
    ...(workout.name ? { name: workout.name } : {}),
    started_at: workout.started_at,
    completed_at: workout.completed_at,
    ...(workout.comments.length > 0
      ? {
          comments: workout.comments.map(({ comment, created_at }) => ({
            comment,
            created_at,
          })),
        }
      : {}),
    exercises: workout.exercises.map((exercise) => ({
      name: exercise.exercise_name,
      ...(exercise.notes ? { notes: exercise.notes } : {}),
      ...(exercise.difficulty_feedback
        ? { difficulty_feedback: exercise.difficulty_feedback }
        : {}),
      sets: exercise.sets.map((set) => ({
        set_number: set.set_number,
        set_type: set.set_type,
        completed: set.log?.completed ?? false,
        ...(set.log?.actual_load_kg != null
          ? { weight_kg: set.log.actual_load_kg }
          : {}),
        ...(set.log?.actual_reps != null ? { reps: set.log.actual_reps } : {}),
        ...(set.log?.actual_duration_seconds != null
          ? { duration_seconds: set.log.actual_duration_seconds }
          : {}),
        ...(set.log?.rpe != null ? { rpe: set.log.rpe } : {}),
        ...(set.log?.not_completed_reason
          ? { not_completed_reason: set.log.not_completed_reason }
          : {}),
      })),
    })),
  };
}

function workoutsToCsv(workouts: WorkoutHistoryExportEntry[]): string {
  const rows: unknown[][] = [];

  for (const workout of workouts) {
    const workoutCells = [
      workout.name,
      workout.started_at,
      workout.completed_at,
      workout.comments.map(({ comment }) => comment).join("\n"),
    ];

    if (workout.exercises.length === 0) {
      rows.push([...workoutCells, ...Array(11).fill(null)]);
      continue;
    }

    for (const exercise of workout.exercises) {
      const exerciseCells = [
        exercise.exercise_name,
        exercise.notes,
        exercise.difficulty_feedback,
      ];

      if (exercise.sets.length === 0) {
        rows.push([...workoutCells, ...exerciseCells, ...Array(8).fill(null)]);
        continue;
      }

      for (const set of exercise.sets) {
        rows.push([
          ...workoutCells,
          ...exerciseCells,
          set.set_number,
          set.set_type,
          set.log?.completed,
          set.log?.actual_load_kg,
          set.log?.actual_reps,
          set.log?.actual_duration_seconds,
          set.log?.rpe,
          set.log?.not_completed_reason,
        ]);
      }
    }
  }

  return [CSV_COLUMNS, ...rows]
    .map((row) => row.map(toCsvCell).join(","))
    .join("\n");
}

function toCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  const text = String(value);
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safeText)
    ? `"${safeText.replaceAll('"', '""')}"`
    : safeText;
}
