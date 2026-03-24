import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { Exercise } from "@/lib/api/exercises";
import { memo, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ExerciseRowProps {
  exercise: Exercise;
  onSelect: (exercise: Exercise) => void;
  mode?: "replace" | "add";
}

export const ExerciseRow = memo(function ExerciseRow({
  exercise,
  onSelect,
  mode,
}: ExerciseRowProps) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  const handlePress = useCallback(() => {
    onSelect(exercise);
  }, [onSelect, exercise]);

  const primaryMuscle = exercise.primary_muscles[0] ?? "";

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${primaryMuscle}`}
      style={[styles.container, { borderBottomColor: border }]}
    >
      <View style={styles.info}>
        <Text
          style={[Typography.titleSm, { color: textColor }]}
          numberOfLines={1}
        >
          {exercise.name}
        </Text>
        {primaryMuscle ? (
          <Text
            style={[Typography.caption, { color: textSecondary }]}
            numberOfLines={1}
          >
            {primaryMuscle}
          </Text>
        ) : null}
      </View>
      <IconSymbol
        name={mode === "add" ? "plus.circle" : "arrow.triangle.2.circlepath"}
        size={20}
        color={textMuted}
      />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    minHeight: 57,
    borderBottomWidth: 1,
  },
  info: {
    flex: 1,
    gap: 2,
    marginRight: Spacing.md,
  },
});
