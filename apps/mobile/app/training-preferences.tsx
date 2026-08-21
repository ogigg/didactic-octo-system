import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";

import { ScreenHeader } from "@/components/ui/screen-header";
import { Button } from "@/components/ui/button";
import { OptionChips } from "@/components/generate-workout/option-chips";
import { CustomPromptInput } from "@/components/generate-workout/custom-prompt-input";
import { PromptSuggestions } from "@/components/generate-workout/prompt-suggestions";
import { AmbientGlow } from "@/components/ambient-glow";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useProfile } from "@/hooks/use-profile-query";
import { useRebuildQueue } from "@/hooks/use-workout-queue";
import { updateTrainingPreferences } from "@/lib/api/profiles";
import { trackEvent } from "@/lib/track-event";
import type { WeightUnit } from "@/lib/unit-conversion";
import type {
  Difficulty,
  DurationMinutes,
  Equipment,
  TrainingStyle,
  TrainingSplit,
} from "@/lib/api/generate-workout";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { profileKeys } from "@/lib/query-keys";

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

const STYLE_OPTIONS: { value: TrainingStyle; label: string }[] = [
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

const UNIT_OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "Kilograms (kg)" },
  { value: "lbs", label: "Pounds (lbs)" },
];

/** 0 = Auto (equipment-based defaults). */
const BASE_STEP_OPTIONS = [0, 1, 1.25, 2, 2.5, 4, 5];

/** 0 = None. Applied on top of the load step (e.g. magnetic micro-plates). */
const MICRO_STEP_OPTIONS = [0, 0.5, 1, 1.1, 1.25, 2];

function formatKgLabel(value: number, kgTemplate: string): string {
  return kgTemplate.replace("{{value}}", String(value));
}

