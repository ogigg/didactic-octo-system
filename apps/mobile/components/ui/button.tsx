import { useThemeColor } from "@/hooks/use-theme-color";
import { Opacity, Radii, Spacing, Typography } from "@/constants/theme";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "destructive" | "success";
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
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

  const bgColor = disabled
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

  const textColor = disabled
    ? textDisabled
    : variant === "primary" || variant === "success"
      ? "#FFFFFF"
      : variant === "secondary" || variant === "ghost"
        ? primary
        : errorColor;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        variant !== "ghost" && { backgroundColor: bgColor },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
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
