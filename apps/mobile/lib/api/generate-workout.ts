import { supabase } from "@/lib/supabase";
import { exerciseImageSchema } from "@/lib/exercise-media";
import { z } from "zod";

export type TrainingSplit = "full_body" | "upper_lower" | "push_pull_legs";

export type DurationMinutes = 15 | 30 | 45 | 60 | 90;
export type Equipment = "bodyweight" | "dumbbells" | "barbell" | "full_gym";
export type TrainingStyle =
  | "strength"
  | "hypertrophy"
  | "endurance"
  | "circuit";
export type Difficulty = "beginner" | "intermediate" | "advanced";

export interface GenerateWorkoutRequest {
  training_split: TrainingSplit;
  duration_minutes: DurationMinutes;
  equipment: Equipment;
  training_style: TrainingStyle;
  difficulty: Difficulty;
  custom_prompt?: string;
}

const generatedSetSchema = z.object({
  set_type: z.enum(["warmup", "working"]),
  target_load_kg: z.number().optional(),
  target_reps: z.number().optional(),
  target_duration_seconds: z.number().optional(),
});

const generatedWarmupSchema = z.object({
  duration_seconds: z.number().int().positive(),
});

export const progressionTypeSchema = z.enum([
  "weight_up",
  "reps_up",
  "maintained",
  "new_exercise",
]);

export type ProgressionType = z.infer<typeof progressionTypeSchema>;

const generatedExerciseSchema = z.object({
  exercise_id: z.string(),
  exercise_name: z.string(),
  exercise_type: z.enum(["weight", "time"]).default("weight"),
  image: exerciseImageSchema.default(null).optional(),
  rest_duration_seconds: z.number(),
  notes: z.string().nullable(),
  sets: z.array(generatedSetSchema),
  progression_type: progressionTypeSchema.nullable().optional(),
  previous_display: z.string().nullable().optional(),
});

export const generateWorkoutResponseSchema = z.object({
  workout_name: z.string(),
  warmup: generatedWarmupSchema.nullable().default(null),
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

export async function generateWorkout(
  request: GenerateWorkoutRequest
): Promise<GenerateWorkoutResponse> {
  const { data, error } = await supabase.functions.invoke("generate-workout", {
    body: request,
  });

  if (error) throw new Error(error.message);
  return generateWorkoutResponseSchema.parse(data);
}
