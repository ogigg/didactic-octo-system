import { Redirect, Stack } from "expo-router";

import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { isAuthenticated, isInitialized } = useAuth();
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();

  if (isInitialized && isAuthenticated) {
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
