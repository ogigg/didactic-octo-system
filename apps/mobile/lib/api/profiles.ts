import { z } from "zod";

import { supabase } from "@/lib/supabase";
import { detectDefaultWeightUnit } from "@/lib/unit-conversion";
import type {
  Frequency,
  Gender,
  Goal,
  Equipment,
  Experience,
  StrengthBaseline,
} from "@/stores/onboarding-store";
import type {
  DurationMinutes,
  Equipment as TrainingEquipment,
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
  training_split: TrainingSplit;
  session_duration_minutes: DurationMinutes;
  equipment_level: TrainingEquipment;
  training_style: TrainingStyle;
  difficulty_level: Difficulty;
  training_setup_completed: boolean;
  weight_unit: "kg" | "lbs";
}

export interface OnboardingData {
  gender: Gender | null;
  goal: Goal | null;
  customGoal: string | null;
  frequency: Frequency;
  equipment: Equipment;
  experience: Experience;
  strengthBaselines: StrengthBaseline[];
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
    training_split: z.enum(["full_body", "upper_lower", "push_pull_legs"]),
    session_duration_minutes: z.number(),
    equipment_level: z.enum(["bodyweight", "dumbbells", "barbell", "full_gym"]),
    training_style: z.enum(["strength", "hypertrophy", "endurance", "circuit"]),
    difficulty_level: z.enum(["beginner", "intermediate", "advanced"]),
    training_setup_completed: z.literal(true),
    weight_unit: z.enum(["kg", "lbs"]),
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

/** Derive training split from weekly frequency */
function deriveSplit(frequency: Frequency): TrainingSplit {
  if (frequency <= 3) return "full_body";
  if (frequency === 4) return "upper_lower";
  return "push_pull_legs";
}

/** Derive training style from goal */
function deriveStyle(
  goal: Goal | null,
  customGoal: string | null
): TrainingStyle {
  if (customGoal) return "hypertrophy"; // sensible default for custom goals
  switch (goal) {
    case "build_strength":
      return "strength";
    case "lose_weight":
      return "circuit";
    case "improve_fitness":
      return "hypertrophy";
    default:
      return "hypertrophy";
  }
}

/** Derive session duration from experience level */
function deriveDuration(experience: Experience): DurationMinutes {
  switch (experience) {
    case "beginner":
      return 30 as DurationMinutes;
    case "intermediate":
      return 45 as DurationMinutes;
    case "advanced":
      return 60 as DurationMinutes;
  }
}

/** Map onboarding equipment to training equipment type */
function mapEquipment(equipment: Equipment): TrainingEquipment {
  switch (equipment) {
    case "bodyweight":
      return "bodyweight";
    case "dumbbells":
      return "dumbbells";
    case "full_gym":
      return "full_gym";
  }
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
    training_split: deriveSplit(data.frequency),
    session_duration_minutes: deriveDuration(data.experience),
    equipment_level: mapEquipment(data.equipment),
    training_style: deriveStyle(data.goal, data.customGoal),
    difficulty_level: data.experience,
    training_setup_completed: true as const,
    weight_unit: detectDefaultWeightUnit(),
  };

  return profileSchema.parse(mapped) as Omit<ProfilePayload, "id">;
}

export interface TrainingPreferences {
  training_split: TrainingSplit;
  session_duration_minutes: DurationMinutes;
  equipment_level: TrainingEquipment;
  training_style: TrainingStyle;
  difficulty_level: Difficulty;
  training_custom_prompt: string | null;
  weight_unit: "kg" | "lbs";
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

  // Save strength baselines if provided
  if (data.strengthBaselines.length > 0) {
    await upsertStrengthBaselines(user.id, data.strengthBaselines);
  }
}

async function upsertStrengthBaselines(
  userId: string,
  baselines: StrengthBaseline[]
): Promise<void> {
  const rows = baselines.map((b) => ({
    user_id: userId,
    exercise_key: b.exercise_key,
    load_kg: b.load_kg,
    reps: b.reps,
  }));

  const { error } = await supabase
    .from("strength_baselines")
    .upsert(rows, { onConflict: "user_id,exercise_key" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function fetchProfile(): Promise<{
  onboarding_completed: boolean;
  gender: DbGender;
  goal: DbGoal | null;
  custom_goal: string | null;
  weekly_frequency: DbFrequency | null;
  equipment_level: string | null;
  difficulty_level: string | null;
  weight_unit: "kg" | "lbs";
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
    .select(
      "onboarding_completed, gender, goal, custom_goal, weekly_frequency, equipment_level, difficulty_level, weight_unit"
    )
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
