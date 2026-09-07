import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import {
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/stores/onboarding-store";
import { useOnboardingStepAnalytics } from "@/lib/onboarding-analytics";
import { trackEvent } from "@/lib/track-event";
interface OnboardingScreenProps {
  step: (typeof ONBOARDING_STEPS)[number];
  title: string;
  subtitle: string;
  children: ReactNode;
  canContinue?: boolean;
  onSubmit?: () => void;
  saving?: boolean;
  error?: boolean;
}
export function OnboardingScreen({
  step,
  title,
  subtitle,
  children,
  canContinue = true,
  onSubmit,
  saving = false,
  error = false,
}: OnboardingScreenProps) {
  const { t } = useTranslation("onboarding");
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();
  useOnboardingStepAnalytics(step as OnboardingStep, editMode);
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");
  const index = ONBOARDING_STEPS.indexOf(step);
  function next() {
    if (!canContinue || saving) return;
    if (onSubmit) {
      onSubmit();
      return;
    }
    trackEvent("onboarding_step_completed", {
      step,
      step_index: index + 1,
      edit_mode: editMode === "1",
      skipped: false,
    });
    if (editMode === "1") router.back();
    else router.push(`/(onboarding)/${ONBOARDING_STEPS[index + 1]}` as never);
  }
  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView style={styles.root}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text
              accessibilityRole="header"
              style={[Typography.titleLg, { color: text }]}
            >
              {title}
            </Text>
            <Text
              style={[Typography.body, styles.subtitle, { color: secondary }]}
            >
              {subtitle}
            </Text>
            {children}
          </ScrollView>
          <View style={styles.actions}>
            {error && (
              <Text
                accessibilityRole="alert"
                style={[Typography.body, { color: errorColor }]}
              >
                {t("review.error")}
              </Text>
            )}
            <Button
              label={t(
                saving
                  ? "actions.saving"
                  : onSubmit
                    ? "actions.create"
                    : editMode === "1"
                      ? "actions.save"
                      : "actions.continue"
              )}
              onPress={next}
              disabled={!canContinue}
              loading={saving}
            />
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flexGrow: 1, padding: Spacing.xl, paddingTop: Spacing["2xl"] },
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
