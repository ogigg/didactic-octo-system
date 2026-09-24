import { z } from "npm:zod@3";
import type { ExerciseCatalogEntry } from "./generator.ts";

export const MODEL_REQUEST_VERSION = "compact-v1";
export const MODEL_MAX_TOKENS = 3200;

// The wire format carries one prescription, not a copy for every working set.
export const compactWorkoutSchema = z
  .object({
    workout_name: z.string().min(1).max(100),
    training_strategy: z.string().min(1).max(240),
    exercises: z
      .array(
        z
          .object({
            exercise_id: z.string().uuid(),
            working_sets: z.number().int().min(1).max(5),
            load_kg: z.number().min(0).max(500).nullable(),
            reps: z.number().int().min(1).max(100).nullable(),
            duration_seconds: z.number().int().min(5).max(600).nullable(),
            rest_seconds: z.number().int().min(15).max(300),
            rationale: z.string().min(1).max(160),
            notes: z.string().max(160).nullable(),
          })
          .strict()
      )
      .min(1)
      .max(12),
  })
  .strict();

export function workoutResponseFormat(ids: string[], min: number, max: number) {
  const properties = {
    exercise_id: { type: "string", enum: ids },
    working_sets: { type: "integer", minimum: 1, maximum: 5 },
    load_kg: { type: ["number", "null"], minimum: 0, maximum: 500 },
    reps: { type: ["integer", "null"], minimum: 1, maximum: 100 },
    duration_seconds: { type: ["integer", "null"], minimum: 5, maximum: 600 },
    rest_seconds: { type: "integer", minimum: 15, maximum: 300 },
    rationale: { type: "string", minLength: 1, maxLength: 160 },
    notes: { type: ["string", "null"], maxLength: 160 },
  };
  return {
    type: "json_schema",
    json_schema: {
      name: "workout",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["workout_name", "training_strategy", "exercises"],
        properties: {
          workout_name: { type: "string", minLength: 1, maxLength: 100 },
          training_strategy: { type: "string", minLength: 1, maxLength: 240 },
          exercises: {
            type: "array",
            minItems: min,
            maxItems: max,
            items: {
              type: "object",
              additionalProperties: false,
              required: Object.keys(properties),
              properties,
            },
          },
        },
      },
    },
  };
}

export class ModelResponseError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
  }
}

export function expandModelWorkout(
  raw: unknown,
  catalog: ExerciseCatalogEntry[],
  durationMinutes: number,
  counts: { min: number; max: number }
) {
  const parsed = compactWorkoutSchema.safeParse(raw);
  if (!parsed.success)
    throw new ModelResponseError("schema_validation", parsed.error.message);
  const data = parsed.data;
  if (
    data.exercises.length < Math.min(counts.min, catalog.length) ||
    data.exercises.length > counts.max
  ) {
    throw new ModelResponseError(
      "exercise_count",
      "Exercise count does not match session duration"
    );
  }
  const map = new Map(catalog.map((e) => [e.id, e]));
  const seen = new Set<string>();
  return {
    workout_name: data.workout_name,
    reasoning: {
      muscle_groups: "The selected exercises support the session focus.",
      training_strategy: data.training_strategy,
    },
    warmup: {
      duration_seconds:
        durationMinutes <= 15 ? 180 : durationMinutes >= 90 ? 420 : 300,
    },
    exercises: data.exercises.map((ex) => {
      const entry = map.get(ex.exercise_id);
      if (!entry)
        throw new ModelResponseError(
          "invalid_exercise_id",
          "Exercise not in eligible catalog"
        );
      if (seen.has(ex.exercise_id))
        throw new ModelResponseError(
          "duplicate_exercise",
          "Duplicate exercise ID"
        );
      seen.add(ex.exercise_id);
      const timed = entry.exercise_type === "time";
      if (
        timed
          ? ex.duration_seconds == null || ex.load_kg != null || ex.reps != null
          : ex.load_kg == null || ex.reps == null || ex.duration_seconds != null
      ) {
        throw new ModelResponseError(
          "exercise_targets",
          "Targets do not match exercise type"
        );
      }
      const target = timed
        ? { target_duration_seconds: ex.duration_seconds! }
        : { target_load_kg: ex.load_kg!, target_reps: ex.reps! };
      return {
        exercise_id: ex.exercise_id,
        sets: [
          ...(timed
            ? []
            : [
                {
                  set_type: "warmup" as const,
                  target_load_kg: Math.round(ex.load_kg! * 0.5 * 2) / 2,
                  target_reps: 10,
                },
              ]),
          ...Array.from({ length: ex.working_sets }, () => ({
            set_type: "working" as const,
            ...target,
          })),
        ],
        rest_duration_seconds: ex.rest_seconds,
        notes: ex.notes,
        reasoning: {
          muscle_groups:
            `${entry.name} targets ${entry.primary_muscles.join(", ")}.`.slice(
              0,
              280
            ),
          exercise_selection: ex.rationale,
        },
      };
    }),
  };
}

export function readModelContent(raw: Record<string, any>): string {
  if (raw.error)
    throw new ModelResponseError(
      "provider_error",
      String(raw.error.message ?? "Provider returned an error")
    );
  const choice = raw.choices?.[0];
  if (choice?.finish_reason === "length")
    throw new ModelResponseError(
      "token_limit",
      "Model exhausted its output budget"
    );
  if (choice?.finish_reason === "content_filter" || choice?.message?.refusal)
    throw new ModelResponseError("refusal", "Provider declined the request");
  const content = choice?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new ModelResponseError(
      "empty_response",
      "Model returned no answer content"
    );
  return content;
}
