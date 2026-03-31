import { z } from "zod";

import { generateWorkoutResponseSchema } from "@/lib/api/generate-workout";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type PendingWorkoutStatus = "queued" | "generating" | "ready" | "failed";
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
  user_edits: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const pendingWorkoutSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  queue_position: z.number(),
  status: z.enum(["queued", "generating", "ready", "failed"]),
  workout_data: generateWorkoutResponseSchema.nullable(),
  generation_source: z
    .enum(["llm", "fallback_template", "fallback_substitution"])
    .nullable(),
  focus_area: z
    .enum(["push", "pull", "legs", "upper", "lower", "full_body"])
    .nullable(),
  generated_at: z.string().nullable(),
  last_regenerated_at: z.string().nullable(),
  regeneration_count: z.number(),
  user_edits: z.record(z.unknown()).nullable(),
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

  return z.array(pendingWorkoutSchema).parse(data) as PendingWorkout[];
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
  preferences: {
    training_split: string;
    session_duration_minutes: number;
    equipment: string;
    training_style: string;
    difficulty: string;
  };
  baselines: { exercise_key: string; load_kg: number | null; reps: number }[];
  trigger: "onboarding" | "preference_change";
}

export async function triggerQueueGeneration(
  request: QueueGenerationRequest
): Promise<void> {
  const { error } = await supabase.functions.invoke("generate-workout-queue", {
    body: request,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function triggerRegeneration(
  pendingWorkoutId: string
): Promise<z.infer<typeof generateWorkoutResponseSchema>> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: { pending_workout_id: pendingWorkoutId },
  });

  if (error) {
    throw new Error(error.message);
  }

  return generateWorkoutResponseSchema.parse(data);
}
