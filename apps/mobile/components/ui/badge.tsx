import {
  type AccessibilityRole,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface BadgeProps {
  label: string;
  /** `accent` for highlighted states, `neutral` for quiet status. */
  tone?: "accent" | "neutral";
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
}

/** Small rounded pill for short statuses such as "PRO" or "Last used". */
export function Badge({
  label,
  tone = "accent",
  style,
  accessibilityLabel,
  accessibilityRole,
}: BadgeProps) {
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textSecondary = useThemeColor({}, "textSecondary");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const accent = tone === "accent";

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: accent ? primarySurface : backgroundSubtle },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
    >
      <Text style={[styles.label, { color: accent ? primary : textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radii.full,
  },
  label: {
    ...Typography.label,
  },
});
