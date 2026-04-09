import { IconSymbol } from "@/components/ui/icon-symbol";
import { DurationPicker } from "@/components/workout/duration-picker";
import { Radii, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface SetTimerCellProps {
  durationSeconds: number | null;
  setLabel: string;
  onUpdateDuration: (seconds: number) => void;
}

export function SetTimerCell({
  durationSeconds,
  setLabel,
  onUpdateDuration,
}: SetTimerCellProps) {
  const { t } = useTranslation("workout");
  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textDisabled = useThemeColor({}, "textDisabled");

  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [pickerVisible, setPickerVisible] = useState(false);

  const startMsRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    if (elapsed > 0) {
      onUpdateDuration(elapsed);
    }
    setElapsed(0);
    startMsRef.current = null;
  }, [elapsed, onUpdateDuration]);

  const startTimer = useCallback(() => {
    setElapsed(0);
    startMsRef.current = Date.now();
    setIsRunning(true);
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        if (startMsRef.current !== null) {
          setElapsed(Math.floor((Date.now() - startMsRef.current) / 1000));
        }
      }, 100);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const displayValue = isRunning
    ? formatExerciseDuration(elapsed)
    : durationSeconds != null
      ? formatExerciseDuration(durationSeconds)
      : null;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => {
          if (!isRunning) setPickerVisible(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          displayValue
            ? `Duration for set ${setLabel}: ${displayValue}. Tap to edit.`
            : `Set duration for set ${setLabel}. Tap to enter.`
        }
        style={[
          styles.timeDisplay,
          {
            backgroundColor: isRunning ? inputFillFocused : inputFill,
            borderColor: isRunning ? primary : "transparent",
          },
        ]}
      >
        <Text
          style={[
            styles.timeText,
            {
              color: isRunning
                ? primary
                : displayValue
                  ? textColor
                  : textDisabled,
            },
          ]}
        >
          {displayValue ?? "--:--"}
        </Text>
      </Pressable>

      <Pressable
        onPress={isRunning ? stopTimer : startTimer}
        accessibilityRole="button"
        accessibilityLabel={
          isRunning ? t("setTimer.stop") : t("setTimer.start")
        }
        style={[styles.timerBtn, { backgroundColor: inputFill }]}
        hitSlop={4}
      >
        <IconSymbol
          name={isRunning ? "stop.fill" : "play.fill"}
          size={14}
          color={isRunning ? primary : primary}
        />
      </Pressable>

      <DurationPicker
        visible={pickerVisible}
        currentSeconds={durationSeconds}
        onSelect={onUpdateDuration}
        onClose={() => setPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginHorizontal: 3,
  },
  timeDisplay: {
    flex: 1,
    height: 36,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  timeText: {
    ...Typography.bodyMedium,
    fontVariant: ["tabular-nums"],
  },
  timerBtn: {
    width: 32,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
});
