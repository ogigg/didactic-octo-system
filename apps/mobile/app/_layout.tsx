import "@/i18n";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import "react-native-reanimated";

import { AmbientGlow } from "@/components/ambient-glow";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/stores/auth-store";
import { queryClient } from "@/lib/query-client";
import { syncQueue } from "@/lib/sync-queue";
import { registerSyncHandlers } from "@/lib/sync-handlers";
import { initPostHog, flushPostHog } from "@/lib/posthog";
import NetInfo from "@react-native-community/netinfo";

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation("common");
  const colors = Colors[colorScheme ?? "light"];
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  useEffect(() => {
    registerSyncHandlers();
    syncQueue.processQueue();

    const unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        syncQueue.processQueue();
      }
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        syncQueue.processQueue();
      }
    });

    // Flush PostHog events when app goes to background
    const appStateSubFlush = AppState.addEventListener(
      "change",
      (nextState) => {
        if (nextState !== "active") {
          flushPostHog();
        }
      }
    );

    return () => {
      unsubscribeNetInfo();
      appStateSub.remove();
      appStateSubFlush?.remove();
    };
  }, []);

  // Initialize PostHog analytics
  useEffect(() => {
    initPostHog();
  }, []);

  const theme = useMemo(() => {
    const base = colorScheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: "transparent",
        card: "transparent",
      },
    };
  }, [colorScheme]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <AmbientGlow variant="hero" />
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={theme}>
          <Stack
            screenOptions={{
              contentStyle: styles.transparent,
            }}
          >
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(onboarding)"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: t("nav.modal") }}
            />
            <Stack.Screen
              name="design-system"
              options={{ presentation: "modal", title: t("nav.designSystem") }}
            />
            <Stack.Screen
              name="workout"
              options={{
                presentation: "fullScreenModal",
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="workout-summary"
              options={{
                headerShown: false,
                gestureEnabled: false,
              }}
            />
            <Stack.Screen
              name="exercise-picker"
              options={{
                presentation: "fullScreenModal",
                headerShown: false,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen
              name="generate-workout"
              options={{
                presentation: "fullScreenModal",
                headerShown: false,
                gestureEnabled: true,
              }}
            />
            <Stack.Screen name="history" options={{ headerShown: false }} />
            <Stack.Screen
              name="workout-detail"
              options={{ headerShown: false }}
            />
            <Stack.Screen name="statistics" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </QueryClientProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  transparent: { backgroundColor: "transparent" },
});
