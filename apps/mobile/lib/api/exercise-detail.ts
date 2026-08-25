import { z } from "zod";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const exerciseDetailStatsSchema = z.object({
  max_weight_kg: z.number(),
  max_weight_date: z.string().nullable(),
  max_reps: z.number(),
  max_reps_date: z.string().nullable(),
  max_volume_set_kg: z.number(),
  max_volume_set_date: z.string().nullable(),
  est_1rm_kg: z.number().nullable(),
  max_rpe: z.number().nullable(),
  max_duration_seconds: z.number().nullable().optional(),
  max_duration_date: z.string().nullable().optional(),
});

export type ExerciseDetailStats = z.infer<typeof exerciseDetailStatsSchema>;

const exerciseSessionSetSchema = z.object({
  set_number: z.number(),
  load_kg: z.number().nullable(),
  reps: z.number().nullable(),
  duration_seconds: z.number().nullable().optional(),
  rpe: z.number().nullable(),
});

export type ExerciseSessionSet = z.infer<typeof exerciseSessionSetSchema>;

const exerciseSessionHistorySchema = z.object({
  date: z.string(),
  workout_name: z.string(),
  sets: z.array(exerciseSessionSetSchema).nullable(),
});

export type ExerciseSessionHistory = z.infer<
  typeof exerciseSessionHistorySchema
>;

export interface ExerciseWeekMetrics {
  maxWeightKg: number;
  maxReps: number;
  estimatedOneRepMaxKg: number;
  maxDurationSeconds: number;
}

export function getExerciseWeekMetrics(
  weekStart: string,
  sessions: ExerciseSessionHistory[]
): ExerciseWeekMetrics {
  const start = Date.parse(weekStart);
  const end = start + 7 * 24 * 60 * 60 * 1000;
  const metrics: ExerciseWeekMetrics = {
    maxWeightKg: 0,
    maxReps: 0,
    estimatedOneRepMaxKg: 0,
    maxDurationSeconds: 0,
  };

  if (Number.isNaN(start)) return metrics;

  sessions.forEach((session) => {
    const sessionDate = Date.parse(session.date);
    if (Number.isNaN(sessionDate) || sessionDate < start || sessionDate >= end)
      return;

    session.sets?.forEach((set) => {
      const load = set.load_kg ?? 0;
      const reps = set.reps ?? 0;
      metrics.maxWeightKg = Math.max(metrics.maxWeightKg, load);
      metrics.maxReps = Math.max(metrics.maxReps, reps);
      metrics.maxDurationSeconds = Math.max(
        metrics.maxDurationSeconds,
        set.duration_seconds ?? 0
      );

      if (load > 0 && reps >= 1 && reps <= 10) {
        metrics.estimatedOneRepMaxKg = Math.max(
          metrics.estimatedOneRepMaxKg,
          load * (1 + reps / 30)
        );
      }
    });
  });

  return metrics;
}

const volumeWeekSchema = z.object({
  week_start: z.string(),
  volume_kg: z.number(),
  total_duration_seconds: z.number().nullable().optional(),
});

const exerciseDetailResponseSchema = z
  .object({
    exercise_type: z.enum(["weight", "time"]).default("weight"),
    records: exerciseDetailStatsSchema,
    volume_weeks: z.array(volumeWeekSchema),
    sessions: z.array(exerciseSessionHistorySchema),
  })
  .transform((data) => ({
    ...data,
    sessions: data.sessions.filter(
      (session) =>
        Array.isArray(session.sets) &&
        session.sets.some(
          (set) =>
            (set.load_kg != null && set.reps != null && set.reps > 0) ||
            (set.duration_seconds != null && set.duration_seconds > 0)
        )
    ),
  }));

export type ExerciseDetailResponse = z.infer<
  typeof exerciseDetailResponseSchema
>;

// -----------------------------------------------------------------------------
// Query Function
// -----------------------------------------------------------------------------

export async function fetchExerciseDetail(
  exerciseId: string
): Promise<ExerciseDetailResponse> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { data, error } = await supabase.rpc("get_exercise_detail", {
    p_exercise_id: exerciseId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return exerciseDetailResponseSchema.parse(data);
}
