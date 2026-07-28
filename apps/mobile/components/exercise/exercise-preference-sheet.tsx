import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface ExercisePreferenceSheetProps {
  visible: boolean;
  exerciseName: string;
  currentPreference: ExercisePreferenceValue | null;
  onClose: () => void;
  onSelect: (preference: ExercisePreferenceValue | null) => void;
}

const PREFERENCE_OPTIONS: {
  value: ExercisePreferenceValue;
  labelKey: "options.preferred" | "options.softDislike" | "options.hardDislike";
  descriptionKey:
    | "options.preferredDescription"
    | "options.softDislikeDescription"
    | "options.hardDislikeDescription";
  icon: "heart.fill" | "hand.thumbsdown" | "nosign";
  colorKey: "primary" | "textSecondary" | "error";
  destructive?: boolean;
}[] = [
  {
    value: "preferred",
    labelKey: "options.preferred",
    descriptionKey: "options.preferredDescription",
    icon: "heart.fill",
    colorKey: "primary",
  },
  {
    value: "soft_dislike",
    labelKey: "options.softDislike",
    descriptionKey: "options.softDislikeDescription",
    icon: "hand.thumbsdown",
    colorKey: "textSecondary",
  },
  {
    value: "hard_dislike",
    labelKey: "options.hardDislike",
    descriptionKey: "options.hardDislikeDescription",
    icon: "nosign",
    colorKey: "error",
    destructive: true,
  },
];

export function ExercisePreferenceSheet({
  visible,
  exerciseName,
  currentPreference,
  onClose,
  onSelect,
}: ExercisePreferenceSheetProps) {
  const { t } = useTranslation("exercisePreference");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const textSecondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");

  const colorMap = { primary, textSecondary, error: errorColor };

  const handleSelect = (value: ExercisePreferenceValue | null) => {
    sheetRef.current?.dismiss(() => onSelect(value));
  };

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      closeAccessibilityLabel={t("close")}
      testID="exercise-preference-sheet"
    >
      <View style={styles.content}>
        <Text
          style={[Typography.titleSm, { color: textColor }, styles.sheetTitle]}
        >
          {exerciseName}
        </Text>

        {PREFERENCE_OPTIONS.map((option, index) => {
          const isActive = currentPreference === option.value;
          const isDestructive = option.destructive;
          const isFirstDestructive =
            isDestructive && index === PREFERENCE_OPTIONS.length - 1;

          return (
            <Pressable
              key={option.value}
              onPress={() => handleSelect(option.value)}
              accessibilityRole="button"
              accessibilityLabel={t(option.labelKey)}
              style={[
                styles.option,
                isFirstDestructive && {
                  borderTopWidth: 1,
                  borderTopColor: border,
                  marginTop: Spacing.xs,
                  paddingTop: Spacing.lg,
                },
              ]}
            >
              <IconSymbol
                name={option.icon}
                size={20}
                color={colorMap[option.colorKey]}
              />
              <View style={styles.optionText}>
                <Text
                  style={[
                    Typography.titleSm,
                    {
                      color: isDestructive ? errorColor : textColor,
                    },
                  ]}
                >
                  {t(option.labelKey)}
                </Text>
                <Text style={[Typography.caption, { color: textMuted }]}>
                  {t(option.descriptionKey)}
                </Text>
              </View>
              {isActive && (
                <IconSymbol name="checkmark" size={18} color={primary} />
              )}
            </Pressable>
          );
        })}

        {currentPreference !== null && (
          <Pressable
            onPress={() => handleSelect(null)}
            accessibilityRole="button"
            accessibilityLabel={t("options.remove")}
            style={[
              styles.option,
              styles.removeOption,
              { borderTopColor: border },
            ]}
          >
            <IconSymbol name="xmark" size={20} color={textMuted} />
            <Text style={[Typography.body, { color: textMuted }]}>
              {t("options.remove")}
            </Text>
          </Pressable>
        )}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  sheetTitle: {
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  removeOption: {
    borderTopWidth: 1,
    marginTop: Spacing.xs,
    paddingTop: Spacing.lg,
  },
});
