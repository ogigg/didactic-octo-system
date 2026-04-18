import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface SectionHeaderAction {
  label: string;
  onPress: () => void;
  icon?: "plus" | "chevron.right";
  accessibilityLabel?: string;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: SectionHeaderAction;
  style?: ViewStyle;
}

/**
 * Section title with optional inline text-link action. Replaces heavy
 * dashed/bordered "add" cards and redundant full-width footer buttons.
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  style,
}: SectionHeaderProps) {
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const primary = useThemeColor({}, "primary");

  return (
    <View style={[styles.row, style]}>
      <View style={styles.titles}>
        <Text style={[Typography.titleMd, { color: text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Pressable
          onPress={action.onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={action.accessibilityLabel ?? action.label}
          style={({ pressed }) => [
            styles.action,
            pressed && { opacity: Opacity.pressed },
          ]}
        >
          {action.icon === "plus" ? (
            <IconSymbol name="plus" size={14} color={primary} />
          ) : null}
          <Text style={[Typography.bodyMedium, { color: primary }]}>
            {action.label}
          </Text>
          {action.icon === "chevron.right" ? (
            <IconSymbol name="chevron.right" size={12} color={primary} />
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
  },
});
