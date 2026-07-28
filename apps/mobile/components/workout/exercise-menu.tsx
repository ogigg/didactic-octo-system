import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

interface ExerciseMenuProps {
  visible: boolean;
  exerciseName: string;
  currentPreference?: ExercisePreferenceValue | null;
  onClose: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onPreferenceSelect?: () => void;
  onReorder: () => void;
}

export function ExerciseMenu({
  visible,
  exerciseName,
  currentPreference,
  onClose,
  onReplace,
  onRemove,
  onPreferenceSelect,
  onReorder,
}: ExerciseMenuProps) {
  const { t } = useTranslation("workout");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");
  const border = useThemeColor({}, "border");

  const preferenceIcon: "heart" | "heart.fill" | "hand.thumbsdown" | "nosign" =
    currentPreference === "preferred"
      ? "heart.fill"
      : currentPreference === "soft_dislike"
        ? "hand.thumbsdown"
        : currentPreference === "hard_dislike"
          ? "nosign"
          : "heart";

  const options = [
    ...(onPreferenceSelect
      ? [
          {
            label: t("menu.preference", { ns: "exercisePreference" }),
            icon: preferenceIcon,
            color: textSecondary,
            onPress: () => {
              sheetRef.current?.dismiss(onPreferenceSelect);
            },
          },
        ]
      : []),
    {
      label: t("menu.reorder"),
      icon: "arrow.up.arrow.down" as const,
      color: textSecondary,
      onPress: () => {
        sheetRef.current?.dismiss(onReorder);
      },
    },
    {
      label: t("menu.replace"),
      icon: "arrow.triangle.2.circlepath" as const,
      color: textSecondary,
      onPress: () => {
        sheetRef.current?.dismiss(onReplace);
      },
    },
    {
      label: t("menu.remove"),
      icon: "trash" as const,
      color: errorColor,
      onPress: () => {
        sheetRef.current?.dismiss(onRemove);
      },
      destructive: true,
    },
  ];

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("menu.close")}
      testID="exercise-menu-sheet"
    >
      <Text
        style={[Typography.titleSm, { color: textColor }, styles.sheetTitle]}
      >
        {exerciseName}
      </Text>
      {options.map((option, index) => (
        <Pressable
          key={option.label}
          onPress={option.onPress}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          style={[
            styles.option,
            index === options.length - 1 && {
              borderTopWidth: 1,
              borderTopColor: border,
              marginTop: Spacing.xs,
              paddingTop: Spacing.lg,
            },
          ]}
        >
          <IconSymbol name={option.icon} size={20} color={option.color} />
          <Text
            style={[
              Typography.titleSm,
              { color: option.destructive ? errorColor : textColor },
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
});
