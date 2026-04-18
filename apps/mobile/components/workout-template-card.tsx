import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { GradientSurface } from "@/components/ui/gradient-surface";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { Pressable, StyleSheet, Text } from "react-native";

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
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  const exerciseCount = template.exercises.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`Start ${template.name}`}
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
          {exerciseCount === 1
            ? `${exerciseCount} exercise`
            : `${exerciseCount} exercises`}
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
