import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

// -----------------------------------------------------------------------------
// Profile Schema & Type
// -----------------------------------------------------------------------------

const profileSchema = z.object({
  id: z.string().uuid(),
  gender: z.enum(["male", "female", "prefer_not_to_say"]).nullable(),
  goal: z
    .enum(["build_strength", "lose_weight", "improve_fitness", "custom"])
    .nullable(),
  custom_goal: z.string().nullable(),
  weekly_frequency: z.enum(["2", "3", "4", "5_plus"]).nullable(),
  onboarding_completed: z.boolean(),
  training_split: z
    .enum(["full_body", "upper_lower", "push_pull_legs"])
    .nullable(),
  session_duration_minutes: z.number().nullable(),
  equipment_level: z
    .enum(["bodyweight", "dumbbells", "barbell", "full_gym"])
    .nullable(),
  training_style: z
    .enum(["strength", "hypertrophy", "endurance", "circuit"])
    .nullable(),
  difficulty_level: z.enum(["beginner", "intermediate", "advanced"]).nullable(),
  training_custom_prompt: z.string().nullable(),
  training_setup_completed: z.boolean(),
  weight_unit: z.enum(["kg", "lbs"]).default("kg"),
  subscription_tier: z.enum(["free", "pro"]).default("free"),
  subscription_expires_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Profile = z.infer<typeof profileSchema>;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw new Error(error.message);
      return profileSchema.parse(data);
    },
    enabled: !!user,
  });
}
