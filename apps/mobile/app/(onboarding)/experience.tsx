import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { OnboardingChoice } from "@/components/onboarding/choice";
import { useOnboardingStore } from "@/stores/onboarding-store";
export default function ExperienceScreen() {
  const { t } = useTranslation("onboarding");
  const { experience, setExperience } = useOnboardingStore();
  return (
    <OnboardingScreen
      step="experience"
      title={t("experience.title")}
      subtitle={t("experience.subtitle")}
      canContinue={experience !== null}
    >
      {(["beginner", "intermediate", "advanced"] as const).map((value) => (
        <OnboardingChoice
          key={value}
          label={t(`experience.${value}`)}
          hint={t(`experience.${value}Hint`)}
          selected={experience === value}
          onPress={() => setExperience(value)}
        />
      ))}
    </OnboardingScreen>
  );
}