export default function TrainingPreferencesScreen() {
  const { t } = useTranslation("trainingPreferences");
  const router = useRouter();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const rebuildQueue = useRebuildQueue();

  const textColor = useThemeColor({}, "text");
  const textSecondaryColor = useThemeColor({}, "textSecondary");
  const background = useThemeColor({}, "background");
  const border = useThemeColor({}, "border");
  const errorColor = useThemeColor({}, "error");

  // Pre-fill from profile
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit>(
    (profile?.training_split as TrainingSplit) ?? "full_body"
  );
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
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(
    (profile?.weight_unit as WeightUnit) ?? "kg"
  );
  const [baseStep, setBaseStep] = useState<number>(
    profile?.weight_increment_kg ?? 0
  );
  const [microStep, setMicroStep] = useState<number>(
    profile?.weight_micro_increment_kg ?? 0
  );

  const splitOptions: { value: TrainingSplit; label: string }[] = [
    { value: "full_body", label: t("trainingSplit.fullBody") },
    { value: "upper_lower", label: t("trainingSplit.upperLower") },
    { value: "push_pull_legs", label: t("trainingSplit.pushPullLegs") },
  ];

  const promptSuggestions = [
    t("promptSuggestions.trainForMuscleUp"),
    t("promptSuggestions.strengthenLowerBack"),
    t("promptSuggestions.improveRunningEndurance"),
    t("promptSuggestions.buildBiggerArms"),
  ];

  const kgTemplate = t("weightIncrements.kg");
  const baseStepOptions = BASE_STEP_OPTIONS.map((value) => ({
    value,
    label:
      value === 0
        ? t("weightIncrements.baseStep.auto")
        : formatKgLabel(value, kgTemplate),
  }));
  const microStepOptions = MICRO_STEP_OPTIONS.map((value) => ({
    value,
    label:
      value === 0
        ? t("weightIncrements.microStep.none")
        : formatKgLabel(value, kgTemplate),
  }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const prefs = {
        training_split: trainingSplit,
        session_duration_minutes: duration,
        equipment_level: equipment,
        training_style: trainingStyle,
        difficulty_level: difficulty,
        training_custom_prompt: customPrompt.trim() || null,
        weight_unit: weightUnit,
        weight_increment_kg: baseStep > 0 ? baseStep : null,
        weight_micro_increment_kg:
          baseStep > 0 && microStep > 0 ? microStep : null,
      };
      await updateTrainingPreferences(prefs);
      return prefs;
    },
    onSuccess: (prefs) => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all });

      const changedFields = [
        profile?.training_split !== prefs.training_split
          ? "training_split"
          : null,
        profile?.session_duration_minutes !== prefs.session_duration_minutes
          ? "session_duration_minutes"
          : null,
        profile?.equipment_level !== prefs.equipment_level
          ? "equipment_level"
          : null,
        profile?.training_style !== prefs.training_style
          ? "training_style"
          : null,
        profile?.difficulty_level !== prefs.difficulty_level
          ? "difficulty_level"
          : null,
        profile?.training_custom_prompt !== prefs.training_custom_prompt
          ? "training_custom_prompt"
          : null,
        profile?.weight_unit !== prefs.weight_unit ? "weight_unit" : null,
        profile?.weight_increment_kg !== prefs.weight_increment_kg
          ? "weight_increment_kg"
          : null,
        profile?.weight_micro_increment_kg !== prefs.weight_micro_increment_kg
          ? "weight_micro_increment_kg"
          : null,
      ].filter((value): value is string => value !== null);

      const onlyUnitChanged =
        changedFields.length === 1 && changedFields[0] === "weight_unit";

      trackEvent("training_preferences_changed", {
        changed_fields: changedFields,
        triggered_queue_rebuild: !onlyUnitChanged,
      });

      if (onlyUnitChanged) {
        Alert.alert("", t("success"));
        router.back();
        return;
      }

      // Trigger queue rebuild
      const frequency = profile?.weekly_frequency;
      const count = frequency
        ? frequency === "5_plus"
          ? 5
          : parseInt(frequency, 10)
        : 3;

      rebuildQueue.mutate({
        count,
        preferences: {
          training_split: prefs.training_split,
          session_duration_minutes: prefs.session_duration_minutes,
          equipment: prefs.equipment_level,
          training_style: prefs.training_style,
          difficulty: prefs.difficulty_level,
        },
        baselines: [],
        trigger: "preference_change",
      });

      Alert.alert("", t("success"));
      router.back();
    },
  });

  function handleSave() {
    // If only weight_unit changed, no need to rebuild workouts
    const trainingFieldsChanged =
      profile?.training_split !== trainingSplit ||
      profile?.session_duration_minutes !== duration ||
      profile?.equipment_level !== equipment ||
      profile?.training_style !== trainingStyle ||
      profile?.difficulty_level !== difficulty ||
      profile?.training_custom_prompt !== (customPrompt.trim() || null) ||
      profile?.weight_increment_kg !== (baseStep > 0 ? baseStep : null) ||
      profile?.weight_micro_increment_kg !==
        (baseStep > 0 && microStep > 0 ? microStep : null);

    if (!trainingFieldsChanged) {
      saveMutation.mutate();
      return;
    }

    Alert.alert(t("rebuildWarning.title"), t("rebuildWarning.message"), [
      { text: t("rebuildWarning.cancel"), style: "cancel" },
      {
        text: t("rebuildWarning.confirm"),
        style: "destructive",
        onPress: () => saveMutation.mutate(),
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <AmbientGlow variant="subtle" />
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <ScreenHeader
          title={t("header.title")}
          titleStyle={Typography.titleMd}
        />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          {/* Weight Unit */}
          <SectionTitle title={t("weightUnit.title")} textColor={textColor} />
          <OptionChips
            options={UNIT_OPTIONS}
            selected={weightUnit}
            onSelect={setWeightUnit}
            layout="wrap"
          />

          {/* Training Split */}
          <SectionTitle
            title={t("trainingSplit.title")}
            textColor={textColor}
          />
          <OptionChips
            options={splitOptions}
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
            options={STYLE_OPTIONS}
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

          {/* Weight Increments */}
          <SectionTitle
            title={t("weightIncrements.title")}
            textColor={textColor}
          />
          <Text style={[styles.sectionSubtitle, { color: textSecondaryColor }]}>
            {t("weightIncrements.subtitle")}
          </Text>
          <Text
            style={[styles.stepLabel, { color: textColor }]}
            accessibilityRole="header"
          >
            {t("weightIncrements.baseStep.title")}
          </Text>
          <OptionChips
            options={baseStepOptions}
            selected={baseStep}
            onSelect={(value) => {
              setBaseStep(value);
              if (value === 0) setMicroStep(0);
            }}
            layout="wrap"
          />
          <Text
            style={[styles.stepLabel, { color: textColor }]}
            accessibilityRole="header"
          >
            {t("weightIncrements.microStep.title")}
          </Text>
          <OptionChips
            options={microStepOptions}
            selected={microStep}
            onSelect={setMicroStep}
            layout="wrap"
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

        {/* Error */}
        {saveMutation.error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>
            {t("error")}
          </Text>
        ) : null}

        {/* Save CTA */}
        <View style={[styles.ctaContainer, { backgroundColor: background }]}>
          <Button
            label={saveMutation.isPending ? t("save.saving") : t("save.button")}
            onPress={handleSave}
            disabled={saveMutation.isPending}
            accessibilityLabel={t("save.button")}
          />
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
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.lg },
  sectionTitle: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing["2xl"],
    paddingBottom: Spacing.md,
  },
  sectionSubtitle: {
    ...Typography.bodyMedium,
    paddingHorizontal: Spacing.xl,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  stepLabel: {
    ...Typography.bodyMedium,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  ctaContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  errorText: {
    ...Typography.caption,
    textAlign: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  bottomPadding: { height: Spacing.lg },
});
