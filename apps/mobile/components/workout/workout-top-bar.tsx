import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

interface WorkoutTopBarProps {
  workoutName: string;
  onDismiss: () => void;
  onFinish: () => void;
}

export function WorkoutTopBar({
  workoutName,
  onDismiss,
  onFinish,
}: WorkoutTopBarProps) {
  const { t } = useTranslation("workout");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const border = useThemeColor({}, "border");

  return (
    <View style={[styles.container, { borderBottomColor: border }]}>
      <Pressable
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={t("topBar.finish")}
        hitSlop={12}
        style={styles.dismissButton}
      >
        <IconSymbol name="chevron.down" size={24} color={textSecondary} />
      </Pressable>

      <Text
        style={[Typography.titleMd, { color: textColor }]}
        numberOfLines={1}
      >
        {workoutName}
      </Text>

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
  finishButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
