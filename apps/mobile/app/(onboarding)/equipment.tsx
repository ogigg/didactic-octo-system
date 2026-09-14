import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { OnboardingChoice } from "@/components/onboarding/choice";
import { useOnboardingStore } from "@/stores/onboarding-store";
export default function EquipmentScreen() {
  const { t } = useTranslation("onboarding");
  const { equipment, setEquipment } = useOnboardingStore();
  return (
    <OnboardingScreen
      step="equipment"
      title={t("equipment.title")}
      subtitle={t("equipment.subtitle")}
      canContinue={equipment !== null}
    >
      {(["bodyweight", "dumbbells", "barbell", "full_gym"] as const).map(
        (value) => (
          <OnboardingChoice
            key={value}
            label={t(`equipment.${value}`)}
            hint={t(`equipment.${value}Hint`)}
            selected={equipment === value}
            onPress={() => setEquipment(value)}
          />
        )
      )}
    </OnboardingScreen>
  );
}
