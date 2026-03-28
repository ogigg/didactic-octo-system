import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { OptionChips } from "@/components/generate-workout/option-chips";
import { CustomPromptInput } from "@/components/generate-workout/custom-prompt-input";
import { useGenerateWorkout } from "@/hooks/use-generate-workout";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import type {
  Difficulty,
  DurationMinutes,
  Equipment,
  FocusArea,
  TrainingStyle,
} from "@/lib/api/generate-workout";
import { useState } from "react";
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

const FOCUS_AREA_OPTIONS: { value: FocusArea; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "upper", label: "Upper Body" },
  { value: "lower", label: "Lower Body" },
  { value: "full_body", label: "Full Body" },
];

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

  const [focusArea, setFocusArea] = useState<FocusArea | null>(null);
  const [duration, setDuration] = useState<DurationMinutes>(45);
  const [equipment, setEquipment] = useState<Equipment>("full_gym");
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>("hypertrophy");
  const [difficulty, setDifficulty] = useState<Difficulty>("intermediate");
  const [customPrompt, setCustomPrompt] = useState("");

  const textColor = useThemeColor({}, "text");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");
  const primary = useThemeColor({}, "primary");

  const { mutate, isPending, error } = useGenerateWorkout();

  function handleGenerate() {
    if (!focusArea) return;
    mutate({
      focus_area: focusArea,
      duration_minutes: duration,
      equipment,
      training_style: trainingStyle,
      difficulty,
      custom_prompt: customPrompt.trim() || undefined,
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
          {/* Custom prompt */}
          <CustomPromptInput
            value={customPrompt}
            onChangeText={setCustomPrompt}
            titleLabel={t("prompt.title")}
            subtitleLabel={t("prompt.subtitle")}
            placeholder={t("prompt.placeholder")}
            charCountTemplate={t("prompt.charCount")}
          />

          {/* Focus Area */}
          <SectionTitle title={t("focusArea.title")} textColor={textColor} />
          <OptionChips
            options={FOCUS_AREA_OPTIONS}
            selected={focusArea}
            onSelect={setFocusArea}
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
          <SectionTitle title={t("trainingStyle.title")} textColor={textColor} />
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

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Error message */}
        {error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {t("generate.error")}
          </Text>
        ) : null}

        {/* Generate CTA */}
        <View style={[styles.ctaContainer, { backgroundColor: background }]}>
          {isPending ? (
            <View style={[styles.loadingButton, { backgroundColor: primary }]}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : (
            <Button
              label={t("generate.button")}
              onPress={handleGenerate}
              disabled={!focusArea}
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
    <Text style={[Typography.titleSm, { color: textColor }, styles.sectionTitle]}>
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
  loadingButton: {
    borderRadius: 14,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  errorText: {
    ...Typography.caption,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  bottomPadding: { height: Spacing.lg },
});
