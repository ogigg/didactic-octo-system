import { Redirect, Stack } from "expo-router";

import { ProfileGate } from "@/components/auth/profile-gate";
import { useAuth } from "@/hooks/use-auth";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function OnboardingLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const { isAuthenticated, isInitialized, profileStatus, isPasswordRecovery } =
    useAuth();
  const completed = useOnboardingStore((s) => s.isCompleted);
  if (!isInitialized || profileStatus !== "ready") return <ProfileGate />;
  if (!isAuthenticated) return <Redirect href="/(auth)/sign-in" />;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (completed) return <Redirect href="/(tabs)" />;

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
