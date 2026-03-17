import { useOnboardingStore } from "@/stores/onboarding-store";
import { Redirect } from "expo-router";

export default function Index() {
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();

  if (isCompleted) {
    return <Redirect href="/(tabs)" />;
  }

  const nextStep = getNextUnfinishedStep();
  const target = nextStep === null ? "/(tabs)" : `/(onboarding)/${nextStep}`;
  return <Redirect href={target as never} />;
}
