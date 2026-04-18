import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type ViewProps, type ViewStyle } from "react-native";

import { Radii } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

type GradientVariant = "surface" | "hero" | "accent";

interface GradientSurfaceProps extends ViewProps {
  variant?: GradientVariant;
  radius?: keyof typeof Radii | number;
  bordered?: boolean;
  children?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Low-chrome gradient-backed surface. Replaces flat card fills with a subtle
 * top-left → bottom-right wash that gives depth without drawing a hard box.
 *
 * - `surface`: neutral wash for sections (tiny luminosity shift only).
 * - `hero`: branded sky → violet gradient for primary CTAs / hero cards.
 * - `accent`: translucent primary tint for informational surfaces.
 */
export function GradientSurface({
  variant = "surface",
  radius = "lg",
  bordered = false,
  style,
  children,
  ...rest
}: GradientSurfaceProps) {
  const surfaceStart = useThemeColor({}, "surfaceGradientStart");
  const surfaceEnd = useThemeColor({}, "surfaceGradientEnd");
  const heroStart = useThemeColor({}, "heroGradientStart");
  const heroEnd = useThemeColor({}, "heroGradientEnd");
  const accentStart = useThemeColor({}, "accentGradientStart");
  const accentEnd = useThemeColor({}, "accentGradientEnd");
  const border = useThemeColor({}, "border");

  const colors =
    variant === "hero"
      ? [heroStart, heroEnd]
      : variant === "accent"
        ? [accentStart, accentEnd]
        : [surfaceStart, surfaceEnd];

  const borderRadius = typeof radius === "number" ? radius : Radii[radius];

  return (
    <View
      style={[
        styles.wrapper,
        { borderRadius },
        bordered && {
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: border,
        },
        style,
      ]}
      {...rest}
    >
      <LinearGradient
        colors={colors as [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius }]}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
  },
});
