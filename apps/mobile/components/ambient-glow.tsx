import { BlurView } from "expo-blur";
import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { Colors } from "@/constants/theme";

interface BlobConfig {
  size: number;
  top?: number | string;
  bottom?: number | string;
  left?: number | string;
  right?: number | string;
  opacity: number;
  delayMs: number;
}

interface VariantPreset {
  blobs: BlobConfig[];
  intensity: number;
}

const VARIANT_PRESETS = {
  hero: {
    blobs: [
      { size: 280, top: -40, left: -60, opacity: 0.15, delayMs: 0 },
      { size: 200, bottom: -20, right: -50, opacity: 0.1, delayMs: 1500 },
      { size: 160, top: 20, right: -30, opacity: 0.08, delayMs: 3000 },
    ],
    intensity: 80,
  },
  timer: {
    blobs: [
      { size: 240, top: -30, left: -40, opacity: 0.15, delayMs: 0 },
      { size: 180, bottom: -10, right: -40, opacity: 0.1, delayMs: 1500 },
    ],
    intensity: 90,
  },
  subtle: {
    blobs: [
      { size: 200, top: -20, left: -30, opacity: 0.12, delayMs: 0 },
      { size: 160, bottom: -10, right: -30, opacity: 0.08, delayMs: 1500 },
    ],
    intensity: 70,
  },
} as const satisfies Record<string, VariantPreset>;

type Variant = keyof typeof VARIANT_PRESETS;

interface AmbientGlowProps {
  variant?: Variant;
  animated?: boolean;
  style?: ViewStyle;
}

interface AnimatedBlobProps {
  config: BlobConfig;
  color: string;
  animated: boolean;
  darkMode: boolean;
}

function AnimatedBlob({
  config,
  color,
  animated,
  darkMode,
}: AnimatedBlobProps) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(
    darkMode ? config.opacity * 0.7 : config.opacity
  );

  useEffect(() => {
    if (!animated) return;
    scale.value = withDelay(
      config.delayMs,
      withRepeat(
        withSequence(
          withTiming(1.06, { duration: 3000 }),
          withTiming(1.0, { duration: 3000 })
        ),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      config.delayMs,
      withRepeat(
        withSequence(
          withTiming((darkMode ? config.opacity * 0.7 : config.opacity) * 1.3, {
            duration: 3000,
          }),
          withTiming(darkMode ? config.opacity * 0.7 : config.opacity, {
            duration: 3000,
          })
        ),
        -1,
        false
      )
    );
  }, [animated, config.delayMs, config.opacity, darkMode, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const blobStyle: ViewStyle = {
    position: "absolute",
    width: config.size,
    height: config.size,
    borderRadius: config.size / 2,
    backgroundColor: color,
    top: config.top as number | undefined,
    bottom: config.bottom as number | undefined,
    left: config.left as number | undefined,
    right: config.right as number | undefined,
  };

  return <Animated.View style={[blobStyle, animatedStyle]} />;
}

export function AmbientGlow({
  variant = "hero",
  animated = true,
  style,
}: AmbientGlowProps) {
  const colorScheme = useColorScheme() ?? "light";
  const reducedMotion = useReducedMotion();
  const preset = VARIANT_PRESETS[variant];
  const isDark = colorScheme === "dark";
  const primaryColor = isDark ? Colors.dark.primary : Colors.light.primary;
  const shouldAnimate = animated && !reducedMotion;
  const blurTint = isDark ? "dark" : "light";

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {preset.blobs.map((blob, index) => (
        <AnimatedBlob
          key={index}
          config={blob}
          color={primaryColor}
          animated={shouldAnimate}
          darkMode={isDark}
        />
      ))}
      <BlurView
        style={StyleSheet.absoluteFill}
        intensity={preset.intensity}
        tint={blurTint}
      />
    </View>
  );
}
