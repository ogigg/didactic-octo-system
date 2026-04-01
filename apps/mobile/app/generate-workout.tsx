import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { OptionChips } from "@/components/generate-workout/option-chips";
import { CustomPromptInput } from "@/components/generate-workout/custom-prompt-input";
import { PromptSuggestions } from "@/components/generate-workout/prompt-suggestions";
import { useGenerateWorkout } from "@/hooks/use-generate-workout";
import { useProfile } from "@/hooks/use-profile-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import type {
  Difficulty,
  DurationMinutes,
  Equipment,
  TrainingStyle,
  TrainingSplit,
} from "@/lib/api/generate-workout";

type Frequency = "2" | "3" | "4" | "5_plus";

function getRecommendedSplit(
  frequency: string | null | undefined
): TrainingSplit {
  if (!frequency || frequency === "2" || frequency === "3") return "full_body";
  if (frequency === "4") return "upper_lower";
  return "push_pull_legs";
}

function frequencyLabel(frequency: Frequency | null | undefined): string {
  if (!frequency) return "";
  if (frequency === "5_plus") return "5+";
  return frequency;
}

const DURATION_OPTIONS: { value: DurationMinutes; label: string }[] = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
];

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: "bodyweight", label: "Bodyweight" },
  { value: "dumbbells", label: "Dumbbells" },
  { value: "barbell", label: "Barbell" },
  { value: "full_gym", label: "Full Gym" },
];

const TRAINING_STYLE_OPTIONS: { value: TrainingStyle; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "endurance", label: "Endurance" },
  { value: "circuit", label: "Circuit" },
];

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

