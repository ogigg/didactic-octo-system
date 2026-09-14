import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { StreakStatus } from "@/lib/api/streak-protection";

interface StreakStatusCardProps {
  status: StreakStatus;
  isStarting: boolean;
  onStartWorkout: () => void;
  onDismiss: () => void;
}

/**
 * Inline, non-blocking surface for informational streak states. Used when
 * nothing needs deciding: the streak is still intact (`at_risk`) or Pro already
 * covered the missed week (`pro_auto_applied`).
 */
export function StreakStatusCard({
  status,
  isStarting,
  onStartWorkout,
  onDismiss,
}: StreakStatusCardProps) {
  const { t } = useTranslation("streakProtection");

  const surface = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");

  const isProtected = status.prompt_state === "pro_auto_applied";
  const title = t(`states.${status.prompt_state}.title`, {
    count: status.current_streak_weeks,
  });
  const body = t(`states.${status.prompt_state}.body`, {
    count: status.pro_freezes_available,
  });

  return (
    <View
      style={[styles.card, { backgroundColor: surface, borderColor: border }]}
      accessibilityRole="summary"
    >
      <View style={styles.headerRow}>
        <View
          style={[styles.iconContainer, { backgroundColor: primarySurface }]}
        >
          <IconSymbol
            name={isProtected ? "checkmark.circle.fill" : "flame.fill"}
            size={18}
            color={primary}
          />
        </View>
        <View style={styles.headerText}>
          <Text
            style={[Typography.titleSm, { color: textColor }]}
            accessibilityRole="header"
          >
            {title}
          </Text>
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {body}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          disabled={isStarting}
          accessibilityRole="button"
          accessibilityLabel={t("actions.gotIt")}
          hitSlop={8}
          style={({ pressed }) => [
            styles.dismiss,
            pressed && { opacity: Opacity.pressed },
          ]}
        >
          <IconSymbol name="xmark" size={16} color={textMuted} />
        </Pressable>
      </View>

      <Button
        label={t("actions.startWorkout")}
        variant="secondary"
        loading={isStarting}
        onPress={onStartWorkout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    gap: Spacing.xs,
  },
  dismiss: {
    width: 44,
    height: 44,
    marginTop: -Spacing.xs,
    marginRight: -Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
