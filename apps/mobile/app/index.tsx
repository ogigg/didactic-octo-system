import { ProfileGate } from "@/components/auth/profile-gate";
import { Redirect } from "expo-router";

import { useAuth } from "@/hooks/use-auth";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function Index() {
  const { isAuthenticated, isInitialized, profileStatus, isPasswordRecovery } =
    useAuth();
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();

  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (
    profileStatus === "error" ||
    (isAuthenticated && profileStatus !== "ready")
  )
    return <ProfileGate />;

  // Keep splash visible until auth is resolved
  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!isCompleted) {
    const nextStep = getNextUnfinishedStep();
    const target = nextStep === null ? "/(tabs)" : `/(onboarding)/${nextStep}`;
    return <Redirect href={target as never} />;
  }

  return <Redirect href="/(tabs)" />;
}
