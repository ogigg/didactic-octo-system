import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Redirect } from "expo-router";
import {
  Icon,
  Label,
  NativeTabs,
  VectorIcon,
} from "expo-router/unstable-native-tabs";
import React from "react";
import { useTranslation } from "react-i18next";

import { ProfileGate } from "@/components/auth/profile-gate";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { Colors } from "@/constants/theme";
import { useAuth } from "@/hooks/use-auth";
import { useColorScheme } from "@/hooks/use-color-scheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation("common");
  const { isAuthenticated, isInitialized, profileStatus, isPasswordRecovery } =
    useAuth();

  const completed = useOnboardingStore((s) => s.isCompleted);
  const nextStep = useOnboardingStore((s) => s.getNextUnfinishedStep);
  if (!isInitialized || profileStatus !== "ready") return <ProfileGate />;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (isAuthenticated && !completed)
    return <Redirect href={`/(onboarding)/${nextStep()}` as never} />;

  if (isInitialized && !isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  const colors = Colors[colorScheme ?? "light"];
  // Per-tab selected colors are set explicitly so both the standard and the
  // scroll-edge appearances get `primary`, not only via `tintColor`.
  // On iOS 26 the system ignores unselected-item colors (Liquid Glass).
  const selectedLabelStyle = { color: colors.primary };

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      iconColor={colors.textSecondary}
      indicatorColor={colors.primarySurface}
      labelStyle={{ color: colors.textSecondary }}
      minimizeBehavior="onScrollDown"
      tintColor={colors.primary}
    >
      <NativeTabs.Trigger name="index">
        <Label selectedStyle={selectedLabelStyle}>{t("nav.home")}</Label>
        <Icon
          selectedColor={colors.primary}
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <Label selectedStyle={selectedLabelStyle}>{t("nav.calendar")}</Label>
        <Icon
          selectedColor={colors.primary}
          sf="calendar"
          androidSrc={
            <VectorIcon family={MaterialIcons} name="calendar-today" />
          }
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label selectedStyle={selectedLabelStyle}>{t("nav.profile")}</Label>
        <Icon
          selectedColor={colors.primary}
          sf={{ default: "person", selected: "person.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="person" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
