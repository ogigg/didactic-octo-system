import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";

interface ExerciseMenuProps {
  visible: boolean;
  exerciseName: string;
  currentPreference?: ExercisePreferenceValue | null;
  onClose: () => void;
  onReplace: () => void;
  onPreferenceSelect?: () => void;
}

export function ExerciseMenu({
  visible,
  exerciseName,
  currentPreference,
  onClose,
  onReplace,
  onPreferenceSelect,
}: ExerciseMenuProps) {
  const { t } = useTranslation("workout");
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");
  const border = useThemeColor({}, "border");

  const handleStub = () => {
    onClose();
    Alert.alert(exerciseName, t("menu.notImplemented"));
  };

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
              onClose();
              onPreferenceSelect();
            },
          },
        ]
      : []),
    {
      label: t("menu.reorder"),
      icon: "arrow.up.arrow.down" as const,
      color: textSecondary,
      onPress: handleStub,
    },
    {
      label: t("menu.replace"),
      icon: "arrow.triangle.2.circlepath" as const,
      color: textSecondary,
      onPress: () => {
        onClose();
        onReplace();
      },
    },
    {
      label: t("menu.remove"),
      icon: "trash" as const,
      color: errorColor,
      onPress: handleStub,
      destructive: true,
    },
  ];

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
});
