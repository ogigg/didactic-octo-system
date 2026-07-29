import { z } from "zod";

const primitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const eventValueSchema = z.union([primitiveSchema, z.array(primitiveSchema)]);
const exploratoryPayloadSchema = z.record(eventValueSchema);

const generationSourceSchema = z.enum([
  "llm",
  "fallback_template",
  "fallback_substitution",
]);

const streakPayloadSchema = z
  .object({
    tier: z.string().min(1),
    is_pro_active: z.boolean(),
    streak_weeks: z.number().int().nonnegative(),
    missed_weeks: z.number().int().nonnegative(),
    days_since_last_workout: z.number().int().nonnegative().nullable(),
    prompt_state: z.string().min(1),
    pro_freezes_available: z.number().int().nonnegative(),
    earned_freezes_available: z.number().int().nonnegative(),
    lifetime_rescue_available: z.boolean(),
    auto_apply_enabled: z.boolean(),
  })
  .catchall(eventValueSchema);

const workoutSharePayloadSchema = z
  .object({
    exercise_count: z.number().int().nonnegative(),
    completed_sets: z.number().int().nonnegative(),
    total_sets: z.number().int().nonnegative(),
    completion_rate: z.number().min(0).max(100),
    total_volume_kg: z.number().nonnegative(),
    duration_seconds: z.number().int().nonnegative(),
    highlight_count: z.number().int().nonnegative(),
  })
  .catchall(eventValueSchema);

/**
 * Current event schema contract.
 *
 * The separate journey manifest records which operational stages exist and
 * whether the canonical eight-stage dependency is ready.
 */
