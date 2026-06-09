import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface WorkoutTopBarProps {
  workoutName: string;
  completedSteps: number;
  totalSteps: number;
  hasWarmup?: boolean;
  onDismiss: () => void;
  onFinish: () => void;
  onWorkoutNameChange?: (name: string) => void;
}

export function WorkoutTopBar({
  workoutName,
  completedSteps,
  totalSteps,
  hasWarmup = false,
  onDismiss,
  onFinish,
  onWorkoutNameChange,
}: WorkoutTopBarProps) {
  const { t } = useTranslation("workout");
  const [isEditing, setIsEditing] = useState(false);
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");

  return (
    <View style={[styles.container, { borderBottomColor: border }]}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Minimize workout"
        hitSlop={12}
        style={styles.dismissButton}
      >
        <IconSymbol name="chevron.down" size={24} color={textSecondary} />
      </Pressable>

      <View style={styles.center}>
        {isEditing ? (
          <TextInput
            autoFocus
            value={workoutName}
            onChangeText={(text) => onWorkoutNameChange?.(text)}
            onBlur={() => setIsEditing(false)}
            onSubmitEditing={() => setIsEditing(false)}
            returnKeyType="done"
            selectTextOnFocus
            style={[Typography.titleMd, { color: textColor }]}
          />
        ) : (
          <Pressable onPress={() => setIsEditing(true)}>
            <Text
              style={[Typography.titleMd, { color: textColor }]}
              numberOfLines={1}
            >
              {workoutName}
            </Text>
          </Pressable>
        )}
        <Text style={[Typography.micro, { color: textMuted }]}>
          {t(hasWarmup ? "topBar.progressSteps" : "topBar.progress", {
            completed: completedSteps,
            total: totalSteps,
          })}
        </Text>
      </View>

      <Button
        label={t("topBar.finish")}
        onPress={onFinish}
        variant="primary"
        style={styles.finishButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  dismissButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    alignItems: "center",
    gap: 2,
    flex: 1,
  },
  finishButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
