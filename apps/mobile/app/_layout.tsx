import { useOnboardingStore } from "@/stores/onboarding-store";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import "@/i18n";
import { useTranslation } from "react-i18next";

import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { isCompleted, getNextUnfinishedStep } = useOnboardingStore();
  const { t } = useTranslation("common");

  useEffect(() => {
    if (!isCompleted) {
      const nextStep = getNextUnfinishedStep();
      const target =
        nextStep === null ? "/(tabs)" : `/(onboarding)/${nextStep}`;
      router.replace(target as never);
    }
  }, [isCompleted, getNextUnfinishedStep]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(onboarding)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: t("nav.modal") }}
        />
        <Stack.Screen
          name="design-system"
          options={{ presentation: "modal", title: t("nav.designSystem") }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
