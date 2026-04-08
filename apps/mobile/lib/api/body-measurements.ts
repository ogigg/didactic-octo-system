import { z } from "zod";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Measurement Field Types
// -----------------------------------------------------------------------------

export const MEASUREMENT_FIELDS = [
  "weight_kg",
  "body_fat_pct",
  "muscle_mass_kg",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "neck_cm",
  "shoulders_cm",
  "biceps_left_cm",
  "biceps_right_cm",
  "forearm_left_cm",
  "forearm_right_cm",
  "thigh_left_cm",
  "thigh_right_cm",
  "calf_left_cm",
  "calf_right_cm",
] as const;

export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const measurementTrendPointSchema = z.object({
  date: z.string(),
  value: z.number(),
});

export type MeasurementTrendPoint = z.infer<typeof measurementTrendPointSchema>;

export const latestMeasurementsSchema = z.object({
  weight_kg: z.number().nullable().default(null),
  body_fat_pct: z.number().nullable().default(null),
  muscle_mass_kg: z.number().nullable().default(null),
  chest_cm: z.number().nullable().default(null),
  waist_cm: z.number().nullable().default(null),
  hips_cm: z.number().nullable().default(null),
  neck_cm: z.number().nullable().default(null),
  shoulders_cm: z.number().nullable().default(null),
  biceps_left_cm: z.number().nullable().default(null),
  biceps_right_cm: z.number().nullable().default(null),
  forearm_left_cm: z.number().nullable().default(null),
  forearm_right_cm: z.number().nullable().default(null),
  thigh_left_cm: z.number().nullable().default(null),
  thigh_right_cm: z.number().nullable().default(null),
  calf_left_cm: z.number().nullable().default(null),
  calf_right_cm: z.number().nullable().default(null),
  logged_at: z.string().nullable().default(null),
});

export type LatestMeasurements = z.infer<typeof latestMeasurementsSchema>;

export interface MeasurementInput {
  [key: string]: number | undefined;
}

// -----------------------------------------------------------------------------
// Period Helpers
// -----------------------------------------------------------------------------

export const STATS_PERIODS = {
  "30d": 30,
  "90d": 90,
  "1y": 365,
  all: 0,
} as const;

export type StatsPeriod = keyof typeof STATS_PERIODS;

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

export async function fetchMeasurementTrend(
  field: MeasurementField,
  fromDate: string | null
): Promise<MeasurementTrendPoint[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_measurement_trend", {
    p_field: field,
    p_from_date: fromDate,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(measurementTrendPointSchema).parse(data);
}

export async function fetchLatestMeasurements(): Promise<LatestMeasurements> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_latest_measurements", {});

  if (error) {
    throw new Error(error.message);
  }

  return latestMeasurementsSchema.parse(data);
}

// -----------------------------------------------------------------------------
// Mutation Functions
// -----------------------------------------------------------------------------

export async function upsertMeasurement(
  loggedAt: string,
  fields: MeasurementInput
): Promise<void> {
  const userId = await getAuthenticatedUserId();

  // Filter out undefined values, keep only defined numbers
  const cleanFields: Record<string, number> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      cleanFields[key] = value;
    }
  }

  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: userId,
      logged_at: loggedAt,
      ...cleanFields,
    },
    { onConflict: "user_id,logged_at" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
