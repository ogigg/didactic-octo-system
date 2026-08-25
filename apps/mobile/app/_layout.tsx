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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppState, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AmbientGlow } from "@/components/ambient-glow";
import { AnalyticsScreenTracker } from "@/components/analytics-screen-tracker";
import { AnimatedSplash } from "@/components/animated-splash";
import { ToastHost } from "@/components/ui/toast-host";
import { WatchBridgeHost } from "@/components/watch-bridge-host";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useDeepLinks } from "@/hooks/use-deep-links";
import { useLiveActivityActions } from "@/hooks/use-live-activity-actions";
import { useWorkoutLiveActivity } from "@/hooks/use-workout-live-activity";
import { flushHealthRetryQueue } from "@/lib/health";
import { flushPostHog } from "@/lib/posthog";
import { queryClient } from "@/lib/query-client";
import { configureRestTimerNotificationHandler } from "@/lib/rest-timer-notifications";
import { registerSyncHandlers } from "@/lib/sync-handlers";
import { syncQueue } from "@/lib/sync-queue";
import { useAuthStore } from "@/stores/auth-store";
import NetInfo from "@react-native-community/netinfo";

SplashScreen.preventAutoHideAsync();
configureRestTimerNotificationHandler();

export const unstable_settings = {
  anchor: "(tabs)",
};

/**
 * The Live Activity host must be inside QueryClientProvider because it resolves
 * localized exercise names through TanStack Query. It is intentionally mounted
 * at the root so route changes cannot tear down an active workout activity.
 */
function WorkoutLiveActivityHost() {
  useWorkoutLiveActivity();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation("common");
  const colors = Colors[colorScheme ?? "light"];
  const initialize = useAuthStore((s) => s.initialize);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const [splashDone, setSplashDone] = useState(false);
  const handleSplashFinish = useCallback(() => setSplashDone(true), []);

  // Global handler for sweaty:// deep links (e.g. Live Activity "Mark set done").
  // Registered at the root so it fires regardless of the active route.
  useDeepLinks();

  // Drain background-safe Live Activity actions (Skip Rest, Adjust Rest, …)
  // queued in the shared App Group by widget App Intents.
  useLiveActivityActions();

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

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
        flushHealthRetryQueue().catch((error) => {
          console.warn("Health retry queue flush failed:", error);
        });
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
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <View style={[styles.root, { backgroundColor: colors.background }]}>
          <AmbientGlow variant="hero" />
          <QueryClientProvider client={queryClient}>
            <WorkoutLiveActivityHost />
            <WatchBridgeHost />
            <ThemeProvider value={theme}>
              <AnalyticsScreenTracker />
              <Stack
                screenOptions={{
                  contentStyle: styles.transparent,
                  headerShown: false,
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
                  options={{
                    presentation: "modal",
                    title: t("nav.designSystem"),
                  }}
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
                    presentation: "fullScreenModal",
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
                <Stack.Screen
                  name="exercise-detail"
                  options={{
                    presentation: "fullScreenModal",
                    headerShown: false,
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="statistics"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="workout-preview"
                  options={{
                    presentation: "fullScreenModal",
                    headerShown: false,
                    gestureEnabled: true,
                  }}
                />
                <Stack.Screen
                  name="training-preferences"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="strength-baselines"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="measurements"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="health-settings"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="feedback"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="account-settings"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="delete-account"
                  options={{ headerShown: false }}
                />
              </Stack>
              <ToastHost />
              <StatusBar style="auto" />
            </ThemeProvider>
          </QueryClientProvider>
          {!splashDone && (
            <AnimatedSplash
              appReady={isInitialized}
              onFinish={handleSplashFinish}
            />
          )}
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  transparent: { backgroundColor: "transparent" },
});
