import { supabase } from "@/lib/supabase";
import { z } from "zod";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

export const EXERCISE_PREFERENCE = {
  PREFERRED: "preferred",
  SOFT_DISLIKE: "soft_dislike",
  HARD_DISLIKE: "hard_dislike",
} as const;

export type ExercisePreferenceValue =
  (typeof EXERCISE_PREFERENCE)[keyof typeof EXERCISE_PREFERENCE];

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

const exercisePreferenceRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  preference: z.enum(["preferred", "soft_dislike", "hard_dislike"]),
  created_at: z.string(),
  updated_at: z.string(),
});

// -----------------------------------------------------------------------------
// Queries
// -----------------------------------------------------------------------------

export async function fetchExercisePreference(
  exerciseId: string
): Promise<ExercisePreferenceValue | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { data, error } = await supabase
    .from("exercise_preferences")
    .select("preference")
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }

  return data.preference as ExercisePreferenceValue;
}

export async function fetchExercisePreferences(
  exerciseIds?: string[]
): Promise<Map<string, ExercisePreferenceValue>> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  let query = supabase
    .from("exercise_preferences")
    .select("exercise_id, preference")
    .eq("user_id", user.id);

  if (exerciseIds && exerciseIds.length > 0) {
    query = query.in("exercise_id", exerciseIds);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const parsed = z
    .array(
      z.object({
        exercise_id: z.string().uuid(),
        preference: z.enum(["preferred", "soft_dislike", "hard_dislike"]),
      })
    )
    .parse(data);

  const map = new Map<string, ExercisePreferenceValue>();
  for (const row of parsed) {
    map.set(row.exercise_id, row.preference);
  }
  return map;
}

// -----------------------------------------------------------------------------
// Mutations
// -----------------------------------------------------------------------------

export async function upsertExercisePreference(
  exerciseId: string,
  preference: ExercisePreferenceValue
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { error } = await supabase.from("exercise_preferences").upsert(
    {
      user_id: user.id,
      exercise_id: exerciseId,
      preference,
    },
    { onConflict: "user_id,exercise_id" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function removeExercisePreference(
  exerciseId: string
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { error } = await supabase
    .from("exercise_preferences")
    .delete()
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId);

  if (error) {
    throw new Error(error.message);
  }
}
