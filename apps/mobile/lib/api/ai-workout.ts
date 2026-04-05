import { z } from "zod";

import type { WorkoutExercise, WorkoutSet } from "@/stores/workout-store";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Const Maps
// -----------------------------------------------------------------------------

export const FOCUS_AREAS = {
  push: "push",
  pull: "pull",
  legs: "legs",
  upper: "upper",
  lower: "lower",
  full_body: "full_body",
} as const;

export type FocusArea = (typeof FOCUS_AREAS)[keyof typeof FOCUS_AREAS];

export const DURATIONS = {
  30: 30,
  45: 45,
  60: 60,
} as const;

export type Duration = (typeof DURATIONS)[keyof typeof DURATIONS];

// -----------------------------------------------------------------------------
// Request
// -----------------------------------------------------------------------------

export interface GenerateWorkoutRequest {
  focus_area: FocusArea;
  duration_minutes: Duration;
}

// -----------------------------------------------------------------------------
// Response Schema
// -----------------------------------------------------------------------------

const generatedSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().min(0),
  target_reps: z.number().int().min(1),
});

const progressionTypeSchema = z.enum([
  "weight_up",
  "reps_up",
  "maintained",
  "new_exercise",
]);

const generatedExerciseSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  sets: z.array(generatedSetSchema).min(1),
  rest_duration_seconds: z.number().int().min(15).max(300),
  notes: z.string().nullable(),
  progression_type: progressionTypeSchema.nullable().optional(),
  previous_display: z.string().nullable().optional(),
});

export const generateWorkoutResponseSchema = z.object({
  workout_name: z.string(),
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
  exercises: z.array(generatedExerciseSchema),
});

export type GenerateWorkoutResponse = z.infer<
  typeof generateWorkoutResponseSchema
>;

export type GeneratedExercise = z.infer<typeof generatedExerciseSchema>;

// -----------------------------------------------------------------------------
// API Call
// -----------------------------------------------------------------------------

export async function generateWorkout(
  request: GenerateWorkoutRequest
): Promise<GenerateWorkoutResponse> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: request,
  });

  if (error) {
    throw new Error(error.message ?? "Failed to generate workout");
  }

  if (data?.error) {
    if (data.retry_after) {
      throw new RateLimitError(data.error, data.retry_after);
    }
    throw new Error(data.error);
  }

  return generateWorkoutResponseSchema.parse(data);
}

// -----------------------------------------------------------------------------
// Rate Limit Error
// -----------------------------------------------------------------------------

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
  }
}

// -----------------------------------------------------------------------------
// Mapper: Generated → WorkoutExercise (store format)
// -----------------------------------------------------------------------------

export function mapGeneratedToWorkoutExercises(
  exercises: GeneratedExercise[]
): WorkoutExercise[] {
  const now = Date.now();

  return exercises.map((ex) => ({
    id: ex.exercise_id,
    name: ex.exercise_name,
    restDurationSeconds: ex.rest_duration_seconds,
    notes: ex.notes ?? "",
    progressionType: ex.progression_type ?? null,
    sets: ex.sets.map(
      (set, i): WorkoutSet => ({
        id: `set-${ex.exercise_id}-${i}-${now}`,
        type: set.set_type,
        kg: String(set.target_load_kg),
        reps: String(set.target_reps),
        rpe: null,
        isCompleted: false,
        previousDisplay:
          set.set_type === "working" ? (ex.previous_display ?? null) : null,
      })
    ),
  }));
}