export const analyticsEventSchemas = {
  onboarding_step_completed: z
    .object({
      step: z.string().min(1),
      skipped: z.boolean(),
    })
    .catchall(eventValueSchema),
  onboarding_completed: z
    .object({
      occurrence_id: z.string().min(1),
    })
    .catchall(eventValueSchema),
  strength_baseline_entered: z
    .object({
      exercise_key: z.string().min(1),
      has_load: z.boolean(),
      source: z.enum(["onboarding", "settings"]),
    })
    .catchall(eventValueSchema),
  workout_generated: z
    .object({
      generation_source: generationSourceSchema,
      training_split: z.string().min(1),
      duration_minutes: z.number().positive(),
      equipment: z.string().min(1),
      training_style: z.string().min(1),
      difficulty: z.string().min(1),
      exercise_count: z.number().int().positive(),
      has_custom_prompt: z.boolean(),
      occurrence_id: z.string().min(1),
    })
    .catchall(eventValueSchema),
  workout_queue_initialized: z
    .object({
      count: z.number().int().positive(),
      trigger: z.string().min(1),
    })
    .catchall(eventValueSchema),
  workout_queue_ready: z
    .object({
      total_generation_time_ms: z.number().nonnegative().nullable(),
      count: z.number().int().positive(),
      fallback_count: z.number().int().nonnegative(),
    })
    .catchall(eventValueSchema),
  pending_workout_generated: z
    .object({
      generation_source: generationSourceSchema.nullable(),
      trigger: z.string().min(1),
      generation_time_ms: z.number().nonnegative().nullable(),
      queue_position: z.number().int().nonnegative(),
      focus_area: z.string().min(1).nullable(),
    })
    .catchall(eventValueSchema),
  pending_workout_started: z
    .object({
      time_since_generated_ms: z.number().nonnegative().nullable(),
      was_edited: z.boolean(),
      edit_count: z.number().int().nonnegative(),
      occurrence_id: z.string().min(1),
    })
    .catchall(eventValueSchema),
  pending_workout_regenerated: z
    .object({
      phase: z.enum(["started", "completed"]),
      queue_position: z.number().int().nonnegative(),
      focus_area: z.string().min(1).nullable(),
      previous_generation_source: generationSourceSchema.nullable(),
      has_feedback: z.boolean(),
      feedback_length: z.number().int().nonnegative(),
    })
    .catchall(eventValueSchema),
  pending_workout_edited: z
    .object({
      edit_type: z.string().min(1),
    })
    .catchall(eventValueSchema),
  workout_preview_viewed: z
    .object({
      queue_position: z.number().int().nonnegative(),
      time_on_screen_ms: z.number().nonnegative(),
    })
    .catchall(eventValueSchema),
  workout_completed: z
    .object({
      workout_name: z.string().min(1),
      exercise_count: z.number().int().nonnegative(),
      total_sets: z.number().int().nonnegative(),
      completed_sets: z.number().int().nonnegative(),
      completion_rate: z.number().min(0).max(100),
      total_volume_kg: z.number().nonnegative(),
      duration_seconds: z.number().int().nonnegative(),
      goal_snapshot: z.string().min(1),
      custom_goal_snapshot: z.string().nullable(),
      occurrence_id: z.string().min(1),
    })
    .catchall(eventValueSchema),
  session_duration: z
    .object({
      workout_name: z.string().min(1),
      duration_seconds: z.number().int().nonnegative(),
      exercise_count: z.number().int().nonnegative(),
      completion_rate: z.number().min(0).max(100),
    })
    .catchall(eventValueSchema),
  feedback_given: z
    .object({
      exercise_id: z.string().min(1),
      difficulty: z.enum(["too_easy", "ok", "too_hard"]),
      session_id: z.string().min(1),
    })
    .catchall(eventValueSchema),
  difficulty_feedback_given: z
    .object({
      exercise_id: z.string().min(1),
      exercise_name: z.string().min(1),
      feedback: z.string().min(1),
    })
    .catchall(eventValueSchema),
  workout_comment_submitted: z
    .object({
      session_id: z.string().min(1),
      length: z.number().int().positive(),
      chip_count: z.number().int().nonnegative(),
      has_freeform: z.boolean(),
    })
    .catchall(eventValueSchema),
  workout_summary_share_requested: workoutSharePayloadSchema,
  workout_summary_share_unavailable: workoutSharePayloadSchema,
  workout_summary_share_completed: workoutSharePayloadSchema,
  workout_summary_share_failed: workoutSharePayloadSchema.extend({
    error: z.string().min(1),
  }),
  training_preferences_changed: z
    .object({
      changed_fields: z.array(z.string().min(1)),
      triggered_queue_rebuild: z.boolean(),
    })
    .catchall(eventValueSchema),
  queue_state_on_open: z
    .object({
      ready_count: z.number().int().nonnegative(),
      generating_count: z.number().int().nonnegative(),
      total_count: z.number().int().nonnegative(),
      has_active_workout: z.boolean(),
    })
    .catchall(eventValueSchema),
  streak_status_viewed: streakPayloadSchema,
  streak_prompt_shown: streakPayloadSchema,
  streak_prompt_dismissed: streakPayloadSchema,
  streak_protection_applied: streakPayloadSchema.extend({
    protection_type: z.enum(["lifetime_rescue", "earned_freeze", "pro_freeze"]),
  }),
  streak_lifetime_rescue_used: streakPayloadSchema,
  streak_freeze_earned: streakPayloadSchema,
  streak_restarted: streakPayloadSchema,
  comeback_workout_started: streakPayloadSchema,
  comeback_workout_completed: exploratoryPayloadSchema,
  streak_upgrade_tapped: streakPayloadSchema,
} satisfies Record<string, z.ZodTypeAny>;

export type EventName = keyof typeof analyticsEventSchemas;
export type EventPayload<Name extends EventName> = z.input<
  (typeof analyticsEventSchemas)[Name]
>;

export const operationalJourneyEvents = [
  "onboarding_completed",
  "workout_generated",
  "pending_workout_started",
  "workout_completed",
] as const satisfies readonly EventName[];

export const operationalJourneyEventSet = new Set<EventName>(
  operationalJourneyEvents
);

export function validateEventPayload(
  name: EventName,
  payload: Record<string, unknown>
): z.SafeParseReturnType<unknown, unknown> {
  return analyticsEventSchemas[name].safeParse(payload);
}
