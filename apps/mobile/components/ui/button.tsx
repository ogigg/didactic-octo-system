import { useThemeColor } from "@/hooks/use-theme-color";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import type { ComponentProps } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "success";
  icon?: ComponentProps<typeof IconSymbol>["name"];
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled = false,
  loading = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const primary = useThemeColor({}, "primary");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const destructiveSurface = useThemeColor({}, "destructiveSurface");
  const successColor = useThemeColor({}, "success");
  const textDisabled = useThemeColor({}, "textDisabled");
  const errorColor = useThemeColor({}, "error");
  const isDisabled = disabled || loading;

  const bgColor = isDisabled
    ? borderSubtle
    : variant === "primary"
      ? primary
      : variant === "secondary"
        ? primaryContainer
        : variant === "destructive"
          ? destructiveSurface
          : variant === "success"
            ? successColor
            : "transparent";

  const textColor = isDisabled
    ? textDisabled
    : variant === "primary" || variant === "success"
      ? "#FFFFFF"
      : variant === "secondary" || variant === "ghost"
        ? primary
        : errorColor;

  return (
    <Pressable
      onPress={isDisabled ? undefined : onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      style={({ pressed }) => [
        styles.base,
        variant !== "ghost" && { backgroundColor: bgColor },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={textColor} size="small" />
        ) : (
          icon && <IconSymbol name={icon} size={18} color={textColor} />
        )}
        <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  label: {
    ...Typography.titleSm,
  },
  disabled: {
    opacity: Opacity.disabled,
  },
  pressed: {
    opacity: Opacity.pressed,
  },
});
