import { StyleSheet, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { OnboardingChoice } from "@/components/onboarding/choice";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { isValidCustomGoal, MAX_CUSTOM_GOAL_LENGTH } from "@/lib/profanity";
import { Spacing, Radii, Typography } from "@/constants/theme";
export default function GoalScreen() {
  const { t } = useTranslation("onboarding");
  const { goal, customGoal, setGoal, setCustomGoal } = useOnboardingStore();
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const fill = useThemeColor({}, "inputFill");
  const error = useThemeColor({}, "error");
  const customValid = isValidCustomGoal(customGoal);
  return (
    <OnboardingScreen
      step="goal"
      title={t("goal.title")}
      subtitle={t("goal.subtitle")}
      canContinue={goal !== null || customValid}
    >
      {(
        [
          "build_strength",
          "build_muscle",
          "lose_weight",
          "improve_fitness",
        ] as const
      ).map((value) => (
        <OnboardingChoice
          key={value}
          label={t(`goal.${value}`)}
          selected={goal === value}
          onPress={() => setGoal(value)}
        />
      ))}
      <Text style={[Typography.body, { color: text }]}>{t("goal.custom")}</Text>
      <TextInput
        style={[styles.input, { color: text, backgroundColor: fill }]}
        placeholder={t("goal.placeholder")}
        placeholderTextColor={secondary}
        value={customGoal ?? ""}
        onChangeText={setCustomGoal}
        maxLength={MAX_CUSTOM_GOAL_LENGTH}
        accessibilityLabel={t("goal.custom")}
        returnKeyType="done"
      />
      {customGoal && !customValid ? (
        <Text
          accessibilityRole="alert"
          style={[Typography.caption, { color: error }]}
        >
          {t("goal.invalid")}
        </Text>
      ) : null}
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  input: {
    ...Typography.body,
    minHeight: 48,
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginVertical: Spacing.sm,
  },
});
