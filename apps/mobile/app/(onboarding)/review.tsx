import { useRebuildQueue } from "@/hooks/use-workout-queue";
import { useUpsertProfile } from "@/hooks/use-profile-mutations";
import { mapOnboardingToProfile } from "@/lib/api/profiles";
import { useOnboardingStore } from "@/stores/onboarding-store";
import type {
  Frequency,
  Gender,
  Goal,
  Equipment,
  Experience,
} from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { useOnboardingStepAnalytics } from "@/lib/onboarding-analytics";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { AmbientGlow } from "@/components/ambient-glow";
import { Button } from "@/components/ui/button";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

const EQUIPMENT_LABELS: Record<Equipment, string> = {
  bodyweight: "Home (bodyweight)",
  dumbbells: "Home Gym (dumbbells)",
  full_gym: "Full Gym",
};

const EXPERIENCE_LABELS: Record<Experience, string> = {
  beginner: "Just Starting",
  intermediate: "A Few Months",
  advanced: "Over a Year",
};

const BASELINE_LABELS: Record<string, string> = {
  pushups: "Push-ups",
  pullups: "Pull-ups",
  db_bench: "DB Bench Press",
  db_row: "DB Row",
  bb_bench: "BB Bench Press",
  bb_squat: "BB Squat",
  deadlift: "Deadlift",
};

type EditStep =
  | "gender"
  | "goal"
  | "frequency"
  | "equipment"
  | "experience"
  | "strength";

export default function ReviewScreen() {
  const store = useOnboardingStore();
  const upsertProfile = useUpsertProfile();
  const rebuildQueue = useRebuildQueue();
  useFocusEffect(useCallback(() => undefined, []));
  useOnboardingStepAnalytics("review");

  const {
    gender,
    genderSkipped: _genderSkipped,
    goal,
    customGoal,
    frequency,
    equipment,
    experience,
    strengthBaselines,
    complete,
  } = store;

  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  const goalDisplay = customGoal ?? (goal ? GOAL_LABELS[goal] : null);
  const showGender = gender !== null;

  const baselineSummary =
    strengthBaselines.length > 0
      ? strengthBaselines
          .map((b) => {
            const label = BASELINE_LABELS[b.exercise_key] ?? b.exercise_key;
            if (b.load_kg !== null) {
              return `${label}: ${b.load_kg}kg × ${b.reps}`;
            }
            return `${label}: ${b.reps} reps`;
          })
          .join(", ")
      : null;

  function handleEdit(step: EditStep) {
    router.push({
      pathname: `/(onboarding)/${step}`,
      params: { editMode: "1" },
    } as never);
  }

  function handleSubmit() {
    if (frequency === null || equipment === null || experience === null) return;

    const startedAt = store.onboardingStartedAt;
    const startedAtMs = startedAt ? Date.parse(startedAt) : Number.NaN;
    const durationSeconds = Number.isFinite(startedAtMs)
      ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000))
      : undefined;

    const onboardingPayload = {
      gender,
      goal,
      customGoal,
      frequency,
      equipment,
      experience,
      strengthBaselines,
    };

    upsertProfile.mutate(onboardingPayload, {
      onSuccess: () => {
        const profilePayload = mapOnboardingToProfile(onboardingPayload);

        rebuildQueue.mutate({
          count: frequency,
          preferences: {
            training_split: profilePayload.training_split,
            session_duration_minutes: profilePayload.session_duration_minutes,
            equipment: profilePayload.equipment_level,
            training_style: profilePayload.training_style,
            difficulty: profilePayload.difficulty_level,
          },
          baselines: strengthBaselines,
          trigger: "onboarding",
        });

        complete();
        const completionPayload = {
          goal_category: goal ?? "custom",
          weekly_frequency: frequency,
          equipment,
          experience,
          baseline_count: strengthBaselines.length,
        };
        if (durationSeconds !== undefined) {
          Object.assign(completionPayload, {
            duration_seconds: durationSeconds,
          });
        }
        trackEvent("onboarding_completed", completionPayload);
        router.replace("/(tabs)" as never);
      },
      onError: (error) => {
        trackEvent("onboarding_save_failed", {
          error_code: normalizeOnboardingError(error),
        });
      },
    });
  }

  return (
    <View style={styles.root}>
      <AmbientGlow variant="hero" />
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

          {equipment !== null && (
            <ReviewCard
              label="EQUIPMENT"
              value={EQUIPMENT_LABELS[equipment]}
              onEdit={() => handleEdit("equipment")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}

          {experience !== null && (
            <ReviewCard
              label="EXPERIENCE"
              value={EXPERIENCE_LABELS[experience]}
              onEdit={() => handleEdit("experience")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}

          {baselineSummary && (
            <ReviewCard
              label="STRENGTH BASELINE"
              value={baselineSummary}
              onEdit={() => handleEdit("strength")}
              primary={primary}
              textColor={textColor}
              textMuted={textMuted}
              backgroundSubtle={backgroundSubtle}
            />
          )}
        </ScrollView>

        <View style={styles.actions}>
          <Button label="Let's start working out!" onPress={handleSubmit} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function normalizeOnboardingError(
  error: unknown
): "network" | "validation" | "unauthorized" | "rate_limited" | "unknown" {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  ) {
    return "network";
  }
  if (message.includes("unauthorized") || message.includes("jwt")) {
    return "unauthorized";
  }
  if (message.includes("rate") || message.includes("too many")) {
    return "rate_limited";
  }
  if (
    message.includes("invalid") ||
    message.includes("required") ||
    message.includes("constraint")
  ) {
    return "validation";
  }
  return "unknown";
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
  cardContent: { flex: 1, marginRight: Spacing.md },
  cardValue: { marginTop: Spacing.xs },
  actions: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
});
