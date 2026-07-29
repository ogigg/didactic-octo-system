import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Gender = "male" | "female" | "other";
export type Goal = "build_strength" | "lose_weight" | "improve_fitness";
export type Frequency = 2 | 3 | 4 | 5; // 5 represents "5+" — downstream uses "5 or more days per week"
export type Equipment = "bodyweight" | "dumbbells" | "full_gym";
export type Experience = "beginner" | "intermediate" | "advanced";
export type OnboardingStep =
  | "gender"
  | "goal"
  | "frequency"
  | "equipment"
  | "experience"
  | "strength"
  | "review";

export interface StrengthBaseline {
  exercise_key: string;
  load_kg: number | null;
  reps: number;
}

interface OnboardingState {
  gender: Gender | null;
  /** true when user explicitly tapped "Skip this step" — distinct from null (not yet reached) */
  genderSkipped: boolean;
  goal: Goal | null;
  /** Overrides goal when non-empty. Clearing via setGoal() resets this to null. */
  customGoal: string | null;
  frequency: Frequency | null;
  equipment: Equipment | null;
  experience: Experience | null;
  strengthBaselines: StrengthBaseline[];
  isCompleted: boolean;
}

interface OnboardingActions {
  setGender: (gender: Gender) => void;
  skipGender: () => void;
  setGoal: (goal: Goal) => void;
  /** Empty string clears the custom goal back to null. */
  setCustomGoal: (text: string) => void;
  setFrequency: (freq: Frequency) => void;
  setEquipment: (equipment: Equipment) => void;
  setExperience: (experience: Experience) => void;
  setStrengthBaselines: (baselines: StrengthBaseline[]) => void;
  complete: () => void;
  reset: () => void;
  /**
   * Returns the first unanswered step for resume-on-relaunch routing.
   * Returns null when onboarding is complete.
   */
  getNextUnfinishedStep: () => OnboardingStep | null;
  /**
   * Syncs the onboarding state with the database profile.
   * Used on login to restore the correct onboarding state.
   */
  syncWithDatabase: (params: {
    onboarding_completed: boolean;
    gender: "male" | "female" | "prefer_not_to_say" | null;
    goal:
      | "build_strength"
      | "lose_weight"
      | "improve_fitness"
      | "custom"
      | null;
    custom_goal: string | null;
    weekly_frequency: "2" | "3" | "4" | "5_plus" | null;
    equipment_level: string | null;
    difficulty_level: string | null;
  }) => void;
}

const initialState: OnboardingState = {
  gender: null,
  genderSkipped: false,
  goal: null,
  customGoal: null,
  frequency: null,
  equipment: null,
  experience: null,
  strengthBaselines: [],
  isCompleted: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setGender: (gender) => set({ gender, genderSkipped: false }),

      skipGender: () => set({ gender: null, genderSkipped: true }),

      setGoal: (goal) => set({ goal, customGoal: null }),

      setCustomGoal: (text) =>
        set({ customGoal: text.trim() === "" ? null : text, goal: null }),

      setFrequency: (frequency) => set({ frequency }),

      setEquipment: (equipment) => set({ equipment }),

      setExperience: (experience) => set({ experience }),

      setStrengthBaselines: (strengthBaselines) => set({ strengthBaselines }),

      complete: () => set({ isCompleted: true }),

      reset: () => set(initialState),

      getNextUnfinishedStep: () => {
        const {
          isCompleted,
          gender,
          genderSkipped,
          goal,
          customGoal,
          frequency,
          equipment,
          experience,
        } = get();
        if (isCompleted) return null;
        if (gender === null && !genderSkipped) return "gender";
        if (goal === null && !customGoal) return "goal";
        if (frequency === null) return "frequency";
        if (equipment === null) return "equipment";
        if (experience === null) return "experience";
        // strength is optional — skip to review if not filled
        return "review";
      },

      syncWithDatabase: (params) => {
        const {
          onboarding_completed,
          gender,
          goal,
          custom_goal,
          weekly_frequency,
          equipment_level,
          difficulty_level,
        } = params;

        // Map database values to store types
        const mappedGender: Gender | null =
          gender === null
            ? null
            : gender === "prefer_not_to_say"
              ? "other"
              : gender;

        const mappedGoal: Goal | null =
          goal === "custom" || goal === null ? null : goal;

        const mappedFrequency: Frequency | null =
          weekly_frequency === null
            ? null
            : weekly_frequency === "5_plus"
              ? 5
              : (parseInt(weekly_frequency, 10) as Frequency);

        const mappedEquipment: Equipment | null = equipment_level
          ? (equipment_level as Equipment)
          : null;

        const mappedExperience: Experience | null = difficulty_level
          ? (difficulty_level as Experience)
          : null;

        const databaseActivationComplete =
          onboarding_completed &&
          (mappedGoal !== null ||
            (goal === "custom" && custom_goal !== null)) &&
          mappedFrequency !== null &&
          mappedEquipment !== null &&
          mappedExperience !== null;

        set((state) => {
          if (!databaseActivationComplete) {
            return {
              gender: mappedGender ?? state.gender,
              genderSkipped:
                mappedGender === null
                  ? onboarding_completed || state.genderSkipped
                  : false,
              goal: goal === "custom" ? null : (mappedGoal ?? state.goal),
              customGoal:
                goal === "custom"
                  ? (custom_goal ?? state.customGoal)
                  : mappedGoal
                    ? null
                    : state.customGoal,
              frequency: mappedFrequency ?? state.frequency,
              equipment: mappedEquipment ?? state.equipment,
              experience: mappedExperience ?? state.experience,
              isCompleted: false,
            };
          }

          return {
            gender: mappedGender,
            genderSkipped: gender === null,
            goal: mappedGoal,
            customGoal: goal === "custom" ? custom_goal : null,
            frequency: mappedFrequency,
            equipment: mappedEquipment,
            experience: mappedExperience,
            strengthBaselines: [],
            isCompleted: true,
          };
        });
      },
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Corrupted storage — reset to fresh start; do not surface to user
          console.warn(
            "[onboarding-store] hydration failed, resetting:",
            error
          );
          state?.reset();
        }
      },
    }
  )
);