export default function GenerateWorkoutScreen() {
  const { t } = useTranslation("generateWorkout");
  const { data: profile } = useProfile();

  const frequency = profile?.weekly_frequency as Frequency | null | undefined;
  const recommendedSplit = getRecommendedSplit(frequency);

  const [trainingSplit, setTrainingSplit] =
    useState<TrainingSplit>(recommendedSplit);
  const [duration, setDuration] = useState<DurationMinutes>(
    (profile?.session_duration_minutes as DurationMinutes) ?? 45
  );
  const [equipment, setEquipment] = useState<Equipment>(
    (profile?.equipment_level as Equipment) ?? "full_gym"
  );
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>(
    (profile?.training_style as TrainingStyle) ?? "hypertrophy"
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    (profile?.difficulty_level as Difficulty) ?? "intermediate"
  );
  const [customPrompt, setCustomPrompt] = useState(
    profile?.training_custom_prompt ?? ""
  );

  const textColor = useThemeColor({}, "text");
  const background = useThemeColor({}, "background");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");
  const primary = useThemeColor({}, "primary");
  const textSecondary = useThemeColor({}, "textSecondary");

  const { mutate, isPending, error } = useGenerateWorkout();

  const trainingSplitOptions: { value: TrainingSplit; label: string }[] = [
    {
      value: "full_body",
      label:
        recommendedSplit === "full_body"
          ? `${t("trainingSplit.fullBody")} (${t("trainingSplit.recommended")})`
          : t("trainingSplit.fullBody"),
    },
    {
      value: "upper_lower",
      label:
        recommendedSplit === "upper_lower"
          ? `${t("trainingSplit.upperLower")} (${t("trainingSplit.recommended")})`
          : t("trainingSplit.upperLower"),
    },
    {
      value: "push_pull_legs",
      label:
        recommendedSplit === "push_pull_legs"
          ? `${t("trainingSplit.pushPullLegs")} (${t("trainingSplit.recommended")})`
          : t("trainingSplit.pushPullLegs"),
    },
  ];

  const promptSuggestions = [
    t("promptSuggestions.trainForMuscleUp"),
    t("promptSuggestions.strengthenLowerBack"),
    t("promptSuggestions.improveRunningEndurance"),
    t("promptSuggestions.buildBiggerArms"),
  ];

  function handleStartTraining() {
    mutate({
      preferences: {
        training_split: trainingSplit,
        session_duration_minutes: duration,
        equipment_level: equipment,
        training_style: trainingStyle,
        difficulty_level: difficulty,
        training_custom_prompt: customPrompt.trim() || null,
      },
      request: {
        training_split: trainingSplit,
        duration_minutes: duration,
        equipment,
        training_style: trainingStyle,
        difficulty,
        custom_prompt: customPrompt.trim() || undefined,
      },
    });
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: border }]}>
          <BackButton accessibilityLabel={t("header.back")} />
          <Text style={[Typography.titleMd, { color: textColor }]}>
            {t("header.title")}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Frequency banner */}
          {frequency ? (
            <View
              style={[
                styles.frequencyBanner,
                { backgroundColor: backgroundSubtle },
              ]}
            >
              <Text style={[Typography.bodyMedium, { color: textSecondary }]}>
                {t("frequencyBanner.label", {
                  frequency: frequencyLabel(frequency),
                })}
              </Text>
            </View>
          ) : null}

          {/* Training Split */}
          <SectionTitle
            title={t("trainingSplit.title")}
            textColor={textColor}
          />
          <OptionChips
            options={trainingSplitOptions}
            selected={trainingSplit}
            onSelect={setTrainingSplit}
            layout="wrap"
          />

          {/* Duration */}
          <SectionTitle title={t("duration.title")} textColor={textColor} />
          <OptionChips
            options={DURATION_OPTIONS}
            selected={duration}
            onSelect={setDuration}
            layout="scroll"
          />

          {/* Equipment */}
          <SectionTitle title={t("equipment.title")} textColor={textColor} />
          <OptionChips
            options={EQUIPMENT_OPTIONS}
            selected={equipment}
            onSelect={setEquipment}
            layout="wrap"
          />

          {/* Training Style */}
          <SectionTitle
            title={t("trainingStyle.title")}
            textColor={textColor}
          />
          <OptionChips
            options={TRAINING_STYLE_OPTIONS}
            selected={trainingStyle}
            onSelect={setTrainingStyle}
            layout="wrap"
          />

          {/* Difficulty */}
          <SectionTitle title={t("difficulty.title")} textColor={textColor} />
          <OptionChips
            options={DIFFICULTY_OPTIONS}
            selected={difficulty}
            onSelect={setDifficulty}
            layout="scroll"
          />

          {/* Training Focus */}
          <CustomPromptInput
            value={customPrompt}
            onChangeText={setCustomPrompt}
            titleLabel={t("prompt.title")}
            subtitleLabel={t("prompt.subtitle")}
            placeholder={t("prompt.placeholder")}
            charCountTemplate={t("prompt.charCount")}
          />

          {/* Prompt Suggestions */}
          <PromptSuggestions
            suggestions={promptSuggestions}
            onSelect={setCustomPrompt}
          />

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Error message */}
        {error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {t("generate.error")}
          </Text>
        ) : null}

        {/* Start Training CTA */}
        <View style={[styles.ctaContainer, { backgroundColor: background }]}>
          {isPending ? (
            <View style={styles.loadingContainer}>
              <View
                style={[styles.loadingButton, { backgroundColor: primary }]}
              >
                <ActivityIndicator color="#FFFFFF" />
                <Text style={[Typography.titleSm, { color: "#FFFFFF" }]}>
                  {t("generate.loading")}
                </Text>
              </View>
              <Button
                label="Cancel"
                onPress={() => {}}
                variant="ghost"
                accessibilityLabel="Cancel"
              />
            </View>
          ) : (
            <Button
              label={t("generate.button")}
              onPress={handleStartTraining}
              accessibilityLabel={t("generate.button")}
            />
          )}
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({
  title,
  textColor,
}: {
  title: string;
  textColor: string;
}) {
  return (
    <Text
      style={[Typography.titleSm, { color: textColor }, styles.sectionTitle]}
    >
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerSpacer: { width: 44 },
  frequencyBanner: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.lg },
  sectionTitle: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  loadingContainer: {
    gap: Spacing.sm,
  },
  loadingButton: {
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  errorText: {
    ...Typography.caption,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  bottomPadding: { height: Spacing.lg },
});
