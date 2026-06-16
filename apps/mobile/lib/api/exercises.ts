import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { exerciseImageSchema } from "@/lib/exercise-media";

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  external_id: z.string().nullable(),
  exercise_type: z.enum(["weight", "time"]).default("weight"),
  primary_muscles: z.array(z.string()),
  primary_muscle_labels: z.array(z.string()).default([]),
  secondary_muscles: z.array(z.string()).nullable(),
  secondary_muscle_labels: z.array(z.string()).default([]),
  equipment: z.array(z.string()),
  equipment_labels: z.array(z.string()).default([]),
  difficulty_level: z.string().nullable(),
  difficulty_label: z.string().nullable().default(null),
  instructions: z.string().nullable(),
  image: exerciseImageSchema.default(null),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

export interface ExerciseFilters {
  ids?: string[];
  muscles?: string[];
  equipment?: string[];
  search?: string;
}

const catalogLabelSchema = z.object({
  label_type: z.enum(["muscle", "equipment", "difficulty"]),
  label_key: z.string().min(1),
  display_name: z.string().min(1),
});

export type CatalogLabel = z.infer<typeof catalogLabelSchema>;

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

export async function fetchExercises(
  filters?: ExerciseFilters,
  language = "en"
): Promise<Exercise[]> {
  const search = filters?.search?.trim() || null;

  const { data, error } = await supabase.rpc("get_localized_exercises", {
    p_language: language,
    p_search: search,
    p_muscles: filters?.muscles?.length ? filters.muscles : null,
    p_equipment: filters?.equipment?.length ? filters.equipment : null,
    p_ids: filters?.ids?.length ? filters.ids : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(exerciseSchema).parse(data);
}

export async function fetchExercise(
  id: string,
  language = "en"
): Promise<Exercise> {
  const { data, error } = await supabase.rpc("get_localized_exercise", {
    p_exercise_id: id,
    p_language: language,
  });

  if (error) {
    throw new Error(error.message);
  }

  return exerciseSchema.parse(data);
}

export async function fetchCatalogLabels(
  language = "en"
): Promise<CatalogLabel[]> {
  const { data, error } = await supabase.rpc("get_localized_catalog_labels", {
    p_language: language,
  });

  if (error) {
    throw new Error(error.message);
  }

  return z.array(catalogLabelSchema).parse(data);
}

export async function fetchExerciseFilterOptions(
  language = "en"
): Promise<CatalogLabel[]> {
  const { data, error } = await supabase.rpc(
    "get_localized_exercise_filter_options",
    {
      p_language: language,
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return z.array(catalogLabelSchema).parse(data);
}
