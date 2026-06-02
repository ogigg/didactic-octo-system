import { useThemeColor } from "@/hooks/use-theme-color";
import {
  Elevation,
  Fonts,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useWorkoutStore } from "@/stores/workout-store";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

export interface RestTimerProgress {
  durationSeconds: number;
  remainingSeconds: number;
  progress: number;
}

export function getRestTimerProgress(
  startedAtMs: number,
  durationSeconds: number,
  nowMs: number
): RestTimerProgress {
  const safeDurationSeconds = Math.max(1, durationSeconds);
  const elapsedSeconds = (nowMs - startedAtMs) / 1000;
  const remainingSeconds = Math.min(
    safeDurationSeconds,
    Math.max(0, safeDurationSeconds - elapsedSeconds)
  );

  return {
    durationSeconds: safeDurationSeconds,
    remainingSeconds,
    progress: remainingSeconds / safeDurationSeconds,
  };
}

export function RestTimerBar() {
  const { t } = useTranslation("workout");
  const restTimer = useWorkoutStore((s) => s.restTimer);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((s) => s.skipRestTimer);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const border = useThemeColor({}, "border");

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!restTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [restTimer]);

  if (!restTimer) return null;

  const {
    durationSeconds,
    remainingSeconds: remaining,
    progress,
  } = getRestTimerProgress(
    restTimer.startedAtMs,
    restTimer.durationSeconds,
    now
  );

  // Auto-dismiss when timer reaches 0
  if (remaining <= 0) {
    // Schedule skip for next tick to avoid state update during render
    setTimeout(() => skipRestTimer(), 0);
    return null;
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = Math.floor(remaining % 60);
  const display = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: backgroundElevated, borderColor: border },
        Elevation.sm,
      ]}
    >
      <View style={styles.content}>
        <Pressable
          onPress={() => adjustRestTimer(-15)}
          accessibilityRole="button"
          accessibilityLabel={t("restTimerBar.adjustDown")}
          style={[styles.adjustButton, { backgroundColor: borderSubtle }]}
        >
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {t("restTimerBar.adjustDown")}
          </Text>
        </Pressable>

        <View style={styles.timerSection}>
          <Text
            style={[styles.countdown, { color: textColor }]}
            accessibilityRole="timer"
            accessibilityLabel={`Rest timer: ${display}`}
          >
            {display}
          </Text>
          <View
            style={[styles.progressTrack, { backgroundColor: borderSubtle }]}
            accessibilityRole="progressbar"
            accessibilityValue={{
              min: 0,
              max: durationSeconds,
              now: Math.ceil(remaining),
            }}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: primary,
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>
        </View>

        <Pressable
          onPress={() => adjustRestTimer(15)}
          accessibilityRole="button"
          accessibilityLabel={t("restTimerBar.adjustUp")}
          style={[styles.adjustButton, { backgroundColor: borderSubtle }]}
        >
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {t("restTimerBar.adjustUp")}
          </Text>
        </Pressable>

        <Pressable
          onPress={skipRestTimer}
          accessibilityRole="button"
          accessibilityLabel={t("restTimerBar.skip")}
          style={styles.skipButton}
        >
          <Text style={[Typography.bodyMedium, { color: primary }]}>
            {t("restTimerBar.skip")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  adjustButton: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  timerSection: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  countdown: {
    ...Typography.displaySm,
    fontFamily: Fonts?.mono,
    fontVariant: ["tabular-nums"],
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: Radii.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radii.full,
  },
  skipButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
});
