import { useOnboardingStore } from "@/stores/onboarding-store";
import type { StrengthBaseline } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { StrengthBaselineForm } from "@/components/strength-baseline-form";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

export default function StrengthScreen() {
  const { equipment, experience, strengthBaselines, setStrengthBaselines } =
    useOnboardingStore();
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");

  function handleContinue() {
    trackEvent("onboarding_step_completed", {
      step: "strength",
      skipped: strengthBaselines.length === 0,
    });
    strengthBaselines.forEach((baseline) => {
      trackEvent("strength_baseline_entered", {
        exercise_key: baseline.exercise_key,
        has_load: baseline.load_kg !== null,
        source: "onboarding",
      });
    });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/review");
    }
  }

  function handleSkip() {
    trackEvent("onboarding_step_completed", {
      step: "strength",
      skipped: true,
    });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/review");
    }
  }

  function handleBaselinesChange(baselines: StrengthBaseline[]) {
    setStrengthBaselines(baselines);
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressRow}>
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[Typography.label, { color: textMuted }, styles.stepLabel]}
          >
            STEP 6 OF 6
          </Text>
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
          >
            Help us pick the right weights
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            Enter what you can currently do. Skip any you're unsure about.
          </Text>

          <StrengthBaselineForm
            equipment={equipment}
            experience={experience}
            baselines={strengthBaselines}
            onChange={handleBaselinesChange}
          />
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label="Continue"
            onPress={handleContinue}
            accessibilityLabel="Continue to review"
          />
          <Button
            label="Skip this step"
            onPress={handleSkip}
            variant="ghost"
            accessibilityLabel="Skip strength baseline"
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  progressRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  segment: { flex: 1, height: 3, borderRadius: Radii.full },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  stepLabel: { marginBottom: Spacing.sm },
  title: { marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing["3xl"] },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
