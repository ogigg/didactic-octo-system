import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useToastStore } from "@/stores/toast-store";

import { IconSymbol } from "./icon-symbol";

export function ToastHost() {
  const toast = useToastStore((state) => state.toast);
  const insets = useSafeAreaInsets();
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const success = useThemeColor({}, "success");

  if (!toast) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.host, { top: insets.top + Spacing.md }]}
    >
      <Animated.View
        key={toast.id}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        entering={FadeInDown.duration(220)}
        exiting={FadeOutUp.duration(180)}
        style={[
          styles.toast,
          {
            backgroundColor: backgroundElevated,
            borderColor: success + "4D",
          },
        ]}
      >
        <View style={[styles.iconSurface, { backgroundColor: success + "1F" }]}>
          <IconSymbol name="checkmark.circle.fill" size={18} color={success} />
        </View>
        <Text
          style={[Typography.bodyMedium, styles.message, { color: textColor }]}
        >
          {toast.message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    left: Spacing.xl,
    position: "absolute",
    right: Spacing.xl,
    zIndex: 1000,
  },
  toast: {
    ...Elevation.md,
    alignItems: "center",
    alignSelf: "center",
    borderRadius: Radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    maxWidth: 420,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  iconSurface: {
    alignItems: "center",
    borderRadius: Radii.full,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  message: {
    flexShrink: 1,
  },
});
