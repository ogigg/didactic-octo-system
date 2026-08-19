import * as Haptics from "expo-haptics";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Colors, Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Recreates the app icon's kettlebell — a handle above a body of concentric
 * ripple circles — as a choreographed boot animation. The native splash is a
 * plain background color, so this overlay reads as one continuous sequence:
 * rings spring in from the outside in, the handle rises from behind the body,
 * the wordmark fades in, then everything scales up and fades out to reveal
 * the app.
 */

const BODY_SIZE = 170;
const HANDLE_OVERHANG = 62;
const LOGO_HEIGHT = BODY_SIZE + HANDLE_OVERHANG;

interface RingConfig {
  size: number;
  delayMs: number;
}

/** Outer ring first, then inward — mirrors the icon's ripple layering. */
const RINGS: RingConfig[] = [
  { size: BODY_SIZE, delayMs: 0 },
  { size: 122, delayMs: 70 },
  { size: 82, delayMs: 140 },
  { size: 46, delayMs: 210 },
];

/** Blue ramps sampled from the icon: darkest outside, lightest center. */
const RING_PALETTES = {
  light: ["#3898D8", "#57A9E1", "#7FBFEA", "#BCDFF7"],
  dark: ["#2F84C2", "#4B9BD4", "#6FB4E3", "#A5D2F1"],
} as const;

const HANDLE_DELAY_MS = 260;
const WORDMARK_DELAY_MS = 400;
const MIN_DISPLAY_MS = 1000;
const EXIT_DURATION_MS = 320;
/** Offset from a ring's spring start to its visual "landing" (first settle). */
const RING_HAPTIC_LANDING_MS = 150;
/** Idle breathing starts once the intro has fully settled. */
const BREATHE_START_MS = 1100;
/** Past this point a silent boot reads as a hang, so explain the wait. */
const SLOW_HINT_DELAY_MS = 5000;

const INTRO_SPRING = { damping: 15, stiffness: 200, mass: 0.7 };

interface RingProps {
  config: RingConfig;
  color: string;
  reducedMotion: boolean;
}

function Ring({ config, color, reducedMotion }: RingProps) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(config.delayMs, withSpring(1, INTRO_SPRING));
  }, [config.delayMs, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.ring,
        {
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: color,
          top: HANDLE_OVERHANG + (BODY_SIZE - config.size) / 2,
          left: (BODY_SIZE - config.size) / 2,
        },
        animatedStyle,
      ]}
    />
  );
}

interface AnimatedSplashProps {
  /** When true (and the minimum display time has elapsed), the exit plays. */
  appReady: boolean;
  /** Called after the exit animation completes; unmount the overlay here. */
  onFinish: () => void;
}

export function AnimatedSplash({ appReady, onFinish }: AnimatedSplashProps) {
  const { t } = useTranslation("common");
  const colorScheme = useColorScheme() ?? "light";
  const reducedMotion = useReducedMotion();
  const colors = Colors[colorScheme];
  const palette = RING_PALETTES[colorScheme];

  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const exitStarted = useRef(false);

  const handleProgress = useSharedValue(reducedMotion ? 1 : 0);
  const wordmarkProgress = useSharedValue(reducedMotion ? 1 : 0);
  const breatheScale = useSharedValue(1);
  const hintProgress = useSharedValue(0);
  const exitProgress = useSharedValue(0);

  // Hand off from the native splash only after our first frame is laid out,
  // so there is never a flash of the app underneath.
  const handleLayout = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => setMinTimeElapsed(true),
      reducedMotion ? 350 : MIN_DISPLAY_MS
    );
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    handleProgress.value = withDelay(
      HANDLE_DELAY_MS,
      withSpring(1, INTRO_SPRING)
    );
    wordmarkProgress.value = withDelay(
      WORDMARK_DELAY_MS,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) })
    );
    breatheScale.value = withDelay(
      BREATHE_START_MS,
      withRepeat(
        withSequence(
          withTiming(1.02, {
            duration: 1600,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    );
  }, [breatheScale, handleProgress, reducedMotion, wordmarkProgress]);

  // A light tick as each ring lands, ascending with the stagger.
  useEffect(() => {
    if (reducedMotion) return;
    const timers = RINGS.map((ring) =>
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, ring.delayMs + RING_HAPTIC_LANDING_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [reducedMotion]);

  // The hint is informative, not decorative, so it also shows with reduced
  // motion. If the exit runs first, the overlay is gone before this fires.
  useEffect(() => {
    hintProgress.value = withDelay(
      SLOW_HINT_DELAY_MS,
      withTiming(1, { duration: 400 })
    );
  }, [hintProgress]);

  useEffect(() => {
    if (!appReady || !minTimeElapsed || exitStarted.current) return;
    exitStarted.current = true;
    cancelAnimation(breatheScale);
    exitProgress.value = withTiming(
      1,
      { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onFinish)();
      }
    );
  }, [appReady, breatheScale, exitProgress, minTimeElapsed, onFinish]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exitProgress.value, [0, 1], [1, 0]),
  }));

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          breatheScale.value *
          interpolate(exitProgress.value, [0, 1], [1, 1.15]),
      },
    ],
  }));

  const handleStyle = useAnimatedStyle(() => ({
    opacity: handleProgress.value,
    transform: [
      { translateY: interpolate(handleProgress.value, [0, 1], [34, 0]) },
    ],
  }));

  // Pure opacity fade — transforms on text can drop frames while the app
  // tree mounts underneath the overlay during boot.
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmarkProgress.value,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity: hintProgress.value,
  }));

  return (
    <Animated.View
      onLayout={handleLayout}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.container,
        { backgroundColor: colors.background },
        containerStyle,
      ]}
    >
      <Animated.View style={logoStyle}>
        <View style={styles.logo}>
          <Animated.View
            style={[styles.handle, { borderColor: palette[0] }, handleStyle]}
          />
          {RINGS.map((ring, index) => (
            <Ring
              key={ring.size}
              config={ring}
              color={palette[index]}
              reducedMotion={reducedMotion}
            />
          ))}
        </View>
      </Animated.View>
      <Animated.View style={wordmarkStyle}>
        <Text style={[styles.wordmark, { color: colors.text }]}>
          {t("brand.appName")}
        </Text>
      </Animated.View>
      <Animated.View style={hintStyle}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {t("splash.loadingHint")}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: BODY_SIZE,
    height: LOGO_HEIGHT,
  },
  ring: {
    position: "absolute",
  },
  handle: {
    position: "absolute",
    width: 118,
    height: 108,
    borderRadius: 54,
    borderWidth: 27,
    top: 0,
    left: (BODY_SIZE - 118) / 2,
  },
  wordmark: {
    marginTop: 36,
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.4,
    fontFamily: Fonts?.rounded,
  },
  hint: {
    marginTop: 14,
    fontSize: 13,
    fontWeight: "500",
  },
});
