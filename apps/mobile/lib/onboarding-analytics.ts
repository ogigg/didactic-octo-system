import { useEffect } from "react";

import type { OnboardingStep } from "@/stores/onboarding-store";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";

const STEP_INDEX: Record<OnboardingStep, number> = {
  gender: 1,
  goal: 2,
  frequency: 3,
  equipment: 4,
  experience: 5,
  strength: 6,
  review: 7,
};

/**
 * Records an onboarding screen view and starts the persisted onboarding timer.
 * The timer is only started for the first non-edit onboarding view, so a
 * relaunch or a later step can still produce the single start event.
 */
export function useOnboardingStepAnalytics(
  step: OnboardingStep,
  editMode?: string
): void {
  const markOnboardingStarted = useOnboardingStore(
    (state) => state.markOnboardingStarted
  );

  useEffect(() => {
    const isEditMode = editMode === "1";

    if (
      !isEditMode &&
      typeof markOnboardingStarted === "function" &&
      markOnboardingStarted()
    ) {
      trackEvent("onboarding_started", { entry_point: "onboarding" });
    }

    trackEvent("onboarding_step_viewed", {
      step,
      step_index: STEP_INDEX[step],
      edit_mode: isEditMode,
    });
  }, [editMode, markOnboardingStarted, step]);
}
