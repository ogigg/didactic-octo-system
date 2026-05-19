import { z } from "zod";

import { supabase } from "@/lib/supabase";
import {
  formatPreviousDurationSet,
  formatPreviousWeightSet,
  type PreviousSetValue,
} from "@/lib/workout-previous-sets";
import type { WeightUnit } from "@/lib/unit-conversion";

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
    actual_duration_seconds: z.number().nullable().optional(),
    rpe: z.number().nullable(),
    completed: z.boolean(),
    not_completed_reason: z.string().nullable(),
  })
  .nullable();

const setDetailSchema = z.object({
  id: z.string().uuid(),
  set_number: z.number(),
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().nullable().optional(),
  target_reps: z.number().nullable().optional(),
  target_duration_seconds: z.number().nullable().optional(),
  log: setLogDetailSchema,
});

const exerciseDetailSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  exercise_type: z.enum(["weight", "time"]).default("weight"),
  primary_muscles: z.array(z.string()),
  order_index: z.number(),
  rest_duration_seconds: z.number(),
  notes: z.string().nullable(),
  difficulty_feedback: z.enum(["too_easy", "ok", "too_hard"]).nullable(),
  sets: z.array(setDetailSchema),
});

export const workoutHistoryItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  exercise_count: z.number(),
  total_sets: z.number(),
  total_volume_kg: z.number(),
  exercise_ids: z.array(z.string().uuid()).default([]),
  exercise_names: z.array(z.string()),
});

export type WorkoutHistoryItem = z.infer<typeof workoutHistoryItemSchema>;

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

const previousSetLogSchema = z.preprocess(
  (value) => (Array.isArray(value) ? (value[0] ?? null) : value),
  z
    .object({
      actual_load_kg: z.number().nullable(),
      actual_reps: z.number().nullable(),
      actual_duration_seconds: z.number().nullable().optional(),
      completed: z.boolean(),
    })
    .nullable()
);

const previousSessionSetSchema = z.object({
  set_number: z.number(),
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().nullable().optional(),
  target_reps: z.number().nullable().optional(),
  target_duration_seconds: z.number().nullable().optional(),
  log: previousSetLogSchema,
});

const previousSessionExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise: z.object({
    exercise_type: z.enum(["weight", "time"]).default("weight"),
  }),
  workout_session: z.object({
    completed_at: z.string().nullable(),
  }),
  sets: z.array(previousSessionSetSchema),
});

type PreviousSessionExercise = z.infer<typeof previousSessionExerciseSchema>;

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
  difficulty_feedback?: "too_easy" | "ok" | "too_hard" | null;
}

export interface SessionSetInput {
  id: string;
  set_number: number;
  set_type: "warmup" | "working";
  target_load_kg?: number;
  target_reps?: number;
  target_duration_seconds?: number;
}

export interface SetLogInput {
  actual_load_kg?: number;
  actual_reps?: number;
  actual_duration_seconds?: number;
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

export async function fetchWorkoutHistoryPage(
  limit: number,
  cursor?: string
): Promise<WorkoutHistoryItem[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc("get_workout_history_page", {
    p_limit: limit,
    p_cursor: cursor ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(workoutHistoryItemSchema).parse(data);
}

export async function fetchWorkoutHistoryForDayRange(
  startIso: string,
  endIso: string
): Promise<WorkoutHistoryItem[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase.rpc(
    "get_workout_history_for_day_range",
    {
      p_start: startIso,
      p_end: endIso,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return z.array(workoutHistoryItemSchema).parse(data);
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

export async function fetchPreviousSetDisplays(
  exerciseIds: string[],
  weightUnit: WeightUnit
): Promise<Record<string, PreviousSetValue[]>> {
  await getAuthenticatedUserId();

  const uniqueExerciseIds = Array.from(new Set(exerciseIds));
  if (uniqueExerciseIds.length === 0) return {};

  const { data, error } = await supabase
    .from("session_exercises")
    .select(
      `
      exercise_id,
      exercise:exercises!inner(exercise_type),
      workout_session:workout_sessions!inner(completed_at),
      sets:session_sets(
        set_number,
        set_type,
        target_load_kg,
        target_reps,
        target_duration_seconds,
        log:set_logs(
          actual_load_kg,
          actual_reps,
          actual_duration_seconds,
          completed
        )
      )
    `
    )
    .in("exercise_id", uniqueExerciseIds)
    .eq("workout_session.status", "completed")
    .not("workout_session.completed_at", "is", null)
    .order("completed_at", {
      referencedTable: "workout_sessions",
      ascending: false,
    })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = z.array(previousSessionExerciseSchema).parse(data ?? []);
  const latestByExercise = new Map<string, PreviousSessionExercise>();

  for (const row of rows) {
    if (!latestByExercise.has(row.exercise_id)) {
      latestByExercise.set(row.exercise_id, row);
    }
  }

  return Object.fromEntries(
    Array.from(latestByExercise.entries()).map(([exerciseId, row]) => [
      exerciseId,
      mapPreviousSets(row, weightUnit),
    ])
  );
}

export interface CalendarSessionRow {
  id: string;
  name: string | null;
  completed_at: string;
}

export async function fetchCalendarEntries(
  fromIso: string,
  toIso: string
): Promise<CalendarSessionRow[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("id, name, completed_at")
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .gte("completed_at", fromIso)
    .lte("completed_at", toIso)
    .order("completed_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CalendarSessionRow[];
}

function mapPreviousSets(
  row: PreviousSessionExercise,
  weightUnit: WeightUnit
): PreviousSetValue[] {
  const exerciseType = row.exercise.exercise_type;

  return row.sets
    .filter((set) => set.set_type === "working")
    .sort((a, b) => a.set_number - b.set_number)
    .map((set) => {
      const display =
        exerciseType === "time"
          ? formatPreviousDurationSet(
              set.log?.completed
                ? set.log.actual_duration_seconds
                : set.target_duration_seconds
            )
          : formatPreviousWeightSet(
              set.log?.completed ? set.log.actual_load_kg : set.target_load_kg,
              set.log?.completed ? set.log.actual_reps : set.target_reps,
              weightUnit
            );

      return display
        ? {
            setNumber: set.set_number,
            display,
          }
        : null;
    })
    .filter((set): set is PreviousSetValue => set !== null);
}

export interface SessionDurationRow {
  started_at: string;
  completed_at: string;
}

export async function fetchWeeklyDurations(
  fromIso: string
): Promise<SessionDurationRow[]> {
  await getAuthenticatedUserId();

  const { data, error } = await supabase
    .from("workout_sessions")
    .select("started_at, completed_at")
    .eq("status", "completed")
    .not("started_at", "is", null)
    .not("completed_at", "is", null)
    .gte("completed_at", fromIso)
    .order("completed_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as SessionDurationRow[];
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
    health_record_id: string | null;
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
    difficulty_feedback: ex.difficulty_feedback ?? null,
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
    target_load_kg: s.target_load_kg ?? null,
    target_reps: s.target_reps ?? null,
    target_duration_seconds: s.target_duration_seconds ?? null,
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
      actual_duration_seconds: log.actual_duration_seconds ?? null,
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

export async function updateExerciseDifficultyFeedback(
  sessionExerciseId: string,
  feedback: "too_easy" | "ok" | "too_hard"
): Promise<void> {
  await getAuthenticatedUserId();

  const { error } = await supabase
    .from("session_exercises")
    .update({ difficulty_feedback: feedback })
    .eq("id", sessionExerciseId);

  if (error) {
    throw new Error(error.message);
  }
}
