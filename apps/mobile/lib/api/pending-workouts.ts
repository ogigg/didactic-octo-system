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
import { STALE_PENDING_WORKOUT_MS } from "@/lib/pending-workout-recovery";

export interface WorkoutGenerationErrorPayload {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  error_code?: unknown;
  request_id?: unknown;
  retryable?: unknown;
  used?: unknown;
  remaining?: unknown;
  tier?: unknown;
}

export class WorkoutGenerationError extends Error {
  readonly code: string;
  readonly error_code: string;
  readonly request_id: string | null;
  readonly retryable: boolean;

  constructor(payload: WorkoutGenerationErrorPayload, fallbackMessage: string) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : fallbackMessage;
    super(message);
    this.name = "WorkoutGenerationError";
    this.error_code =
      typeof payload.error_code === "string"
        ? payload.error_code
        : typeof payload.code === "string"
          ? payload.code
          : "generation_failed";
    this.code = this.error_code;
    this.request_id =
      typeof payload.request_id === "string" ? payload.request_id : null;
    this.retryable =
      typeof payload.retryable === "boolean" ? payload.retryable : true;
  }
}

export class GenerationLimitReachedError extends WorkoutGenerationError {
  readonly code = "generation_limit_reached" as const;
  readonly used: number;
  readonly remaining: number;
  readonly tier: string;

  constructor(
    payload: GenerationLimitError & {
      message?: string;
      request_id?: string | null;
    }
  ) {
    super(
      {
        error_code: "generation_limit_reached",
        message: payload.message ?? "Weekly generation limit reached",
        request_id: payload.request_id,
        retryable: false,
      },
      "Weekly generation limit reached"
    );
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
  status: z.enum(["queued", "generating", "regenerating", "ready", "failed"]),
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
  regeneration_feedback: z.array(z.record(z.unknown())).nullable().default([]),
  user_edits: z.record(z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// -----------------------------------------------------------------------------
// Auth Helper
// -----------------------------------------------------------------------------

function parseFunctionErrorPayload(
  value: unknown
): WorkoutGenerationErrorPayload {
  if (typeof value === "string") {
    try {
      return parseFunctionErrorPayload(JSON.parse(value));
    } catch {
      return { message: value };
    }
  }

  if (typeof value === "object" && value !== null) {
    return value as WorkoutGenerationErrorPayload;
  }

  return {};
}

async function readFunctionErrorPayload(
  data: unknown,
  error: unknown
): Promise<WorkoutGenerationErrorPayload> {
  if (data !== null && data !== undefined) {
    const parsedData = parseFunctionErrorPayload(data);
    if (Object.keys(parsedData).length > 0) return parsedData;
  }

  const context =
    typeof error === "object" && error !== null && "context" in error
      ? (error as { context?: { json?: () => Promise<unknown> } }).context
      : undefined;

  if (context?.json) {
    try {
      return parseFunctionErrorPayload(await context.json());
    } catch {
      // Keep the transport error below when a response body is unavailable.
    }
  }

  return {};
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "Workout generation failed";
}

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

async function queryPendingWorkouts(): Promise<PendingWorkout[]> {
  const { data, error } = await supabase
    .from("pending_workouts")
    .select("*")
    .order("queue_position", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(pendingWorkoutSchema).parse(data) as PendingWorkout[];
}

export async function recoverStaleGenerationAttempts(
  userId?: string
): Promise<number> {
  const authenticatedUserId = await getAuthenticatedUserId();
  const targetUserId = userId ?? authenticatedUserId;

  if (targetUserId !== authenticatedUserId) {
    throw new Error("Cannot recover another user's workouts");
  }

  const { data, error } = await supabase.rpc(
    "recover_stale_generation_attempts",
    { p_user_id: targetUserId }
  );

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data === "number") return Math.max(0, data);
  const row = Array.isArray(data) ? data[0] : data;
  if (typeof row === "number") return Math.max(0, row);
  if (typeof row === "object" && row !== null) {
    const count = Object.values(row).find((value) => typeof value === "number");
    return typeof count === "number" ? Math.max(0, count) : 0;
  }
  return 0;
}

export async function fetchPendingWorkouts(options?: {
  recoverStale?: boolean;
}): Promise<PendingWorkout[]> {
  const userId = await getAuthenticatedUserId();
  const workouts = await queryPendingWorkouts();

  if (
    options?.recoverStale !== false &&
    workouts.some(
      (workout) =>
        ["queued", "generating", "regenerating"].includes(workout.status) &&
        Date.now() - new Date(workout.updated_at).getTime() >
          STALE_PENDING_WORKOUT_MS
    )
  ) {
    try {
      await recoverStaleGenerationAttempts(userId);
      return queryPendingWorkouts();
    } catch {
      // A recovery RPC failure must not hide the queue the user already has.
    }
  }

  return workouts;
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
  request_id?: string;
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
    const body = await readFunctionErrorPayload(data, error);
    if (
      body.error === "generation_limit_reached" ||
      body.error_code === "generation_limit_reached"
    ) {
      throw new GenerationLimitReachedError({
        code: "generation_limit_reached",
        used: typeof body.used === "number" ? body.used : 5,
        remaining: typeof body.remaining === "number" ? body.remaining : 0,
        tier: typeof body.tier === "string" ? body.tier : "free",
        message: typeof body.message === "string" ? body.message : undefined,
        request_id:
          typeof body.request_id === "string" ? body.request_id : null,
      });
    }
    throw new WorkoutGenerationError(body, getErrorMessage(error));
  }
  if (!data?.success && !data?.skipped) {
    throw new Error("Workout preparation did not complete");
  }
}

export async function triggerRegeneration(
  pendingWorkoutId: string,
  preferences: WorkoutGenerationPreferences,
  timezoneOffsetMinutes: number,
  feedback?: string,
  requestId?: string
): Promise<z.infer<typeof generateWorkoutResponseSchema>> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: {
      pending_workout_id: pendingWorkoutId,
      request_id: requestId,
      training_split: preferences.training_split,
      duration_minutes: preferences.session_duration_minutes,
      equipment: preferences.equipment,
      training_style: preferences.training_style,
      difficulty: preferences.difficulty,
      custom_prompt: preferences.custom_prompt ?? undefined,
      timezone_offset_minutes: timezoneOffsetMinutes,
      regeneration_feedback: feedback,
    },
  });

  if (error) {
    const body = await readFunctionErrorPayload(data, error);
    if (
      body.error === "generation_limit_reached" ||
      body.error_code === "generation_limit_reached"
    ) {
      throw new GenerationLimitReachedError({
        code: "generation_limit_reached",
        used: typeof body.used === "number" ? body.used : 5,
        remaining: typeof body.remaining === "number" ? body.remaining : 0,
        tier: typeof body.tier === "string" ? body.tier : "free",
        message: typeof body.message === "string" ? body.message : undefined,
        request_id:
          typeof body.request_id === "string"
            ? body.request_id
            : (requestId ?? null),
      });
    }
    throw new WorkoutGenerationError(
      {
        ...body,
        request_id:
          typeof body.request_id === "string" ? body.request_id : requestId,
      },
      getErrorMessage(error)
    );
  }

  try {
    return generateWorkoutResponseSchema.parse(data);
  } catch (parseError) {
    const message =
      parseError instanceof Error
        ? parseError.message
        : "Invalid workout generation response";
    throw new WorkoutGenerationError(
      {
        error_code: "invalid_response",
        message,
        request_id: requestId,
        retryable: true,
      },
      "Invalid workout generation response"
    );
  }
}
