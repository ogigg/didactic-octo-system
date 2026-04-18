import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type IconName = Parameters<typeof IconSymbol>[0]["name"];

interface ListRowProps {
  icon?: IconName;
  label: string;
  description?: string;
  onPress?: () => void;
  disabled?: boolean;
  trailing?: React.ReactNode;
  showChevron?: boolean;
  accessibilityLabel?: string;
  /** Position in a grouped list — controls separator rendering. */
  position?: "first" | "middle" | "last" | "only";
}

/**
 * iOS-style grouped list row. Replaces the 2x2 card grid on Profile with
 * a single-column list that feels quieter and more unified.
 */
export function ListRow({
  icon,
  label,
  description,
  onPress,
  disabled = false,
  trailing,
  showChevron = true,
  accessibilityLabel,
  position = "middle",
}: ListRowProps) {
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");

  const showSeparator = position === "first" || position === "middle";

  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconWrap}>
          <IconSymbol
            name={icon}
            size={18}
            color={disabled ? textMuted : primary}
          />
        </View>
      ) : null}
      <View style={styles.labels}>
        <Text
          style={[
            Typography.bodyMedium,
            { color: disabled ? textMuted : text },
          ]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {showChevron && onPress && !trailing ? (
        <IconSymbol name="chevron.right" size={16} color={textMuted} />
      ) : null}
    </View>
  );

  const wrapperStyle: ViewStyle = {
    borderBottomWidth: showSeparator ? StyleSheet.hairlineWidth : 0,
    borderBottomColor: border,
  };

  if (!onPress) {
    return <View style={[wrapperStyle]}>{content}</View>;
  }

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        wrapperStyle,
        pressed && !disabled && { opacity: Opacity.pressed },
        disabled && { opacity: Opacity.disabled },
      ]}
    >
      {content}
    </Pressable>
  );
}

interface ListGroupProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Visual container that groups ListRow items with a single soft border and
 * rounded corners. Use instead of giving each row its own card.
 */
export function ListGroup({ children, style }: ListGroupProps) {
  const border = useThemeColor({}, "border");
  return (
    <View
      style={[
        styles.group,
        {
          borderColor: border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 28,
    alignItems: "center",
  },
  labels: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  group: {
    borderRadius: Radii.lg,
    overflow: "hidden",
  },
});
