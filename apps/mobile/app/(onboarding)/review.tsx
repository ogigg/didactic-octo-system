import { isValidCustomGoal } from "@/lib/profanity";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { OptionChips } from "@/components/generate-workout/option-chips";
import { useUpsertProfile } from "@/hooks/use-profile-mutations";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { mapOnboardingToProfile } from "@/lib/api/profiles";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Radii, Typography } from "@/constants/theme";
export default function ReviewScreen() {
  const { t } = useTranslation("onboarding");
  const store = useOnboardingStore();
  const save = useUpsertProfile();
  const [adjustStyle, setAdjustStyle] = useState(false);
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const fill = useThemeColor({}, "inputFill");
  const {
    goal,
    customGoal,
    frequency,
    equipment,
    experience,
    sessionDuration,
    trainingStyle,
    constraints,
    setConstraints,
    setTrainingStyle,
  } = store;
  const canSubmit =
    (goal !== null || isValidCustomGoal(customGoal)) &&
    frequency !== null &&
    equipment !== null &&
    experience !== null &&
    sessionDuration !== null;
  const payload = canSubmit
    ? {
        gender: null,
        goal,
        customGoal,
        frequency: frequency!,
        equipment: equipment!,
        experience: experience!,
        sessionDuration: sessionDuration!,
        trainingStyle,
        constraints,
        strengthBaselines: store.strengthBaselines,
      }
    : null;
  const plan = payload ? mapOnboardingToProfile(payload) : null;
  const days =
    frequency === 1
      ? t("frequency.once")
      : frequency === 5
        ? t("frequency.fivePlus")
        : t("frequency.dayCount", { count: frequency ?? 0 });
  const rows = [
    {
      step: "goal",
      label: t("review.goal"),
      value: customGoal ?? (goal ? t(`goal.${goal}`) : "—"),
    },
    {
      step: "equipment",
      label: t("review.equipment"),
      value: equipment ? t(`equipment.${equipment}`) : "—",
    },
    {
      step: "experience",
      label: t("review.experience"),
      value: experience ? t(`experience.${experience}`) : "—",
    },
    {
      step: "frequency",
      label: t("review.schedule"),
      value: t("review.scheduleValue", {
        days,
        minutes: sessionDuration ?? "—",
      }),
    },
  ];
  return (
    <OnboardingScreen
      step="review"
      title={t("review.title")}
      subtitle={t("review.subtitle")}
      canContinue={canSubmit}
      saving={save.isPending}
      error={save.isError}
      onSubmit={() => {
        if (payload && !save.isPending) save.mutate(payload);
      }}
    >
      {rows.map((row) => (
        <Pressable
          key={row.step}
          disabled={save.isPending}
          accessibilityRole="button"
          accessibilityLabel={`${t("actions.edit", { field: row.label })}: ${row.value}`}
          onPress={() =>
            router.push({
              pathname: `/(onboarding)/${row.step}`,
              params: { editMode: "1" },
            } as never)
          }
          style={[styles.row, { borderColor: border }]}
        >
          <View style={styles.copy}>
            <Text style={[Typography.caption, { color: secondary }]}>
              {row.label}
            </Text>
            <Text style={[Typography.bodyMedium, { color: text }]}>
              {row.value}
            </Text>
          </View>
          <Text style={{ color: primary }}>›</Text>
        </Pressable>
      ))}
      {plan && (
        <View style={[styles.plan, { borderColor: border }]}>
          <Text style={[Typography.body, { color: text }]}>
            {t("review.split")}: {t(`review.${plan.training_split}`)}
          </Text>
          <Text style={[Typography.body, { color: text }]}>
            {t("review.style")}: {t(`review.${plan.training_style}`)}
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={save.isPending}
            onPress={() => setAdjustStyle(!adjustStyle)}
            style={styles.adjust}
          >
            <Text style={[Typography.body, { color: primary }]}>
              {t("review.adjustStyle")}
            </Text>
          </Pressable>
          {adjustStyle && (
            <OptionChips
              selected={plan.training_style}
              onSelect={(value) => {
                if (!save.isPending) setTrainingStyle(value);
              }}
              options={(
                ["strength", "hypertrophy", "endurance", "circuit"] as const
              ).map((value) => ({ value, label: t(`review.${value}`) }))}
            />
          )}
        </View>
      )}
      <Text style={[Typography.bodyMedium, { color: text }]}>
        {t("review.constraints")}
      </Text>
      <Text style={[Typography.caption, styles.hint, { color: secondary }]}>
        {t("review.constraintsHint")}
      </Text>
      <TextInput
        editable={!save.isPending}
        value={constraints}
        onChangeText={setConstraints}
        multiline
        maxLength={200}
        accessibilityLabel={t("review.constraints")}
        placeholder={t("review.constraintsPlaceholder")}
        placeholderTextColor={secondary}
        style={[styles.input, { color: text, backgroundColor: fill }]}
      />
      <Text style={[Typography.caption, { color: secondary }]}>
        {t("review.constraintsCount", { count: constraints.length })}
      </Text>
      <Text style={[Typography.caption, styles.hint, { color: secondary }]}>
        {t("review.strengthLater")}
      </Text>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  copy: { flex: 1, gap: Spacing.xs },
  plan: {
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  input: {
    ...Typography.body,
    minHeight: 80,
    padding: Spacing.md,
    borderRadius: Radii.md,
    textAlignVertical: "top",
  },
  hint: { marginVertical: Spacing.md },
  adjust: { minHeight: 44, justifyContent: "center" },
});
