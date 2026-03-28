import { useThemeColor } from "@/hooks/use-theme-color";
import { Opacity, Spacing, Typography } from "@/constants/theme";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { IconSymbol } from "./icon-symbol";

interface BackButtonProps {
  onPress?: () => void;
  label?: string;
  accessibilityLabel?: string;
}

export function BackButton({
  onPress,
  label,
  accessibilityLabel = "Go back",
}: BackButtonProps) {
  const router = useRouter();
  const primary = useThemeColor({}, "primary");

  function handlePress() {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <IconSymbol name="chevron.left" size={20} color={primary} />
      {label ? (
        <Text style={[Typography.body, { color: primary }]}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  pressed: {
    opacity: Opacity.pressed,
  },
});
