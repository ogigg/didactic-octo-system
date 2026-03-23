import { z } from "zod";

import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

export const exerciseSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  external_id: z.string().nullable(),
  primary_muscles: z.array(z.string()),
  secondary_muscles: z.array(z.string()).nullable(),
  equipment: z.array(z.string()),
  difficulty_level: z.string().nullable(),
  instructions: z.string().nullable(),
  image_url: z.string().nullable(),
  video_url: z.string().nullable(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

// -----------------------------------------------------------------------------
// Filters
// -----------------------------------------------------------------------------

export interface ExerciseFilters {
  muscles?: string[];
  equipment?: string[];
  search?: string;
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

export async function fetchExercises(
  filters?: ExerciseFilters
): Promise<Exercise[]> {
  let query = supabase.from("exercises").select("*");

  if (filters?.muscles?.length) {
    query = query.overlaps("primary_muscles", filters.muscles);
  }

  if (filters?.equipment?.length) {
    query = query.overlaps("equipment", filters.equipment);
  }

  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`);
  }

  const { data, error } = await query.order("name");

  if (error) {
    throw new Error(error.message);
  }

  return z.array(exerciseSchema).parse(data);
}

export async function fetchExercise(id: string): Promise<Exercise> {
  const { data, error } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return exerciseSchema.parse(data);
}
