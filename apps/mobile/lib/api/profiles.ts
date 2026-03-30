import { z } from "zod";

import { supabase } from "@/lib/supabase";
import type { Frequency, Gender, Goal } from "@/stores/onboarding-store";
import type {
  DurationMinutes,
  Equipment,
  TrainingStyle,
  Difficulty,
  TrainingSplit,
} from "@/lib/api/generate-workout";

type DbGender = "male" | "female" | "prefer_not_to_say" | null;
type DbGoal = "build_strength" | "lose_weight" | "improve_fitness" | "custom";
type DbFrequency = "2" | "3" | "4" | "5_plus";

interface ProfilePayload {
  id: string;
  gender: DbGender;
  goal: DbGoal;
  custom_goal: string | null;
  weekly_frequency: DbFrequency;
  onboarding_completed: boolean;
}

export interface OnboardingData {
  gender: Gender | null;
  goal: Goal | null;
  customGoal: string | null;
  frequency: Frequency;
}

const profileSchema = z
  .object({
    gender: z.enum(["male", "female", "prefer_not_to_say"]).nullable(),
    goal: z.enum([
      "build_strength",
      "lose_weight",
      "improve_fitness",
      "custom",
    ]),
    custom_goal: z.string().max(500).nullable(),
    weekly_frequency: z.enum(["2", "3", "4", "5_plus"]),
    onboarding_completed: z.literal(true),
  })
  .refine((data) => data.goal !== "custom" || data.custom_goal !== null, {
    message: "custom_goal is required when goal is 'custom'",
  });

function mapGender(gender: Gender | null): DbGender {
  if (gender === null) return null;
  if (gender === "other") return "prefer_not_to_say";
  return gender;
}

function mapFrequency(frequency: Frequency): DbFrequency {
  if (frequency === 5) return "5_plus";
  return String(frequency) as DbFrequency;
}

function mapGoal(
  goal: Goal | null,
  customGoal: string | null
): { goal: DbGoal; custom_goal: string | null } {
  if (customGoal) {
    return { goal: "custom", custom_goal: customGoal };
  }
  if (goal) {
    return { goal, custom_goal: null };
  }
  throw new Error("Either goal or customGoal must be provided");
}

export function mapOnboardingToProfile(
  data: OnboardingData
): Omit<ProfilePayload, "id"> {
  const { goal, custom_goal } = mapGoal(data.goal, data.customGoal);

  const mapped = {
    gender: mapGender(data.gender),
    goal,
    custom_goal,
    weekly_frequency: mapFrequency(data.frequency),
    onboarding_completed: true as const,
  };

  return profileSchema.parse(mapped);
}

export interface TrainingPreferences {
  training_split: TrainingSplit;
  session_duration_minutes: DurationMinutes;
  equipment_level: Equipment;
  training_style: TrainingStyle;
  difficulty_level: Difficulty;
  training_custom_prompt: string | null;
}

export async function updateTrainingPreferences(
  prefs: TrainingPreferences
): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ ...prefs, training_setup_completed: true })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function upsertProfile(data: OnboardingData): Promise<void> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const mapped = mapOnboardingToProfile(data);
  const payload: ProfilePayload = { id: user.id, ...mapped };

  const { error } = await supabase
    .from("profiles")
    .upsert(payload)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchProfile(): Promise<{
  onboarding_completed: boolean;
  gender: DbGender;
  goal: DbGoal;
  weekly_frequency: DbFrequency;
} | null> {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error(authError?.message ?? "Not authenticated");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("onboarding_completed, gender, goal, weekly_frequency")
    .eq("id", user.id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}
