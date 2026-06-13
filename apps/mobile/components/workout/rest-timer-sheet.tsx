import { IconSymbol } from "@/components/ui/icon-symbol";
import { Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { useLocalizedExerciseMap } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import {
  formatRestCountdown,
  getNextUp,
  getRestTimerProgress,
} from "@/lib/rest-timer";
import { useWorkoutStore, type WorkoutExercise } from "@/stores/workout-store";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import { useTranslation } from "react-i18next";

const RING_SIZE = 248;
const RING_STROKE = 12;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const DISMISS_DISTANCE = 130;
const DISMISS_VELOCITY = 900;

const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };

function triggerHaptic(fn: () => Promise<void>) {
  if (Platform.OS === "ios") void fn();
}

interface RestTimerSheetProps {
  onClose: () => void;
}

export function RestTimerSheet({ onClose }: RestTimerSheetProps) {
  const { t } = useTranslation("workout");
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { label: weightLabel } = useWeightUnit();

  const restTimer = useWorkoutStore((s) => s.restTimer);
  const exercises = useWorkoutStore((s) => s.exercises);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((s) => s.skipRestTimer);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const primarySurface = useThemeColor({}, "primarySurface");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const inputFill = useThemeColor({}, "inputFill");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const translateY = useSharedValue(screenHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    backdropOpacity.value = withTiming(1, {
      duration: reducedMotion ? 0 : 220,
    });
    translateY.value = reducedMotion ? 0 : withSpring(0, OPEN_SPRING);
    // Only animate the entrance once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, {
      duration: reducedMotion ? 0 : 180,
    });
    if (reducedMotion) {
      onClose();
      return;
    }
    translateY.value = withTiming(
      screenHeight,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(onClose)();
      }
    );
  }, [backdropOpacity, translateY, screenHeight, reducedMotion, onClose]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onChange((e) => {
          // Resist upward drags so the sheet feels anchored.
          translateY.value =
            e.translationY > 0 ? e.translationY : e.translationY / 8;
        })
        .onEnd((e) => {
          if (
            e.translationY > DISMISS_DISTANCE ||
            e.velocityY > DISMISS_VELOCITY
          ) {
            runOnJS(requestClose)();
          } else {
            translateY.value = withSpring(0, OPEN_SPRING);
          }
        }),
    [translateY, requestClose]
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const exerciseIds = useMemo(() => {
    if (!restTimer) return [];
    const ids = [restTimer.exerciseId];
    const nextUp = getNextUp(exercises, restTimer.exerciseId);
    if (nextUp.kind === "exercise") ids.push(nextUp.exercise.id);
    return ids;
  }, [exercises, restTimer]);
  const { exerciseMap } = useLocalizedExerciseMap(exerciseIds);

  const localizedName = useCallback(
    (exercise: WorkoutExercise) =>
      exerciseMap.get(exercise.id)?.name ?? exercise.name,
    [exerciseMap]
  );

  const handleAdjust = useCallback(
    (delta: number) => {
      triggerHaptic(() =>
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      );
      adjustRestTimer(delta);
    },
    [adjustRestTimer]
  );

  const handleSkip = useCallback(() => {
    triggerHaptic(() =>
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    );
    skipRestTimer();
  }, [skipRestTimer]);

  // The bar clears the timer when it hits zero; render an empty modal for the
  // single frame before the parent unmounts this sheet.
  if (!restTimer) return null;

  const exercise = exercises.find((ex) => ex.id === restTimer.exerciseId);
  const { durationSeconds, remainingSeconds, progress } = getRestTimerProgress(
    restTimer.startedAtMs,
    restTimer.durationSeconds,
    now
  );
  const display = formatRestCountdown(remainingSeconds);
  const isAlmostDone = remainingSeconds <= 5;
  const nextUp = getNextUp(exercises, restTimer.exerciseId);
  const nextUpText = describeNextUp();

  function describeNextUp(): string {
    if (nextUp.kind === "done") return t("restTimerBar.allDone");
    if (nextUp.kind === "exercise") return localizedName(nextUp.exercise);

    const { set, workingSetNumber, exercise: setExercise } = nextUp;
    const setLabel =
      workingSetNumber !== null
        ? t("restTimerBar.nextSet", { number: workingSetNumber })
        : t("restTimerBar.nextWarmup");

    let detail: string | null;
    if (setExercise.exerciseType === "time") {
      detail =
        set.durationSeconds !== null
          ? formatExerciseDuration(set.durationSeconds)
          : set.previousDisplay;
    } else if (set.kg && set.reps) {
      detail = `${set.kg} ${weightLabel} × ${set.reps}`;
    } else {
      detail = set.previousDisplay;
    }

    return detail ? `${setLabel} · ${detail}` : setLabel;
  }

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={requestClose}
    >
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents="none"
        />
        <View style={styles.container}>
          <Pressable
            style={styles.flex}
            onPress={requestClose}
            accessibilityRole="button"
            accessibilityLabel={t("restTimerBar.collapse")}
          />
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  backgroundColor: backgroundElevated,
                  paddingBottom: insets.bottom + Spacing.xl,
                },
                sheetStyle,
              ]}
            >
              <View
                style={[styles.handle, { backgroundColor: textDisabled }]}
              />

              <Text
                style={[Typography.label, styles.restLabel, { color: primary }]}
              >
                {t("restTimerBar.restLabel")}
              </Text>
              {exercise ? (
                <Text
                  style={[Typography.titleLg, { color: textColor }]}
                  numberOfLines={2}
                >
                  {localizedName(exercise)}
                </Text>
              ) : null}

              <View style={styles.ringWrap}>
                <Svg width={RING_SIZE} height={RING_SIZE}>
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke={borderSubtle}
                    strokeWidth={RING_STROKE}
                    fill="none"
                  />
                  <Circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    stroke={primary}
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                    fill="none"
                    transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                  />
                </Svg>
                <View style={styles.ringCenter}>
                  <Text
                    style={[
                      styles.countdown,
                      { color: isAlmostDone ? primary : textColor },
                    ]}
                    accessibilityRole="timer"
                    accessibilityLabel={`Rest timer: ${display}`}
                  >
                    {display}
                  </Text>
                  <Text style={[Typography.body, { color: textSecondary }]}>
                    {t("restTimerBar.totalLabel", {
                      duration: formatExerciseDuration(
                        Math.round(durationSeconds)
                      ),
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.adjustRow}>
                <Pressable
                  onPress={() => handleAdjust(-15)}
                  accessibilityRole="button"
                  accessibilityLabel={t("restTimerBar.adjustDown")}
                  style={({ pressed }) => [
                    styles.adjustButton,
                    {
                      backgroundColor: inputFill,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[Typography.titleSm, { color: textColor }]}>
                    {t("restTimerBar.adjustDown")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => handleAdjust(15)}
                  accessibilityRole="button"
                  accessibilityLabel={t("restTimerBar.adjustUp")}
                  style={({ pressed }) => [
                    styles.adjustButton,
                    {
                      backgroundColor: inputFill,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[Typography.titleSm, { color: textColor }]}>
                    {t("restTimerBar.adjustUp")}
                  </Text>
                </Pressable>
              </View>

              <View
                style={[styles.nextUpCard, { backgroundColor: primarySurface }]}
              >
                <IconSymbol
                  name="figure.strengthtraining.traditional"
                  size={20}
                  color={primary}
                />
                <View style={styles.nextUpText}>
                  <Text style={[Typography.label, { color: textMuted }]}>
                    {t("restTimerBar.upNext")}
                  </Text>
                  <Text
                    style={[Typography.bodyMedium, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {nextUpText}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleSkip}
                accessibilityRole="button"
                accessibilityLabel={t("restTimerBar.skipRest")}
                style={({ pressed }) => [
                  styles.skipButton,
                  { backgroundColor: primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[Typography.titleSm, styles.skipText]}>
                  {t("restTimerBar.skipRest")}
                </Text>
              </Pressable>
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  container: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg + 6,
    borderTopRightRadius: Radii.lg + 6,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    alignItems: "center",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    marginBottom: Spacing.lg,
  },
  restLabel: {
    marginBottom: Spacing.xs,
  },
  ringWrap: {
    marginVertical: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  ringCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  countdown: {
    fontSize: 52,
    fontWeight: "700",
    letterSpacing: -1,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
  },
  adjustRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  adjustButton: {
    flex: 1,
    borderRadius: Radii.full,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  nextUpCard: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: Spacing.md,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xl,
  },
  nextUpText: {
    flex: 1,
    gap: 2,
  },
  skipButton: {
    alignSelf: "stretch",
    borderRadius: Radii.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  skipText: {
    color: "#FFFFFF",
  },
});
