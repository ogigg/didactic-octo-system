import { z } from "zod";

export const strengthBaselineSchema = z
  .object({
    exercise_key: z.enum([
      "pushups",
      "pullups",
      "db_bench",
      "db_row",
      "bb_bench",
      "bb_squat",
      "deadlift",
    ]),
    load_kg: z.number().finite().nonnegative().nullable(),
    reps: z.number().int().min(0).max(999),
  })
  .superRefine((value, ctx) => {
    const bodyweight =
      value.exercise_key === "pushups" || value.exercise_key === "pullups";
    if (
      bodyweight
        ? value.load_kg !== null
        : value.load_kg === null || value.reps === 0
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter both weight and repetitions for weighted exercises",
      });
    }
  });
export const strengthBaselinesSchema = z
  .array(strengthBaselineSchema)
  .max(7)
  .refine(
    (rows) => new Set(rows.map((row) => row.exercise_key)).size === rows.length,
    "Each exercise can only have one baseline"
  );
