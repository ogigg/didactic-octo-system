import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
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
  const navigation = useNavigation();
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();
  useOnboardingStepAnalytics(step as OnboardingStep, editMode);
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");
  const index = ONBOARDING_STEPS.indexOf(step);
  const primary = useThemeColor({}, "primary");
  const track = useThemeColor({}, "borderSubtle");
  function back() {
    if (saving) return;
    const target =
      editMode === "1" ? "review" : ONBOARDING_STEPS[Math.max(0, index - 1)];
    const state = navigation.getState();
    const previous = state?.routes[state.index - 1];
    // Parent history may lead to a redirect that opens review again after relaunch.
    // Only pop when the local stack actually contains the intended previous step.
    if (previous?.name === target) navigation.goBack();
    else router.replace(`/(onboarding)/${target}` as never);
  }
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
    if (editMode === "1") back();
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
          <View style={styles.progressHeader}>
            <View style={styles.progressRow}>
              {(index > 0 || editMode === "1") && (
                <Pressable
                  accessibilityRole="button"
                  disabled={saving}
                  onPress={back}
                  style={styles.back}
                >
                  <Text style={[Typography.body, { color: primary }]}>
                    {t("actions.back")}
                  </Text>
                </Pressable>
              )}
              <Text style={[Typography.caption, { color: secondary }]}>
                {t("progress.step", {
                  current: index + 1,
                  total: ONBOARDING_STEPS.length,
                })}
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={t("progress.step", {
                current: index + 1,
                total: ONBOARDING_STEPS.length,
              })}
              accessibilityValue={{
                min: 1,
                max: ONBOARDING_STEPS.length,
                now: index + 1,
              }}
              style={[styles.track, { backgroundColor: track }]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: primary,
                    width: `${((index + 1) / ONBOARDING_STEPS.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
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
  progressHeader: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  progressRow: {
    minHeight: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  back: { minHeight: 44, minWidth: 44, justifyContent: "center" },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: 4 },
  content: { flexGrow: 1, padding: Spacing.xl, paddingTop: Spacing["2xl"] },
  subtitle: { marginTop: Spacing.sm, marginBottom: Spacing.xl },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
