import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type {
  StreakProtectionType,
  StreakStatus,
} from "@/lib/api/streak-protection";

interface StreakProtectionSheetProps {
  visible: boolean;
  status: StreakStatus;
  isPending: boolean;
  onApplyProtection: (type: StreakProtectionType) => void;
  onComeback: () => void;
  onAdjustPlan: () => void;
  onUpgrade: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

interface SheetAction {
  label: string;
  variant?: "primary" | "secondary" | "ghost" | "destructive";
  onPress: () => void;
}

function getPrimaryProtection(
  status: StreakStatus
): StreakProtectionType | null {
  if (status.prompt_state === "free_earned_freeze") {
    return "earned_freeze";
  }

  if (status.prompt_state === "free_lifetime_rescue") {
    return "lifetime_rescue";
  }

  if (status.prompt_state === "pro_available_freeze") {
    return "pro_freeze";
  }

  return null;
}

export function StreakProtectionSheet({
  visible,
  status,
  isPending,
  onApplyProtection,
  onComeback,
  onAdjustPlan,
  onUpgrade,
  onRestart,
  onDismiss,
}: StreakProtectionSheetProps) {
  const { t } = useTranslation("streakProtection");

  const background = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const warning = useThemeColor({}, "warning");

  const protectionType = getPrimaryProtection(status);
  const title = t(`states.${status.prompt_state}.title`);
  const body = t(`states.${status.prompt_state}.body`, {
    freezes: status.pro_freezes_available,
    count: status.current_streak_weeks,
  });

  const actions: SheetAction[] = [];

  if (protectionType) {
    actions.push({
      label:
        protectionType === "lifetime_rescue"
          ? t("actions.restoreOnce")
          : t("actions.useFreeze"),
      onPress: () => onApplyProtection(protectionType),
    });
  } else {
    actions.push({
      label:
        status.prompt_state === "free_comeback"
          ? t("actions.startComebackChallenge")
          : t("actions.startComebackWorkout"),
      onPress: onComeback,
    });
  }

  if (
    status.prompt_state === "free_lifetime_rescue" ||
    status.prompt_state === "free_comeback"
  ) {
    actions.push({
      label: t("actions.upgrade"),
      variant: "secondary",
      onPress: onUpgrade,
    });
  } else if (
    status.prompt_state === "pro_auto_applied" ||
    status.prompt_state === "pro_comeback" ||
    status.prompt_state === "at_risk"
  ) {
    actions.push({
      label: t("actions.adjustPlan"),
      variant: "secondary",
      onPress: onAdjustPlan,
    });
  } else if (protectionType) {
    actions.push({
      label: t("actions.startComebackWorkout"),
      variant: "secondary",
      onPress: onComeback,
    });
  }

  if (
    status.prompt_state !== "at_risk" &&
    status.prompt_state !== "pro_auto_applied"
  ) {
    actions.push({
      label: t("actions.restart"),
      variant: "ghost",
      onPress: onRestart,
    });
  } else {
    actions.push({
      label: t("actions.notNow"),
      variant: "ghost",
      onPress: onDismiss,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      accessibilityViewIsModal
    >
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: background }, Elevation.md]}
          onPress={() => {}}
        >
          <View style={[styles.handle, { backgroundColor: textMuted }]} />

          <View style={styles.headerRow}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    status.prompt_state === "pro_auto_applied"
                      ? primarySurface
                      : `${warning}22`,
                },
              ]}
            >
              <IconSymbol
                name={
                  status.prompt_state === "pro_auto_applied"
                    ? "checkmark.circle.fill"
                    : "flame.fill"
                }
                size={22}
                color={
                  status.prompt_state === "pro_auto_applied" ? primary : warning
                }
              />
            </View>
            <View style={styles.headerText}>
              <Text style={[Typography.label, { color: textMuted }]}>
                {t("eyebrow")}
              </Text>
              <Text
                style={[Typography.titleLg, { color: textColor }]}
                accessibilityRole="header"
              >
                {title}
              </Text>
            </View>
          </View>

          <Text
            style={[Typography.body, styles.body, { color: textSecondary }]}
          >
            {body}
          </Text>

          <View style={[styles.metrics, { borderColor: border }]}>
            <View style={styles.metricItem}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {status.current_streak_weeks}
              </Text>
              <Text style={[Typography.caption, { color: textMuted }]}>
                {t("metrics.streakWeeks")}
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: border }]} />
            <View style={styles.metricItem}>
              <Text style={[Typography.titleSm, { color: textColor }]}>
                {status.is_pro_active
                  ? status.pro_freezes_available
                  : status.earned_freezes_available}
              </Text>
              <Text style={[Typography.caption, { color: textMuted }]}>
                {t("metrics.freezes")}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                variant={action.variant}
                disabled={isPending}
                onPress={action.onPress}
              />
            ))}
          </View>

          {isPending && (
            <View style={styles.pendingOverlay} pointerEvents="none">
              <ActivityIndicator color={primary} />
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.42)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.xl,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  body: {
    marginTop: Spacing.lg,
    lineHeight: 21,
  },
  metrics: {
    marginTop: Spacing.xl,
    borderWidth: 1,
    borderRadius: Radii.md,
    flexDirection: "row",
    minHeight: 64,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  metricDivider: {
    width: 1,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  pendingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
});
