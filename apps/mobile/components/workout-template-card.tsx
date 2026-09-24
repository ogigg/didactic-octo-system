import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { GradientSurface } from "@/components/ui/gradient-surface";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";

const CARD_WIDTH = 156;
const CARD_MIN_HEIGHT = 96;

interface WorkoutTemplateCardProps {
  template: WorkoutTemplate;
  onPress: () => void;
}

export function WorkoutTemplateCard({
  template,
  onPress,
}: WorkoutTemplateCardProps) {
  const { t } = useTranslation("home");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  const exerciseCount = template.exercises.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={t("myWorkouts.reviewTemplate", {
        name: template.name,
      })}
    >
      <GradientSurface
        variant="surface"
        radius="lg"
        bordered
        style={styles.card}
      >
        <Text
          style={[Typography.bodyMedium, { color: textColor }]}
          numberOfLines={2}
        >
          {template.name}
        </Text>
        <Text
          style={[
            Typography.caption,
            { color: textMuted },
            styles.exerciseCount,
          ]}
        >
          {t("myWorkouts.exerciseCount", { count: exerciseCount })}
        </Text>
      </GradientSurface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    padding: Spacing.lg,
    justifyContent: "flex-end",
  },
  exerciseCount: {
    marginTop: Spacing.xs,
  },
});
