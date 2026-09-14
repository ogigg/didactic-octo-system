import { Redirect, Stack, useSegments } from "expo-router";

import {
  FORCE_PROFILE_GATE,
  ProfileGate,
} from "@/components/auth/profile-gate";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated, isInitialized, profileStatus, isPasswordRecovery } =
    useAuth();
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();

  const segments = useSegments();
  const recoveryRoute = (segments as string[]).includes("reset-password");
  if (FORCE_PROFILE_GATE) return <ProfileGate />;
  if (isPasswordRecovery && !recoveryRoute)
    return <Redirect href="/(auth)/reset-password" />;
  if (
    !recoveryRoute &&
    (profileStatus === "error" ||
      (isAuthenticated && profileStatus !== "ready"))
  )
    return <ProfileGate />;

  if (isInitialized && isAuthenticated && !recoveryRoute) {
    if (!isCompleted) {
      const nextStep = getNextUnfinishedStep();
      const target =
        nextStep === null ? "/(tabs)" : `/(onboarding)/${nextStep}`;
      return <Redirect href={target as never} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
