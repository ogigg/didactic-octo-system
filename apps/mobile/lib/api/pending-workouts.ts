import { z } from "zod";

import type {
  Difficulty,
  DurationMinutes,
  Equipment,
  TrainingSplit,
  TrainingStyle,
} from "@/lib/api/generate-workout";
import { generateWorkoutResponseSchema } from "@/lib/api/generate-workout";
import { supabase } from "@/lib/supabase";
import type { GenerationLimitError } from "@/lib/api/subscription";

export class GenerationLimitReachedError extends Error {
  readonly code = "generation_limit_reached" as const;
  readonly used: number;
  readonly remaining: number;
  readonly tier: string;

  constructor(payload: GenerationLimitError) {
    super("Weekly generation limit reached");
    this.name = "GenerationLimitReachedError";
    this.used = payload.used;
    this.remaining = payload.remaining;
    this.tier = payload.tier;
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PendingWorkoutStatus =
  | "queued"
  | "generating"
  | "regenerating"
  | "ready"
  | "failed";
export type FocusArea =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body";

export interface PendingWorkout {
  id: string;
  user_id: string;
  queue_position: number;
  status: PendingWorkoutStatus;
  workout_data: z.infer<typeof generateWorkoutResponseSchema> | null;
  generation_source:
    | "llm"
    | "fallback_template"
    | "fallback_substitution"
    | null;
  focus_area: FocusArea | null;
  generated_at: string | null;
  last_regenerated_at: string | null;
  regeneration_count: number;
  regeneration_feedback: Record<string, unknown>[] | null;
  user_edits: Record<string, unknown> | null;
  generation_version: number;
  workout_data_corrupt?: boolean;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const pendingWorkoutRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  queue_position: z.number(),
  status: z.enum(["queued", "generating", "regenerating", "ready", "failed"]),
  workout_data: z.unknown().nullable(),
  generation_source: z
    .enum(["llm", "fallback_template", "fallback_substitution"])
    .nullable(),
  focus_area: z
    .enum(["push", "pull", "legs", "upper", "lower", "full_body"])
    .nullable(),
  generated_at: z.string().nullable(),
  last_regenerated_at: z.string().nullable(),
  regeneration_count: z.number(),
  regeneration_feedback: z.array(z.record(z.unknown())).nullable().default([]),
  user_edits: z.record(z.unknown()).nullable(),
  generation_version: z.number().int().nonnegative().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

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

export async function fetchPendingWorkouts(): Promise<PendingWorkout[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("pending_workouts")
    .select("*")
    .order("queue_position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return parsePendingWorkoutRows(data);
}

export function parsePendingWorkoutRows(data: unknown): PendingWorkout[] {
  return z
    .array(pendingWorkoutRowSchema)
    .parse(data)
    .map((row) => {
      const parsedWorkout = generateWorkoutResponseSchema.safeParse(
        row.workout_data
      );
      const workoutData =
        row.workout_data !== null && parsedWorkout.success
          ? parsedWorkout.data
          : null;

      return {
        ...row,
        workout_data: workoutData,
        workout_data_corrupt:
          row.status === "ready" &&
          (row.workout_data === null || !parsedWorkout.success),
      };
    });
}

// -----------------------------------------------------------------------------
// Mutation Functions
// -----------------------------------------------------------------------------

export async function updatePendingWorkoutEdits(
  id: string,
  edits: Record<string, unknown>
): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase
    .from("pending_workouts")
    .update({ user_edits: edits })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deletePendingWorkout(id: string): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase
    .from("pending_workouts")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAllPendingWorkouts(): Promise<void> {
  const userId = await getAuthenticatedUserId();

  const { error } = await supabase
    .from("pending_workouts")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export interface QueueGenerationRequest {
  count: number;
  preferences: WorkoutGenerationPreferences;
  baselines: { exercise_key: string; load_kg: number | null; reps: number }[];
  trigger: "onboarding" | "preference_change";
}

export interface WorkoutGenerationPreferences {
  training_split: TrainingSplit;
  session_duration_minutes: DurationMinutes;
  equipment: Equipment;
  training_style: TrainingStyle;
  difficulty: Difficulty;
  custom_prompt?: string | null;
}

export async function triggerQueueGeneration(
  request: QueueGenerationRequest
): Promise<void> {
  const { data, error } = await supabase.functions.invoke(
    "generate-workout-queue",
    { body: request }
  );

  if (error) {
    const body = data as {
      error?: string;
      used?: number;
      remaining?: number;
      tier?: string;
    } | null;
    if (body?.error === "generation_limit_reached") {
      throw new GenerationLimitReachedError({
        code: "generation_limit_reached",
        used: body.used ?? 5,
        remaining: body.remaining ?? 0,
        tier: body.tier ?? "free",
      });
    }
    throw new Error(error.message);
  }
}

export async function triggerRegeneration(
  pendingWorkoutId: string,
  preferences: WorkoutGenerationPreferences,
  timezoneOffsetMinutes: number,
  feedback?: string,
  claim?: PendingWorkoutGenerationClaim
): Promise<z.infer<typeof generateWorkoutResponseSchema>> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: {
      pending_workout_id: pendingWorkoutId,
      training_split: preferences.training_split,
      duration_minutes: preferences.session_duration_minutes,
      equipment: preferences.equipment,
      training_style: preferences.training_style,
      difficulty: preferences.difficulty,
      custom_prompt: preferences.custom_prompt ?? undefined,
      timezone_offset_minutes: timezoneOffsetMinutes,
      regeneration_feedback: feedback,
      pending_workout_claim_token: claim?.claimToken,
      pending_workout_generation_version: claim?.generationVersion,
    },
  });

  if (error) {
    const body = data as {
      error?: string;
      used?: number;
      remaining?: number;
      tier?: string;
    } | null;
    if (body?.error === "generation_limit_reached") {
      throw new GenerationLimitReachedError({
        code: "generation_limit_reached",
        used: body.used ?? 5,
        remaining: body.remaining ?? 0,
        tier: body.tier ?? "free",
      });
    }
    throw new Error(error.message);
  }

  return generateWorkoutResponseSchema.parse(data);
}

export interface PendingWorkoutGenerationClaim {
  claimToken: string;
  generationVersion: number;
}

const pendingWorkoutGenerationClaimSchema = z.object({
  claim_token: z.string().uuid(),
  generation_version: z.number().int().positive(),
});

export async function claimPendingWorkoutRecovery(
  workout: PendingWorkout
): Promise<PendingWorkoutGenerationClaim> {
  const { data, error } = await supabase.rpc(
    "claim_pending_workout_generation",
    {
      p_pending_workout_id: workout.id,
      p_expected_version: workout.generation_version,
      p_claim_reason: "recovery",
      p_allow_corrupt_ready: workout.workout_data_corrupt === true,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const parsed = z.array(pendingWorkoutGenerationClaimSchema).safeParse(data);
  if (!parsed.success || parsed.data.length !== 1) {
    throw new Error("Pending workout recovery claim was not accepted");
  }

  return {
    claimToken: parsed.data[0].claim_token,
    generationVersion: parsed.data[0].generation_version,
  };
}

export async function replacePendingWorkoutWithFallback(
  id: string,
  expectedVersion: number,
  fallbackWorkout: z.infer<typeof generateWorkoutResponseSchema>
): Promise<void> {
  const { data, error } = await supabase.rpc(
    "replace_pending_workout_with_fallback",
    {
      p_pending_workout_id: id,
      p_expected_version: expectedVersion,
      p_workout_data: fallbackWorkout,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (data !== true) {
    throw new Error("Pending workout changed before fallback was applied");
  }
}
