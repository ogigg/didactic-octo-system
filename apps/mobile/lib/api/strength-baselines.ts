import { supabase } from "@/lib/supabase";
import { z } from "zod";

import type { StrengthBaseline } from "@/stores/onboarding-store";

// -----------------------------------------------------------------------------
// Schema
// -----------------------------------------------------------------------------

const baselineSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  exercise_key: z.string(),
  load_kg: z.number().nullable(),
  reps: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
});

// -----------------------------------------------------------------------------
// Query
// -----------------------------------------------------------------------------

export async function fetchStrengthBaselines(): Promise<StrengthBaseline[]> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { data, error } = await supabase
    .from("strength_baselines")
    .select("*")
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  const parsed = z.array(baselineSchema).parse(data);
  return parsed.map((b) => ({
    exercise_key: b.exercise_key,
    load_kg: b.load_kg,
    reps: b.reps,
  }));
}

// -----------------------------------------------------------------------------
// Mutation
// -----------------------------------------------------------------------------

export async function saveStrengthBaselines(
  baselines: StrengthBaseline[]
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  // Delete existing and upsert new
  const { error: deleteError } = await supabase
    .from("strength_baselines")
    .delete()
    .eq("user_id", user.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }

  if (baselines.length === 0) return;

  const rows = baselines.map((b) => ({
    user_id: user.id,
    exercise_key: b.exercise_key,
    load_kg: b.load_kg,
    reps: b.reps,
  }));

  const { error: insertError } = await supabase
    .from("strength_baselines")
    .insert(rows);

  if (insertError) {
    throw new Error(insertError.message);
  }
}
