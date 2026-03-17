import "@/i18n";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import "react-native-reanimated";

import { AmbientGlow } from "@/components/ambient-glow";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation("common");
  const colors = Colors[colorScheme ?? "light"];

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
      <ThemeProvider value={theme}>
        <Stack
          screenOptions={{
            contentStyle: styles.transparent,
          }}
        >
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  transparent: { backgroundColor: "transparent" },
});
