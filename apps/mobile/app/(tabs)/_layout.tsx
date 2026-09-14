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

import {
  FORCE_PROFILE_GATE,
  ProfileGate,
} from "@/components/auth/profile-gate";
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
  if (FORCE_PROFILE_GATE) return <ProfileGate />;
  if (!isInitialized || profileStatus !== "ready") return <ProfileGate />;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (isAuthenticated && !completed)
    return <Redirect href={`/(onboarding)/${nextStep()}` as never} />;

  if (isInitialized && !isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <NativeTabs
      disableTransparentOnScrollEdge
      iconColor={Colors[colorScheme ?? "light"].textSecondary}
      indicatorColor={Colors[colorScheme ?? "light"].primarySurface}
      minimizeBehavior="onScrollDown"
      tintColor={Colors[colorScheme ?? "light"].primary}
    >
      <NativeTabs.Trigger name="index">
        <Label>{t("nav.home")}</Label>
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="home" />}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <Label>{t("nav.calendar")}</Label>
        <Icon
          sf="calendar"
          androidSrc={
            <VectorIcon family={MaterialIcons} name="calendar-today" />
          }
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>{t("nav.profile")}</Label>
        <Icon
          sf={{ default: "person", selected: "person.fill" }}
          androidSrc={<VectorIcon family={MaterialIcons} name="person" />}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
