import { Text, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { OnboardingScreen } from "@/components/onboarding/screen";
import { OptionChips } from "@/components/generate-workout/option-chips";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { Typography, Spacing } from "@/constants/theme";
export default function FrequencyScreen() {
  const { t } = useTranslation("onboarding");
  const { frequency, setFrequency, sessionDuration, setSessionDuration } =
    useOnboardingStore();
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  return (
    <OnboardingScreen
      step="frequency"
      title={t("frequency.title")}
      subtitle={t("frequency.subtitle")}
      canContinue={frequency !== null && sessionDuration !== null}
    >
      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[Typography.titleSm, { color: text }]}
        >
          {t("frequency.days")}
        </Text>
        <OptionChips
          selected={frequency}
          onSelect={setFrequency}
          options={([1, 2, 3, 4, 5] as const).map((value) => ({
            value,
            label:
              value === 1
                ? t("frequency.once")
                : value === 5
                  ? t("frequency.fivePlus")
                  : t("frequency.dayCount", { count: value }),
          }))}
        />
        {frequency === 5 && (
          <Text style={[Typography.caption, { color: secondary }]}>
            {t("frequency.fiveHint")}
          </Text>
        )}
      </View>
      <View style={styles.section}>
        <Text
          accessibilityRole="header"
          style={[Typography.titleSm, { color: text }]}
        >
          {t("frequency.duration")}
        </Text>
        <OptionChips
          selected={sessionDuration}
          onSelect={setSessionDuration}
          options={([15, 30, 45, 60, 90] as const).map((value) => ({
            value,
            label: t("frequency.minutes", { count: value }),
          }))}
        />
      </View>
    </OnboardingScreen>
  );
}
const styles = StyleSheet.create({
  section: { gap: Spacing.md, marginBottom: Spacing["2xl"] },
});
