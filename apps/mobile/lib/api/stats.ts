import { z } from "zod";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Const Maps (no TS enums per project convention)
// -----------------------------------------------------------------------------

export const STATS_PERIODS = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: 0,
} as const;

export type StatsPeriod = keyof typeof STATS_PERIODS;

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const heatmapDaySchema = z.object({
  date: z.string(),
  volume_kg: z.number(),
  duration_minutes: z.number(),
});

export type HeatmapDay = z.infer<typeof heatmapDaySchema>;

export const volumeWeekSchema = z.object({
  week_start: z.string(),
  volume_kg: z.number(),
});

export type VolumeWeek = z.infer<typeof volumeWeekSchema>;

export const personalRecordSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  max_weight_kg: z.number(),
  max_weight_reps: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  max_reps: z.number(),
  max_reps_weight_kg: z
    .number()
    .nullable()
    .optional()
    .transform((value) => value ?? null),
  max_volume_set_kg: z.number(),
  est_1rm_kg: z.number().nullable(),
});

export type PersonalRecord = z.infer<typeof personalRecordSchema>;

export const muscleDistributionRowSchema = z.object({
  muscle: z.string(),
  set_count: z.number(),
});

export type MuscleDistributionRow = z.infer<typeof muscleDistributionRowSchema>;

// -----------------------------------------------------------------------------
// Auth Helper
// -----------------------------------------------------------------------------

async function getAuthenticatedUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error(error?.message ?? "Not authenticated");
  }

  return user.id;
}

// -----------------------------------------------------------------------------
// Query Functions
// -----------------------------------------------------------------------------

export async function fetchStatsHeatmap(): Promise<HeatmapDay[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_stats_heatmap", {});

  if (error) {
    throw new Error(error.message);
  }

  return z.array(heatmapDaySchema).parse(data);
}

export async function fetchStatsVolumeOverTime(
  fromDate: string
): Promise<VolumeWeek[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_stats_volume_over_time", {
    p_from_date: fromDate,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(volumeWeekSchema).parse(data);
}

export async function fetchStatsPersonalRecords(): Promise<PersonalRecord[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_stats_personal_records", {});

  if (error) {
    throw new Error(error.message);
  }

  return z.array(personalRecordSchema).parse(data);
}

export async function fetchStatsMuscleDistribution(
  fromDate: string
): Promise<MuscleDistributionRow[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_stats_muscle_distribution", {
    p_from_date: fromDate,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(muscleDistributionRowSchema).parse(data);
}
