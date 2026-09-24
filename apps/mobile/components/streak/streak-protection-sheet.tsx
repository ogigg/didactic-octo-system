import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type {
  StreakProtectionType,
  StreakStatus,
} from "@/lib/api/streak-protection";
import {
  canRestartStreak,
  formatCoveredWeekRange,
  getAvailableProtection,
  shouldOfferProHint,
} from "@/lib/streak-prompt";

export type StreakSheetPendingAction = "apply" | "restart";

interface StreakProtectionSheetProps {
  visible: boolean;
  status: StreakStatus;
  pendingAction: StreakSheetPendingAction | null;
  hasError: boolean;
  onApplyProtection: (type: StreakProtectionType) => void;
  onComeback: () => void;
  onAdjustPlan: () => void;
  onUpgrade: () => void;
  onRestart: () => void;
  onDismiss: () => void;
}

export function StreakProtectionSheet({
  visible,
  status,
  pendingAction,
  hasError,
  onApplyProtection,
  onComeback,
  onAdjustPlan,
  onUpgrade,
  onRestart,
  onDismiss,
}: StreakProtectionSheetProps) {
  const { t, i18n } = useTranslation("streakProtection");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  // Set before dismissing so the shared onClose can tell "user closed the
  // sheet" apart from "an action closed the sheet and should run afterwards".
  const closeActionRef = useRef<(() => void) | null>(null);
  const [isConfirmingRestart, setIsConfirmingRestart] = useState(false);

  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const errorColor = useThemeColor({}, "error");
  const destructiveSurface = useThemeColor({}, "destructiveSurface");

  useEffect(() => {
    if (!visible) setIsConfirmingRestart(false);
  }, [visible]);

  // Apply/restart intentionally run while the sheet stays open (unlike the
  // dismiss-then-act pattern for navigation) so a failed request keeps its
  // retry surface instead of leaving the user with a bare alert.
  const isPending = pendingAction !== null;
  const protectionType = getAvailableProtection(status);
  const showProHint = shouldOfferProHint(status);
  const showRestart = canRestartStreak(status);
  // The covered week only matters when something can actually cover it.
  const coveredWeekRange = protectionType
    ? formatCoveredWeekRange(status, i18n.language)
    : null;

  const title = t(`states.${status.prompt_state}.title`, {
    count: status.current_streak_weeks,
  });
  const body = t(`states.${status.prompt_state}.body`, {
    count: status.pro_freezes_available,
  });

  const closeWith = (action?: () => void) => {
    closeActionRef.current = action ?? null;
    sheetRef.current?.dismiss();
  };

  const handleClosed = () => {
    const action = closeActionRef.current;
    closeActionRef.current = null;
    if (action) {
      action();
    } else {
      onDismiss();
    }
  };

  const primaryActionLabel =
    protectionType === "lifetime_rescue"
      ? t("actions.useRestore")
      : protectionType
        ? t("actions.useFreeze")
        : t("actions.startComebackWorkout");

  const detailLabel =
    protectionType === "lifetime_rescue"
      ? t("details.restoreAvailable")
      : protectionType === "earned_freeze"
        ? t("details.freezesAvailable", {
            count: status.earned_freezes_available,
          })
        : protectionType === "pro_freeze"
          ? t("details.freezesAvailable", {
              count: status.pro_freezes_available,
            })
          : null;

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={handleClosed}
      closeAccessibilityLabel={t("closeSheet")}
      testID="streak-protection-sheet"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.headerRow}>
          <View
            style={[styles.iconContainer, { backgroundColor: primarySurface }]}
          >
            <IconSymbol name="flame.fill" size={22} color={primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("eyebrow")}
            </Text>
            <Text
              style={[Typography.titleLg, { color: textColor }]}
              accessibilityRole="header"
            >
              {isConfirmingRestart ? t("restartConfirm.title") : title}
            </Text>
          </View>
        </View>

        <Text style={[Typography.body, styles.body, { color: textSecondary }]}>
          {isConfirmingRestart ? t("restartConfirm.body") : body}
        </Text>

        {!isConfirmingRestart && (coveredWeekRange || detailLabel) && (
          <View style={[styles.details, { borderColor: border }]}>
            {coveredWeekRange && (
              <View style={styles.detailRow}>
                <IconSymbol name="calendar" size={16} color={textMuted} />
                <Text
                  style={[
                    Typography.bodyMedium,
                    styles.detailText,
                    { color: textColor },
                  ]}
                >
                  {t("details.coveredWeek", { range: coveredWeekRange })}
                </Text>
              </View>
            )}
            {detailLabel && (
              <View style={styles.detailRow}>
                <IconSymbol
                  name="checkmark.circle.fill"
                  size={16}
                  color={primary}
                />
                <Text
                  style={[
                    Typography.bodyMedium,
                    styles.detailText,
                    { color: textColor },
                  ]}
                >
                  {detailLabel}
                </Text>
              </View>
            )}
          </View>
        )}

        {hasError && (
          <View
            style={[
              styles.errorBanner,
              { backgroundColor: destructiveSurface },
            ]}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <IconSymbol
              name="exclamationmark.triangle.fill"
              size={16}
              color={errorColor}
            />
            <Text
              style={[
                Typography.bodyMedium,
                styles.detailText,
                { color: errorColor },
              ]}
            >
              {t("errors.actionFailed")}
            </Text>
          </View>
        )}

        {isConfirmingRestart ? (
          <View style={styles.actions}>
            <Button
              label={t("restartConfirm.confirm")}
              variant="destructive"
              loading={pendingAction === "restart"}
              disabled={isPending}
              onPress={onRestart}
            />
            <Button
              label={t("restartConfirm.cancel")}
              variant="ghost"
              disabled={isPending}
              onPress={() => setIsConfirmingRestart(false)}
            />
          </View>
        ) : (
          <View style={styles.actions}>
            {protectionType ? (
              <>
                <Button
                  label={primaryActionLabel}
                  loading={pendingAction === "apply"}
                  disabled={isPending}
                  onPress={() => onApplyProtection(protectionType)}
                />
                <Button
                  label={t("actions.startWorkoutInstead")}
                  variant="secondary"
                  disabled={isPending}
                  onPress={() => closeWith(onComeback)}
                />
              </>
            ) : (
              <>
                <Button
                  label={primaryActionLabel}
                  disabled={isPending}
                  onPress={() => closeWith(onComeback)}
                />
                {status.prompt_state === "pro_comeback" && (
                  <Button
                    label={t("actions.adjustPlan")}
                    variant="secondary"
                    disabled={isPending}
                    onPress={() => closeWith(onAdjustPlan)}
                  />
                )}
              </>
            )}

            {showRestart && (
              <Button
                label={t("actions.startFresh")}
                variant="ghost"
                disabled={isPending}
                onPress={() => setIsConfirmingRestart(true)}
              />
            )}

            <Button
              label={t("actions.notNow")}
              variant="ghost"
              disabled={isPending}
              onPress={() => closeWith()}
            />
          </View>
        )}

        {!isConfirmingRestart && showProHint && (
          <View style={styles.proHint}>
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("pro.hint")}
            </Text>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={t("pro.link")}
              disabled={isPending}
              onPress={() => closeWith(onUpgrade)}
              hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.proLink,
                pressed && { opacity: Opacity.pressed },
              ]}
            >
              <Text style={[Typography.caption, { color: primary }]}>
                {t("pro.link")}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
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
    lineHeight: 22,
  },
  details: {
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailText: {
    flex: 1,
  },
  errorBanner: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  actions: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  proHint: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  proLink: {
    minHeight: 44,
    justifyContent: "center",
  },
});
