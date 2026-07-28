import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Elevation,
  Opacity,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { ExercisePreferenceValue } from "@/lib/api/exercise-preferences";

interface ExerciseMenuProps {
  visible: boolean;
  exerciseName: string;
  currentPreference?: ExercisePreferenceValue | null;
  onClose: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onPreferenceSelect?: () => void;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
  onMoveEarlier: () => void;
  onMoveLater: () => void;
}

export function ExerciseMenu({
  visible,
  exerciseName,
  currentPreference,
  onClose,
  onReplace,
  onRemove,
  onPreferenceSelect,
  canMoveEarlier,
  canMoveLater,
  onMoveEarlier,
  onMoveLater,
}: ExerciseMenuProps) {
  const { t } = useTranslation("workout");
  const [showReorder, setShowReorder] = useState(false);
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");
  const border = useThemeColor({}, "border");

  useEffect(() => {
    if (!visible) setShowReorder(false);
  }, [visible]);

  const handleClose = () => {
    setShowReorder(false);
    onClose();
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
      onPress: () => setShowReorder(true),
    },
    {
      label: t("menu.replace"),
      icon: "arrow.triangle.2.circlepath" as const,
      color: textSecondary,
      onPress: () => {
        handleClose();
        onReplace();
      },
    },
    {
      label: t("menu.remove"),
      icon: "trash" as const,
      color: errorColor,
      onPress: () => {
        handleClose();
        onRemove();
      },
      destructive: true,
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          style={styles.backdropTouchable}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("menu.close")}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: background }, Elevation.md]}
        >
          <View style={[styles.handle, { backgroundColor: textMuted }]} />

          {showReorder ? (
            <>
              <View style={styles.reorderHeader}>
                <Pressable
                  onPress={() => setShowReorder(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t("menu.back")}
                  hitSlop={8}
                  style={styles.backButton}
                >
                  <IconSymbol
                    name="chevron.left"
                    size={22}
                    color={textSecondary}
                  />
                </Pressable>
                <View style={styles.reorderHeading}>
                  <Text style={[Typography.titleSm, { color: textColor }]}>
                    {t("menu.reorder")}
                  </Text>
                  <Text
                    style={[Typography.caption, { color: textMuted }]}
                    numberOfLines={1}
                  >
                    {exerciseName}
                  </Text>
                </View>
              </View>
              <Text
                style={[Typography.body, styles.hint, { color: textMuted }]}
              >
                {t("menu.reorderHint")}
              </Text>
              <View style={styles.reorderActions}>
                <Pressable
                  onPress={onMoveEarlier}
                  disabled={!canMoveEarlier}
                  accessibilityRole="button"
                  accessibilityLabel={t("menu.moveEarlier")}
                  accessibilityState={{ disabled: !canMoveEarlier }}
                  style={[
                    styles.reorderAction,
                    { borderColor: border },
                    !canMoveEarlier && styles.disabled,
                  ]}
                >
                  <IconSymbol
                    name="arrow.up"
                    size={20}
                    color={canMoveEarlier ? textSecondary : textMuted}
                  />
                  <Text
                    style={[
                      Typography.titleSm,
                      { color: canMoveEarlier ? textColor : textMuted },
                    ]}
                  >
                    {t("menu.moveEarlier")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onMoveLater}
                  disabled={!canMoveLater}
                  accessibilityRole="button"
                  accessibilityLabel={t("menu.moveLater")}
                  accessibilityState={{ disabled: !canMoveLater }}
                  style={[
                    styles.reorderAction,
                    { borderColor: border },
                    !canMoveLater && styles.disabled,
                  ]}
                >
                  <IconSymbol
                    name="arrow.down"
                    size={20}
                    color={canMoveLater ? textSecondary : textMuted}
                  />
                  <Text
                    style={[
                      Typography.titleSm,
                      { color: canMoveLater ? textColor : textMuted },
                    ]}
                  >
                    {t("menu.moveLater")}
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
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
                  <IconSymbol
                    name={option.icon}
                    size={20}
                    color={option.color}
                  />
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
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  backdropTouchable: {
    ...StyleSheet.absoluteFillObject,
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
  reorderHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -Spacing.sm,
  },
  reorderHeading: {
    flex: 1,
    gap: 2,
  },
  hint: {
    marginBottom: Spacing.lg,
  },
  reorderActions: {
    gap: Spacing.sm,
  },
  reorderAction: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
});
