import { useOnboardingStore } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { containsProfanity, MAX_CUSTOM_GOAL_LENGTH } from "@/lib/profanity";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { router, useLocalSearchParams } from "expo-router";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type GoalOption = {
  label: string;
  value: "build_strength" | "lose_weight" | "improve_fitness";
};

const OPTIONS: GoalOption[] = [
  { label: "Build Strength", value: "build_strength" },
  { label: "Lose Weight", value: "lose_weight" },
  { label: "Improve Fitness", value: "improve_fitness" },
];

export default function GoalScreen() {
  const { goal, customGoal, setGoal, setCustomGoal } = useOnboardingStore();
  const { editMode } = useLocalSearchParams<{ editMode?: string }>();

  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  const customGoalValid =
    (customGoal?.trim().length ?? 0) >= 5 &&
    !containsProfanity(customGoal ?? "");
  const canContinue = goal !== null || customGoalValid;

  function handleContinue() {
    if (!canContinue) return;
    trackEvent("onboarding_step_completed", { step: "goal", skipped: false });
    if (editMode === "1") {
      router.back();
    } else {
      router.push("/(onboarding)/frequency");
    }
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
      <SafeAreaView style={styles.safe}>
        <View style={styles.progressRow}>
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: primary }]} />
          <View style={[styles.segment, { backgroundColor: border }]} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text
            style={[Typography.label, { color: textMuted }, styles.stepLabel]}
          >
            STEP 2 OF 3
          </Text>
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
          >
            Your goal
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            What do you want to achieve?
          </Text>

          {OPTIONS.map((opt) => {
            const selected = goal === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                onPress={() => setGoal(opt.value)}
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

          <TextInput
            style={[
              styles.customInput,
              { backgroundColor: borderSubtle, color: textColor },
            ]}
            placeholder="Or type your own goal..."
            placeholderTextColor={textMuted}
            value={customGoal ?? ""}
            onChangeText={setCustomGoal}
            maxLength={MAX_CUSTOM_GOAL_LENGTH}
            returnKeyType="done"
            accessibilityLabel="Custom goal text input"
          />
        </ScrollView>

        <View style={styles.actions}>
          <Button
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            accessibilityLabel="Continue to frequency selection"
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
  radioInner: { width: 10, height: 10, borderRadius: Radii.full, zIndex: 1 },
  customInput: {
    marginTop: Spacing.lg,
    borderRadius: Radii.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
});
