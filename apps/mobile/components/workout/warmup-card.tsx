import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { useWorkoutStore } from "@/stores/workout-store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function WarmupCard() {
  const { t } = useTranslation("workout");
  const warmup = useWorkoutStore((s) => s.warmup);
  const toggleWarmupComplete = useWorkoutStore((s) => s.toggleWarmupComplete);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const border = useThemeColor({}, "border");
  const inputFill = useThemeColor({}, "inputFill");
  const primary = useThemeColor({}, "primary");
  const primaryContainer = useThemeColor({}, "primaryContainer");
  const success = useThemeColor({}, "success");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");

  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    warmup?.durationSeconds ?? 0
  );
  const endsAtMsRef = useRef<number | null>(null);

  useEffect(() => {
    if (!warmup) return;
    setRemainingSeconds(warmup.durationSeconds);
    setIsRunning(false);
    endsAtMsRef.current = null;
  }, [warmup?.durationSeconds]);

  useEffect(() => {
    if (!isRunning || !warmup) return;

    const interval = setInterval(() => {
      if (!endsAtMsRef.current) return;
      const nextRemaining = Math.max(
        0,
        Math.ceil((endsAtMsRef.current - Date.now()) / 1000)
      );
      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0) {
        clearInterval(interval);
        setIsRunning(false);
        endsAtMsRef.current = null;
        if (!warmup.isCompleted) {
          toggleWarmupComplete();
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [isRunning, toggleWarmupComplete, warmup]);

  const progress = useMemo(() => {
    if (!warmup || warmup.durationSeconds <= 0) return 0;
    return Math.min(
      1,
      Math.max(
        0,
        (warmup.durationSeconds - remainingSeconds) / warmup.durationSeconds
      )
    );
  }, [remainingSeconds, warmup]);

  const handleToggleTimer = useCallback(() => {
    if (!warmup || warmup.isCompleted) return;

    if (isRunning) {
      setIsRunning(false);
      endsAtMsRef.current = null;
      return;
    }

    endsAtMsRef.current = Date.now() + remainingSeconds * 1000;
    setIsRunning(true);
  }, [isRunning, remainingSeconds, warmup]);

  const handleReset = useCallback(() => {
    if (!warmup) return;
    setIsRunning(false);
    setRemainingSeconds(warmup.durationSeconds);
    endsAtMsRef.current = null;
  }, [warmup]);

  if (!warmup) return null;

  const displayTime = formatExerciseDuration(remainingSeconds);
  const completed = warmup.isCompleted;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: completed ? primaryContainer : backgroundElevated,
          borderColor: completed ? success : border,
        },
      ]}
    >
      <View style={styles.header}>
        <View
          style={[
            styles.iconBadge,
            { backgroundColor: completed ? success : primaryContainer },
          ]}
        >
          <IconSymbol
            name="timer"
            size={18}
            color={completed ? "#FFFFFF" : primary}
          />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("warmup.title")}
          </Text>
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {completed
              ? t("warmup.completed")
              : t("warmup.subtitle", {
                  time: formatExerciseDuration(warmup.durationSeconds),
                })}
          </Text>
        </View>
        <Pressable
          onPress={toggleWarmupComplete}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={
            completed ? t("warmup.markIncomplete") : t("warmup.markComplete")
          }
          style={[
            styles.doneButton,
            { backgroundColor: completed ? success : inputFill },
          ]}
        >
          <IconSymbol
            name="checkmark"
            size={18}
            color={completed ? "#FFFFFF" : textMuted}
          />
        </Pressable>
      </View>

      <View style={styles.timerRow}>
        <Text
          style={[styles.timerText, { color: completed ? success : primary }]}
          accessibilityRole="timer"
          accessibilityLabel={t("warmup.timerLabel", { time: displayTime })}
        >
          {displayTime}
        </Text>
        <View style={styles.controls}>
          <Pressable
            onPress={handleToggleTimer}
            disabled={completed}
            accessibilityRole="button"
            accessibilityState={{ disabled: completed }}
            accessibilityLabel={
              isRunning ? t("warmup.pause") : t("warmup.start")
            }
            style={[
              styles.controlButton,
              { backgroundColor: completed ? inputFill : primary },
            ]}
          >
            <IconSymbol
              name={isRunning ? "pause.fill" : "play.fill"}
              size={18}
              color="#FFFFFF"
            />
          </Pressable>
          <Pressable
            onPress={handleReset}
            disabled={completed}
            accessibilityRole="button"
            accessibilityState={{ disabled: completed }}
            accessibilityLabel={t("warmup.reset")}
            style={[styles.controlButton, { backgroundColor: inputFill }]}
          >
            <IconSymbol
              name="arrow.counterclockwise"
              size={18}
              color={textSecondary}
            />
          </Pressable>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: inputFill }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: completed ? success : primary,
              width: `${completed ? 100 : progress * 100}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radii.md,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  doneButton: {
    width: 40,
    height: 40,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  timerText: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
  },
  controls: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 5,
    borderRadius: Radii.full,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
  },
});
