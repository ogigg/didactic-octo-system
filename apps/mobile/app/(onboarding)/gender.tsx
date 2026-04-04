import { useOnboardingStore } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { router, useLocalSearchParams } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type GenderOption = { label: string; value: "male" | "female" | "other" };

const OPTIONS: GenderOption[] = [
  { label: "Male", value: "male" },
  { label: "Female", value: "female" },
  { label: "Other", value: "other" },
];

export default function GenderScreen() {
  const { gender, setGender, skipGender } = useOnboardingStore();
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  function handleSelect(value: "male" | "female" | "other") {
    setGender(value);
  }

  function handleContinue() {
    trackEvent("onboarding_step_completed", { step: "gender", skipped: false });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/goal");
    }
  }

  function handleSkip() {
    skipGender();
    trackEvent("onboarding_step_completed", { step: "gender", skipped: true });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/goal");
    }
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[Typography.label, { color: textMuted }, styles.stepLabel]}
          >
            STEP 1 OF 6
          </Text>
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
          >
            About you
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            How should we address you? This is optional.
          </Text>

          {OPTIONS.map((opt) => {
            const selected = gender === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => handleSelect(opt.value)}
                style={[
                  styles.row,
                  selected && { backgroundColor: backgroundSubtle },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={opt.label}
              >
                <View style={styles.radioOuter}>
                  {selected && (
                    <View
                      style={[styles.radioInner, { backgroundColor: primary }]}
                    />
                  )}
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: selected ? primary : border },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    Typography.titleSm,
                    { color: selected ? textColor : textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label="Continue"
            onPress={handleContinue}
            accessibilityLabel="Continue to goal selection"
          />
          <Button
            label="Skip this step"
            onPress={handleSkip}
            variant="ghost"
            accessibilityLabel="Skip gender selection, go to goal"
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
  segment: {
    flex: 1,
    height: 3,
    borderRadius: Radii.full,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  stepLabel: { marginBottom: Spacing.sm },
  title: { marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing["3xl"] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: Radii.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircle: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: Radii.full,
    borderWidth: 2,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: Radii.full,
    zIndex: 1,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.md,
  },
});
