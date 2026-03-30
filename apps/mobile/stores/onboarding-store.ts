import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Gender = "male" | "female" | "other";
export type Goal = "build_strength" | "lose_weight" | "improve_fitness";
export type Frequency = 2 | 3 | 4 | 5; // 5 represents "5+" — downstream uses "5 or more days per week"
export type OnboardingStep = "gender" | "goal" | "frequency" | "review";

interface OnboardingState {
  gender: Gender | null;
  /** true when user explicitly tapped "Skip this step" — distinct from null (not yet reached) */
  genderSkipped: boolean;
  goal: Goal | null;
  /** Overrides goal when non-empty. Clearing via setGoal() resets this to null. */
  customGoal: string | null;
  frequency: Frequency | null;
  isCompleted: boolean;
}

interface OnboardingActions {
  setGender: (gender: Gender) => void;
  skipGender: () => void;
  setGoal: (goal: Goal) => void;
  /** Empty string clears the custom goal back to null. */
  setCustomGoal: (text: string) => void;
  setFrequency: (freq: Frequency) => void;
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
    goal: "build_strength" | "lose_weight" | "improve_fitness" | "custom";
    weekly_frequency: "2" | "3" | "4" | "5_plus";
  }) => void;
}

const initialState: OnboardingState = {
  gender: null,
  genderSkipped: false,
  goal: null,
  customGoal: null,
  frequency: null,
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

      complete: () => set({ isCompleted: true }),

      reset: () => set(initialState),

      getNextUnfinishedStep: () => {
        const {
          isCompleted,
          frequency,
          goal,
          customGoal,
          gender,
          genderSkipped,
        } = get();
        if (isCompleted) return null;
        if (gender === null && !genderSkipped) return "gender";
        if (goal === null && !customGoal) return "goal";
        if (frequency === null) return "frequency";
        return "review";
      },

      syncWithDatabase: (params) => {
        const { onboarding_completed, gender, goal, weekly_frequency } = params;

        // Map database values to store types
        const mappedGender: Gender | null =
          gender === null
            ? null
            : gender === "prefer_not_to_say"
              ? "other"
              : gender;

        const mappedGoal: Goal | null = goal === "custom" ? null : goal;

        const mappedFrequency: Frequency =
          weekly_frequency === "5_plus"
            ? 5
            : (parseInt(weekly_frequency, 10) as Frequency);

        set({
          gender: mappedGender,
          genderSkipped: gender === null,
          goal: mappedGoal,
          customGoal: null,
          frequency: mappedFrequency,
          isCompleted: onboarding_completed,
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
