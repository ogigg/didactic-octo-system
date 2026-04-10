import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useSubscription } from "@/hooks/use-subscription";

export function UsageIndicator() {
  const { t } = useTranslation("subscription");
  const { tier, weeklyUsage, weeklyLimit, isLoading } = useSubscription();

  const textMuted = useThemeColor({}, "textMuted");
  const textColor = useThemeColor({}, "text");
  const errorColor = useThemeColor({}, "error");
  const warningColor = useThemeColor({}, "warning");
  const primary = useThemeColor({}, "primary");
  const borderSubtle = useThemeColor({}, "borderSubtle");

  const progressWidth = useSharedValue(0);

  const ratio = weeklyLimit === 0 ? 0 : Math.min(weeklyUsage / weeklyLimit, 1);

  useEffect(() => {
    progressWidth.value = withTiming(ratio, { duration: 400 });
  }, [ratio, progressWidth]);

  const animatedFill = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%`,
  }));

  // Hidden for pro users
  if (tier === "pro" || isLoading) return null;

  const isAtLimit = weeklyUsage >= weeklyLimit;
  const isHigh = weeklyUsage >= weeklyLimit - 1;

  const fillColor = isAtLimit ? errorColor : isHigh ? warningColor : primary;
  const countColor = isAtLimit ? errorColor : isHigh ? textColor : textColor;

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel={
        t("usage.label") +
        ", " +
        t("usage.count", { used: weeklyUsage, limit: weeklyLimit }) +
        " " +
        t("usage.weekly")
      }
      accessibilityValue={{ min: 0, max: weeklyLimit, now: weeklyUsage }}
    >
      <View style={styles.row}>
        <Text style={[Typography.label, { color: textMuted }]}>
          {t("usage.label")}
        </Text>
        <Text
          style={[
            Typography.bodyMedium,
            { color: countColor, fontVariant: ["tabular-nums"] },
          ]}
        >
          {t("usage.count", { used: weeklyUsage, limit: weeklyLimit })}
        </Text>
      </View>

      <View style={[styles.track, { backgroundColor: borderSubtle }]}>
        <Animated.View
          style={[styles.fill, animatedFill, { backgroundColor: fillColor }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  track: {
    height: 4,
    borderRadius: Radii.full,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: Radii.full,
  },
});
