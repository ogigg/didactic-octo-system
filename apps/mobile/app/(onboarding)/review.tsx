import { useOnboardingStore } from "@/stores/onboarding-store";
import type { Frequency, Gender, Goal } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const GENDER_LABELS: Record<Gender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

const GOAL_LABELS: Record<Goal, string> = {
  build_strength: "Build Strength",
  lose_weight: "Lose Weight",
  improve_fitness: "Improve Fitness",
};

const FREQ_LABELS: Record<Frequency, string> = {
  2: "2 days per week",
  3: "3 days per week",
  4: "4 days per week",
  5: "5+ days per week",
};

export default function ReviewScreen() {
  const store = useOnboardingStore();
  // useFocusEffect ensures the component re-renders with fresh store state
  // each time this screen regains focus (e.g. returning from edit mode).
  useFocusEffect(useCallback(() => undefined, []));

  const {
    gender,
    genderSkipped: _genderSkipped,
    goal,
    customGoal,
    frequency,
    complete,
  } = store;

  const background = useThemeColor({}, "background");
  const glow = useThemeColor({}, "glow");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  const goalDisplay = customGoal ?? (goal ? GOAL_LABELS[goal] : null);
  const showGender = gender !== null;

  function handleEdit(step: "gender" | "goal" | "frequency") {
    router.push({
      pathname: `/(onboarding)/${step}`,
      params: { editMode: "1" },
    } as never);
  }

  function handleSubmit() {
    complete();
    trackEvent("onboarding_completed", {});
    router.replace("/(tabs)" as never);
  }

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      <View
        pointerEvents="none"
        style={[styles.glow, { backgroundColor: glow }]}
      />
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text
            style={[Typography.titleLg, { color: textColor }, styles.title]}
          >
            Looking good!
          </Text>
          <Text
            style={[Typography.body, { color: textSecondary }, styles.subtitle]}
          >
            {"Here's what we know about you."}
          </Text>

          {showGender && (
            <ReviewCard
              label="GENDER"
              value={GENDER_LABELS[gender!]}
              onEdit={() => handleEdit("gender")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}

          {goalDisplay && (
            <ReviewCard
              label="GOAL"
              value={goalDisplay}
              onEdit={() => handleEdit("goal")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}

          {frequency !== null && (
            <ReviewCard
              label="FREQUENCY"
              value={FREQ_LABELS[frequency]}
              onEdit={() => handleEdit("frequency")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}
        </ScrollView>

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleSubmit}
            style={[styles.submitBtn, { backgroundColor: primary }]}
            accessibilityRole="button"
            accessibilityLabel="Let's start working out!"
          >
            <Text style={styles.submitBtnText}>
              {"Let's start working out!"}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ReviewCard({
  label,
  value,
  onEdit,
  primary,
  textColor,
  textMuted,
  backgroundSubtle,
}: {
  label: string;
  value: string;
  onEdit: () => void;
  primary: string;
  textColor: string;
  textMuted: string;
  backgroundSubtle: string;
}) {
  return (
    <View style={[styles.card, { backgroundColor: backgroundSubtle }]}>
      <View style={styles.cardContent}>
        <Text style={[Typography.label, { color: textMuted }]}>{label}</Text>
        <Text style={[Typography.body, { color: textColor }, styles.cardValue]}>
          {value}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`Edit ${label.toLowerCase()}`}
      >
        <Text style={[Typography.body, { color: primary }]}>Edit</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: "absolute",
    top: -100,
    alignSelf: "center",
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  safe: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.xl },
  title: { marginTop: Spacing["3xl"], marginBottom: Spacing.sm },
  subtitle: { marginBottom: Spacing["3xl"] },
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: Radii.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardContent: { flex: 1 },
  cardValue: { marginTop: Spacing.xs },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  submitBtn: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  submitBtnText: { ...Typography.titleSm, color: "#FFFFFF" },
});
