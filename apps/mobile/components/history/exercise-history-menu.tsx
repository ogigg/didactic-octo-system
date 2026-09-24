import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ExerciseHistoryMenuProps {
  visible: boolean;
  exerciseName: string;
  dateLabel: string;
  setCount: number;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ExerciseHistoryMenu({
  visible,
  exerciseName,
  dateLabel,
  setCount,
  onClose,
  onEdit,
  onDelete,
}: ExerciseHistoryMenuProps) {
  const { t } = useTranslation("history");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const error = useThemeColor({}, "error");
  const border = useThemeColor({}, "border");

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("detail.exerciseMenu.close")}
      height={280}
      testID="exercise-history-menu"
    >
      <View style={styles.preview}>
        <Text style={[Typography.titleSm, { color: text }]} numberOfLines={2}>
          {exerciseName}
        </Text>
        <Text style={[Typography.caption, { color: textSecondary }]}>
          {t("detail.exerciseMenu.preview", {
            date: dateLabel,
            count: setCount,
          })}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("detail.exerciseMenu.edit")}
        onPress={() => sheetRef.current?.dismiss(onEdit)}
        style={[styles.option, { borderTopColor: border }]}
      >
        <IconSymbol name="pencil" size={20} color={textSecondary} />
        <Text style={[Typography.titleSm, { color: text }]}>
          {t("detail.exerciseMenu.edit")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("detail.exerciseMenu.delete")}
        onPress={() => sheetRef.current?.dismiss(onDelete)}
        style={[styles.option, { borderTopColor: border }]}
      >
        <IconSymbol name="trash" size={20} color={error} />
        <Text style={[Typography.titleSm, { color: error }]}>
          {t("detail.exerciseMenu.delete")}
        </Text>
      </Pressable>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  preview: {
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  option: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: Spacing.md,
    minHeight: 56,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
});
