import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Gender = "male" | "female" | "other";
export type Goal = "build_strength" | "lose_weight" | "improve_fitness";
export type Frequency = 2 | 3 | 4 | 5; // 5 represents "5+" — downstream uses "5 or more days per week"
export type Equipment = "bodyweight" | "dumbbells" | "barbell" | "full_gym";
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
  /** Account that owns this persisted draft. Null means no account has claimed it. */
  ownerUserId: string | null;
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
  /** ISO timestamp for the first onboarding screen view in this flow. */
  onboardingStartedAt: string | null;
}

interface OnboardingActions {
  /** Claim the persisted draft for an account, clearing another account's draft. */
  prepareForUser: (userId: string) => void;
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
  /** Returns true only when this call starts a new onboarding flow timer. */
  markOnboardingStarted: () => boolean;
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
    userId?: string;
    onboarding_completed: boolean;
    gender: "male" | "female" | "prefer_not_to_say" | null;
    goal:
      | "build_strength"
      | "lose_weight"
      | "improve_fitness"
      | "custom"
      | null;
    custom_goal?: string | null;
    weekly_frequency: "2" | "3" | "4" | "5_plus" | null;
    equipment_level: string | null;
    difficulty_level: string | null;
  }) => void;
}

const initialState: OnboardingState = {
  ownerUserId: null,
  gender: null,
  genderSkipped: false,
  goal: null,
  customGoal: null,
  frequency: null,
  equipment: null,
  experience: null,
  strengthBaselines: [],
  isCompleted: false,
  onboardingStartedAt: null,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      prepareForUser: (userId) => {
        if (get().ownerUserId === userId) return;
        set({ ...initialState, ownerUserId: userId });
      },

      setGender: (gender) => set({ gender, genderSkipped: false }),

      skipGender: () => set({ gender: null, genderSkipped: true }),

      setGoal: (goal) => set({ goal, customGoal: null }),

      setCustomGoal: (text) =>
        set({ customGoal: text.trim() === "" ? null : text, goal: null }),

      setFrequency: (frequency) => set({ frequency }),

      setEquipment: (equipment) => set({ equipment }),

      setExperience: (experience) => set({ experience }),

      setStrengthBaselines: (strengthBaselines) => set({ strengthBaselines }),

      complete: () => set({ isCompleted: true, onboardingStartedAt: null }),

      markOnboardingStarted: () => {
        const { isCompleted, onboardingStartedAt } = get();
        if (isCompleted || onboardingStartedAt !== null) return false;

        set({ onboardingStartedAt: new Date().toISOString() });
        return true;
      },

      reset: () => set({ ...initialState }),

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
        const current = get();
        if (params.userId && current.ownerUserId !== params.userId) return;

        const {
          userId,
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

        const mappedGoal: Goal | null = goal === "custom" ? null : goal;

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

        // An incomplete profile can coexist with a local draft. Merge server
        // defaults into blank fields so a token refresh or retry cannot erase
        // answers that are still being entered on this device.
        const preserveDraft = !onboarding_completed;
        set({
          ...(preserveDraft && current.gender !== null
            ? { gender: current.gender, genderSkipped: current.genderSkipped }
            : { gender: mappedGender, genderSkipped: gender === null }),
          ...(preserveDraft && (current.goal !== null || current.customGoal)
            ? { goal: current.goal, customGoal: current.customGoal }
            : {
                goal: mappedGoal,
                customGoal: custom_goal ?? null,
              }),
          ...(preserveDraft && current.frequency !== null
            ? { frequency: current.frequency }
            : { frequency: mappedFrequency }),
          ...(preserveDraft && current.equipment !== null
            ? { equipment: current.equipment }
            : { equipment: mappedEquipment }),
          ...(preserveDraft && current.experience !== null
            ? { experience: current.experience }
            : { experience: mappedExperience }),
          // Baselines are local draft input during onboarding. Keep them for
          // incomplete profiles; completed profiles no longer need the draft.
          strengthBaselines: preserveDraft ? current.strengthBaselines : [],
          isCompleted: onboarding_completed,
          onboardingStartedAt: onboarding_completed
            ? null
            : current.onboardingStartedAt,
          ...(userId ? { ownerUserId: userId } : {}),
        });
      },
    }),
    {
      name: "onboarding-storage",
      skipHydration: true,
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
      partialize: (state) => ({
        ownerUserId: state.ownerUserId,
        gender: state.gender,
        genderSkipped: state.genderSkipped,
        goal: state.goal,
        customGoal: state.customGoal,
        frequency: state.frequency,
        equipment: state.equipment,
        experience: state.experience,
        strengthBaselines: state.strengthBaselines,
        isCompleted: state.isCompleted,
        onboardingStartedAt: state.onboardingStartedAt,
      }),
    }
  )
);
