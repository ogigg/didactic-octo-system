import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

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
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const textSecondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");

  const colorMap = { primary, textSecondary, error: errorColor };

  const handleSelect = (value: ExercisePreferenceValue | null) => {
    onSelect(value);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.sheet, { backgroundColor: background }]}>
          <View style={[styles.handle, { backgroundColor: textMuted }]} />
          <Text
            style={[
              Typography.titleSm,
              { color: textColor },
              styles.sheetTitle,
            ]}
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
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["4xl"],
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
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
