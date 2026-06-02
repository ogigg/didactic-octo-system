import { z } from "zod";

export const exerciseImageSchema = z
  .object({
    url: z.string().url(),
    thumbnail_url: z.string().url().nullable().default(null),
    width: z.number().int().positive().nullable().default(null),
    height: z.number().int().positive().nullable().default(null),
    thumbnail_width: z.number().int().positive().nullable().default(null),
    thumbnail_height: z.number().int().positive().nullable().default(null),
    alt_text: z.string().nullable().default(null),
    blurhash: z.string().nullable().default(null),
    source: z
      .enum(["curated", "imported", "generated", "placeholder"])
      .nullable()
      .default(null),
  })
  .nullable();

export type ExerciseImageData = z.infer<typeof exerciseImageSchema>;
