import { z } from "zod";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Const Maps (no TS enums per project convention)
// -----------------------------------------------------------------------------

export const WORKOUT_STATUSES = {
  active: "active",
  completed: "completed",
  discarded: "discarded",
} as const;

export const SET_TYPES = {
  warmup: "warmup",
  working: "working",
} as const;

export const DIFFICULTY_FEEDBACKS = {
  too_easy: "too_easy",
  ok: "ok",
  too_hard: "too_hard",
} as const;

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const workoutSessionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().nullable(),
  status: z.enum(["active", "completed", "discarded"]),
  generation_source: z.enum([
    "llm",
    "fallback_template",
    "fallback_substitution",
  ]),
  goal_snapshot: z.enum([
    "build_strength",
    "lose_weight",
    "improve_fitness",
    "custom",
  ]),
  custom_goal_snapshot: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
});

export type WorkoutSession = z.infer<typeof workoutSessionSchema>;

const setLogDetailSchema = z
  .object({
    id: z.string().uuid(),
    actual_load_kg: z.number().nullable(),
    actual_reps: z.number().nullable(),
    rpe: z.number().nullable(),
    completed: z.boolean(),
    not_completed_reason: z.string().nullable(),
  })
  .nullable();

const setDetailSchema = z.object({
  id: z.string().uuid(),
  set_number: z.number(),
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number(),
  target_reps: z.number(),
  log: setLogDetailSchema,
});

const exerciseDetailSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  order_index: z.number(),
  rest_duration_seconds: z.number(),
  notes: z.string().nullable(),
  difficulty_feedback: z.enum(["too_easy", "ok", "too_hard"]).nullable(),
  sets: z.array(setDetailSchema),
});

export const workoutDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  status: z.enum(["active", "completed", "discarded"]),
  generation_source: z.enum([
    "llm",
    "fallback_template",
    "fallback_substitution",
  ]),
  goal_snapshot: z.enum([
    "build_strength",
    "lose_weight",
    "improve_fitness",
    "custom",
  ]),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  exercises: z.array(exerciseDetailSchema),
});

export type WorkoutDetail = z.infer<typeof workoutDetailSchema>;

// -----------------------------------------------------------------------------
// Input Types
// -----------------------------------------------------------------------------

export interface CreateWorkoutSessionInput {
  name?: string;
  generation_source?: "llm" | "fallback_template" | "fallback_substitution";
  goal_snapshot:
    | "build_strength"
    | "lose_weight"
    | "improve_fitness"
    | "custom";
  custom_goal_snapshot?: string;
  started_at?: string;
}

export interface SessionExerciseInput {
  id: string;
  exercise_id: string;
  order_index: number;
  rest_duration_seconds: number;
  notes?: string;
}

export interface SessionSetInput {
  id: string;
  set_number: number;
  set_type: "warmup" | "working";
  target_load_kg: number;
  target_reps: number;
}

export interface SetLogInput {
  actual_load_kg?: number;
  actual_reps?: number;
  rpe?: number;
  completed: boolean;
  not_completed_reason?: string;
}

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

export async function fetchWorkoutSessions(): Promise<WorkoutSession[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(workoutSessionSchema).parse(data);
}

export async function fetchWorkoutDetail(
  sessionId: string
): Promise<WorkoutDetail> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_workout_session_detail", {
    p_session_id: sessionId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return workoutDetailSchema.parse(data);
}

// -----------------------------------------------------------------------------
// Mutation Functions
// -----------------------------------------------------------------------------

export async function createWorkoutSession(
  input: CreateWorkoutSessionInput
): Promise<WorkoutSession> {
  const userId = await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: userId,
      name: input.name ?? null,
      generation_source: input.generation_source ?? "llm",
      goal_snapshot: input.goal_snapshot,
      custom_goal_snapshot: input.custom_goal_snapshot ?? null,
      started_at: input.started_at ?? new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return workoutSessionSchema.parse(data);
}

export async function updateWorkoutSession(
  sessionId: string,
  updates: Partial<{
    name: string;
    status: "active" | "completed" | "discarded";
    completed_at: string;
  }>
): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase
    .from("workout_sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertSessionExercises(
  sessionId: string,
  exercises: SessionExerciseInput[]
): Promise<void> {
  await getAuthenticatedUserId();

  const rows = exercises.map((ex) => ({
    id: ex.id,
    workout_session_id: sessionId,
    exercise_id: ex.exercise_id,
    order_index: ex.order_index,
    rest_duration_seconds: ex.rest_duration_seconds,
    notes: ex.notes ?? null,
  }));

  const { error } = await supabase
    .from("session_exercises")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertSessionSets(
  sessionExerciseId: string,
  sets: SessionSetInput[]
): Promise<void> {
  await getAuthenticatedUserId();

  const rows = sets.map((s) => ({
    id: s.id,
    session_exercise_id: sessionExerciseId,
    set_number: s.set_number,
    set_type: s.set_type,
    target_load_kg: s.target_load_kg,
    target_reps: s.target_reps,
  }));

  const { error } = await supabase
    .from("session_sets")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertSetLog(
  sessionSetId: string,
  log: SetLogInput
): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase.from("set_logs").upsert(
    {
      session_set_id: sessionSetId,
      actual_load_kg: log.actual_load_kg ?? null,
      actual_reps: log.actual_reps ?? null,
      rpe: log.rpe ?? null,
      completed: log.completed,
      not_completed_reason: log.not_completed_reason ?? null,
    },
    { onConflict: "session_set_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}
