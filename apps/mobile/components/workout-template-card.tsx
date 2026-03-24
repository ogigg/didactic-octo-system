import { useThemeColor } from "@/hooks/use-theme-color";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { WorkoutTemplate } from "@/stores/workout-templates-store";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  const exerciseCount = template.exercises.length;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: backgroundSubtle, opacity: pressed ? 0.85 : 1 },
        Elevation.sm,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Start ${template.name}`}
    >
      <Text
        style={[Typography.bodyMedium, { color: textColor }]}
        numberOfLines={2}
      >
        {template.name}
      </Text>
      <Text
        style={[Typography.caption, { color: textMuted }, styles.exerciseCount]}
      >
        {exerciseCount === 1
          ? `${exerciseCount} exercise`
          : `${exerciseCount} exercises`}
      </Text>
    </Pressable>
  );
}

interface CreateWorkoutCardProps {
  label: string;
  onPress: () => void;
}

export function CreateWorkoutCard({ label, onPress }: CreateWorkoutCardProps) {
  const primarySurface = useThemeColor({}, "primarySurface");
  const primary = useThemeColor({}, "primary");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        styles.createCard,
        {
          backgroundColor: primarySurface,
          borderColor: primary,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.createContent}>
        <IconSymbol name="plus" size={24} color={primary} />
        <Text style={[Typography.caption, { color: primary }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    minHeight: CARD_MIN_HEIGHT,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    justifyContent: "flex-end",
  },
  createCard: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  createContent: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  exerciseCount: {
    marginTop: Spacing.xs,
  },
});
