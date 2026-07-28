import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  Elevation,
  Fonts,
  Radii,
  Spacing,
  Typography,
} from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { buildRestTimerNotificationContent } from "@/lib/rest-timer-notification-content";
import {
  formatRestCountdown,
  getNextUp,
  getRestTimerProgress,
} from "@/lib/rest-timer";
import {
  cancelScheduledRestTimerNotification,
  scheduleRestTimerCompletionNotification,
  type RestTimerNotificationScheduleStatus,
} from "@/lib/rest-timer-notifications";
import { playRestTimerCompleteSound } from "@/lib/rest-timer-sound";
import { useWorkoutStore } from "@/stores/workout-store";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { RestTimerSheet } from "./rest-timer-sheet";

export { getRestTimerProgress } from "@/lib/rest-timer";
export type { RestTimerProgress } from "@/lib/rest-timer";

export function RestTimerBar() {
  const { t } = useTranslation("workout");
  const restTimer = useWorkoutStore((s) => s.restTimer);
  const exercises = useWorkoutStore((s) => s.exercises);
  const adjustRestTimer = useWorkoutStore((s) => s.adjustRestTimer);
  const skipRestTimer = useWorkoutStore((s) => s.skipRestTimer);

  const notificationContent = useMemo(() => {
    if (!restTimer) return null;
    return buildRestTimerNotificationContent(
      t,
      getNextUp(exercises, restTimer.exerciseId)
    );
  }, [exercises, restTimer, t]);

  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const border = useThemeColor({}, "border");

  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);
  const [notificationStatus, setNotificationStatus] =
    useState<RestTimerNotificationScheduleStatus | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const backgroundedUntilCompletionRef = useRef(false);

  useEffect(() => {
    if (!restTimer) return;
    const interval = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(interval);
  }, [restTimer]);

  useEffect(() => {
    if (!restTimer) {
      backgroundedUntilCompletionRef.current = false;
      return;
    }

    backgroundedUntilCompletionRef.current = false;
    const endsAtMs = restTimer.startedAtMs + restTimer.durationSeconds * 1000;

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;

      if (nextState !== "active") {
        backgroundedUntilCompletionRef.current = true;
        return;
      }

      if (Date.now() < endsAtMs) {
        backgroundedUntilCompletionRef.current = false;
      }
    });

    return () => subscription.remove();
  }, [restTimer]);

  useEffect(() => {
    if (!restTimer || !notificationContent) {
      setNotificationStatus(null);
      void cancelScheduledRestTimerNotification();
      return;
    }

    let isDisposed = false;
    const endsAtMs = restTimer.startedAtMs + restTimer.durationSeconds * 1000;
    setNotificationStatus(null);

    scheduleRestTimerCompletionNotification({
      ...notificationContent,
      endsAtMs,
    }).then((status) => {
      if (!isDisposed) setNotificationStatus(status);
    });

    return () => {
      isDisposed = true;
      void cancelScheduledRestTimerNotification();
    };
  }, [notificationContent, restTimer]);

  // Collapse the sheet whenever the timer goes away (skip, finish, etc.)
  useEffect(() => {
    if (!restTimer) setExpanded(false);
  }, [restTimer]);

  const isFinished = restTimer
    ? getRestTimerProgress(
        restTimer.startedAtMs,
        restTimer.durationSeconds,
        now
      ).remainingSeconds <= 0
    : false;

  useEffect(() => {
    if (!isFinished) return;
    void cancelScheduledRestTimerNotification();

    const shouldPlayForegroundAlert =
      appStateRef.current !== "background" &&
      appStateRef.current !== "inactive" &&
      !backgroundedUntilCompletionRef.current;

    if (shouldPlayForegroundAlert) {
      void playRestTimerCompleteSound();
    }

    if (shouldPlayForegroundAlert && Platform.OS === "ios") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    skipRestTimer();
  }, [isFinished, skipRestTimer]);

  const handleExpand = useCallback(() => {
    if (Platform.OS === "ios") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setExpanded(true);
  }, []);

  const handleCollapse = useCallback(() => setExpanded(false), []);

  if (!restTimer || isFinished) return null;

  const {
    durationSeconds,
    remainingSeconds: remaining,
    progress,
  } = getRestTimerProgress(
    restTimer.startedAtMs,
    restTimer.durationSeconds,
    now
  );

  const display = formatRestCountdown(remaining);

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

        <Pressable
          onPress={handleExpand}
          accessibilityRole="button"
          accessibilityLabel={t("restTimerBar.expand")}
          style={styles.timerSection}
        >
          <View style={styles.countdownRow}>
            <Text
              style={[styles.countdown, { color: textColor }]}
              accessibilityRole="timer"
              accessibilityLabel={`Rest timer: ${display}`}
            >
              {display}
            </Text>
            <IconSymbol name="chevron.up" size={16} color={textMuted} />
          </View>
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
        </Pressable>

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

      {notificationStatus === "permission-denied" && (
        <Text style={[styles.permissionText, { color: textSecondary }]}>
          {t("restTimerNotification.permissionDenied")}
        </Text>
      )}

      {expanded && <RestTimerSheet onClose={handleCollapse} />}
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
  countdownRow: {
    flexDirection: "row",
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
  permissionText: {
    ...Typography.caption,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    textAlign: "center",
  },
});
