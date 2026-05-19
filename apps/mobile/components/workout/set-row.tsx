import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { RpePicker } from "@/components/workout/rpe-picker";
import { SetTimerCell } from "@/components/workout/set-timer-cell";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { parseExerciseDuration } from "@/lib/format-exercise-duration";
import { parsePreviousWeightDisplay } from "@/lib/workout-previous-sets";
import type { WorkoutSet } from "@/stores/workout-store";
import * as Haptics from "expo-haptics";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";

interface SetRowProps {
  set: WorkoutSet;
  setIndex: number;
  exerciseId: string;
  exerciseType?: "weight" | "time";
  onToggleComplete: () => void;
  onUpdateField: (field: "kg" | "reps", value: string) => void;
  onUpdateDuration: (durationSeconds: number | null) => void;
  onUpdateRpe: (rpe: number | null) => void;
  onRemove: () => void;
  onSubmitReps?: () => void;
}

export interface SetRowHandle {
  focusFirstInput: () => void;
}

export const SetRow = forwardRef<SetRowHandle, SetRowProps>(function SetRow(
  {
    set,
    setIndex,
    exerciseType = "weight",
    onToggleComplete,
    onUpdateField,
    onUpdateDuration,
    onUpdateRpe,
    onRemove,
    onSubmitReps,
  }: SetRowProps,
  ref
) {
  const { label: unitLabel } = useWeightUnit();
  const [rpePickerVisible, setRpePickerVisible] = useState(false);
  const [kgFocused, setKgFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);
  const kgRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);
  const completeScale = useRef(new Animated.Value(1)).current;
  const completeRing = useRef(new Animated.Value(0)).current;

  const screenWidth = Dimensions.get("window").width;
  const translateX = useRef(new Animated.Value(0)).current;
  const rowHeight = useRef(new Animated.Value(64)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const isDeleting = useRef(false);

  useEffect(() => {
    return () => {
      translateX.stopAnimation();
      rowHeight.stopAnimation();
      rowOpacity.stopAnimation();
    };
  }, []);

  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const success = useThemeColor({}, "success");
  const warning = useThemeColor({}, "warning");
  const errorColor = useThemeColor({}, "error");

  const isWarmup = set.type === "warmup";
  const workingIndex = set.type === "working" ? setIndex + 1 : null;
  const setLabel = isWarmup ? "W" : String(workingIndex);
  const setLabelColor = isWarmup ? warning : textSecondary;

  const handleKgChange = useCallback(
    (value: string) => onUpdateField("kg", value),
    [onUpdateField]
  );

  const handleRepsChange = useCallback(
    (value: string) => onUpdateField("reps", value),
    [onUpdateField]
  );

  const handleToggleComplete = useCallback(() => {
    const nextIsCompleted = !set.isCompleted;

    Animated.sequence([
      Animated.spring(completeScale, {
        toValue: 0.9,
        tension: 240,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.spring(completeScale, {
        toValue: 1.12,
        tension: 220,
        friction: 11,
        useNativeDriver: true,
      }),
      Animated.spring(completeScale, {
        toValue: 1,
        tension: 210,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();

    if (nextIsCompleted) {
      completeRing.setValue(0);
      Animated.timing(completeRing, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => completeRing.setValue(0));
    }

    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onToggleComplete();
  }, [completeRing, completeScale, onToggleComplete, set.isCompleted]);

  const handleCompletePressIn = useCallback(() => {
    Animated.spring(completeScale, {
      toValue: 0.93,
      tension: 260,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [completeScale]);

  const handleCompletePressOut = useCallback(() => {
    Animated.spring(completeScale, {
      toValue: 1,
      tension: 220,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [completeScale]);

  const handleFillFromPrevious = useCallback(() => {
    if (!set.previousDisplay) return;
    if (exerciseType === "time") {
      const seconds = parseExerciseDuration(set.previousDisplay);
      if (seconds !== null) {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onUpdateDuration(seconds);
      }
    } else {
      const previous = parsePreviousWeightDisplay(set.previousDisplay);
      if (previous) {
        if (Platform.OS === "ios") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onUpdateField("kg", previous.load);
        onUpdateField("reps", previous.reps);
      }
    }
  }, [set.previousDisplay, exerciseType, onUpdateField, onUpdateDuration]);

  const springBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      tension: 180,
      friction: 14,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const triggerDelete = useCallback(() => {
    if (isDeleting.current) return;
    isDeleting.current = true;

    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }

    Animated.timing(translateX, {
      toValue: -screenWidth,
      duration: 200,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(rowHeight, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(rowOpacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start(() => onRemove());
  }, [translateX, rowHeight, rowOpacity, screenWidth, onRemove]);

  const onGestureEvent = useCallback(
    (e: { nativeEvent: { translationX: number } }) => {
      if (isDeleting.current) return;
      const clamped = Math.min(
        Math.max(e.nativeEvent.translationX, -screenWidth),
        0
      );
      translateX.setValue(clamped);
    },
    [translateX, screenWidth]
  );

  const onHandlerStateChange = useCallback(
    (e: { nativeEvent: { state: number; translationX: number } }) => {
      const { state, translationX: tx } = e.nativeEvent;
      if (state === State.END) {
        if (tx <= -80) {
          triggerDelete();
        } else {
          springBack();
        }
      } else if (state === State.CANCELLED || state === State.FAILED) {
        springBack();
      }
    },
    [triggerDelete, springBack]
  );

  const handleKgSubmit = useCallback(() => {
    repsRef.current?.focus();
  }, []);

  const handleRepsSubmit = useCallback(() => {
    onSubmitReps?.();
  }, [onSubmitReps]);

  useImperativeHandle(
    ref,
    () => ({
      focusFirstInput: () => {
        kgRef.current?.focus();
      },
    }),
    []
  );

  const completeRingScale = completeRing.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 1.9],
    extrapolate: "clamp",
  });
  const completeRingOpacity = completeRing.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.35, 0],
    extrapolate: "clamp",
  });

  const errorColorTransparent = errorColor + "00";

  const swipeBackgroundColor = translateX.interpolate({
    inputRange: [-120, 0],
    outputRange: [errorColor, errorColorTransparent],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      style={{ height: rowHeight, opacity: rowOpacity, overflow: "hidden" }}
      onLayout={(e) => {
        if (!isDeleting.current) {
          rowHeight.setValue(e.nativeEvent.layout.height);
        }
      }}
    >
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-8, 8]}
        failOffsetY={[-12, 12]}
      >
        <Animated.View style={{ transform: [{ translateX }] }}>
          {/* Red delete background */}
          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { backgroundColor: swipeBackgroundColor },
            ]}
          />

          {/* Row content */}
          <View style={[styles.row, set.isCompleted && styles.completedRow]}>
            <Text
              style={[
                Typography.caption,
                styles.setCol,
                { color: setLabelColor },
              ]}
            >
              {setLabel}
            </Text>

            <Pressable
              onPress={handleFillFromPrevious}
              style={styles.prevCol}
              accessibilityRole="button"
              accessibilityLabel={
                set.previousDisplay
                  ? `Previous: ${set.previousDisplay}. Tap to fill.`
                  : "No previous data"
              }
            >
              <Text style={[Typography.caption, { color: textMuted }]}>
                {set.previousDisplay ?? "-"}
              </Text>
            </Pressable>

            {exerciseType === "time" ? (
              <SetTimerCell
                durationSeconds={set.durationSeconds}
                setLabel={setLabel}
                onUpdateDuration={onUpdateDuration}
              />
            ) : (
              <>
                <TextInput
                  ref={kgRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: kgFocused ? inputFillFocused : inputFill,
                      color: textColor,
                      borderColor: kgFocused ? primary : "transparent",
                    },
                  ]}
                  value={set.kg}
                  onChangeText={handleKgChange}
                  onFocus={() => setKgFocused(true)}
                  onBlur={() => setKgFocused(false)}
                  onSubmitEditing={handleKgSubmit}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={textDisabled}
                  accessibilityLabel={`Weight in ${unitLabel} for set ${setLabel}`}
                  selectTextOnFocus
                />

                <TextInput
                  ref={repsRef}
                  style={[
                    styles.input,
                    {
                      backgroundColor: repsFocused
                        ? inputFillFocused
                        : inputFill,
                      color: textColor,
                      borderColor: repsFocused ? primary : "transparent",
                    },
                  ]}
                  value={set.reps}
                  onChangeText={handleRepsChange}
                  onFocus={() => setRepsFocused(true)}
                  onBlur={() => setRepsFocused(false)}
                  onSubmitEditing={handleRepsSubmit}
                  returnKeyType={onSubmitReps ? "next" : "done"}
                  blurOnSubmit={onSubmitReps ? false : undefined}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={textDisabled}
                  accessibilityLabel={`Reps for set ${setLabel}`}
                  selectTextOnFocus
                />
              </>
            )}

            <Pressable
              onPress={() => setRpePickerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`RPE for set ${setLabel}: ${set.rpe ?? "not set"}`}
              style={[styles.rpeButton, { backgroundColor: inputFill }]}
            >
              <Text
                style={[
                  Typography.caption,
                  { color: set.rpe ? textColor : textDisabled },
                ]}
              >
                {set.rpe ?? "--"}
              </Text>
            </Pressable>

            <View style={styles.checkboxWrapper}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.completeRing,
                  {
                    borderColor: success,
                    opacity: completeRingOpacity,
                    transform: [{ scale: completeRingScale }],
                  },
                ]}
              />
              <Animated.View style={{ transform: [{ scale: completeScale }] }}>
                <Pressable
                  onPress={handleToggleComplete}
                  onPressIn={handleCompletePressIn}
                  onPressOut={handleCompletePressOut}
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Set ${setLabel}: ${set.isCompleted ? "completed" : "not completed"}`}
                  accessibilityState={{ checked: set.isCompleted }}
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: set.isCompleted
                        ? success
                        : "transparent",
                      borderColor: set.isCompleted ? success : textDisabled,
                    },
                  ]}
                >
                  {set.isCompleted && (
                    <IconSymbol name="checkmark" size={14} color="#FFFFFF" />
                  )}
                </Pressable>
              </Animated.View>
            </View>

            <RpePicker
              visible={rpePickerVisible}
              currentValue={set.rpe}
              onSelect={onUpdateRpe}
              onClose={() => setRpePickerVisible(false)}
            />
          </View>
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 0,
  },
  completedRow: {
    opacity: 0.7,
  },
  setCol: {
    width: 32,
    textAlign: "center",
    fontWeight: "600",
  },
  prevCol: {
    flex: 1,
    alignItems: "center",
  },
  input: {
    width: 56,
    height: 36,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    textAlign: "center",
    ...Typography.bodyMedium,
    fontVariant: ["tabular-nums"],
    marginHorizontal: 3,
  },
  rpeButton: {
    width: 44,
    height: 36,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 2,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  checkboxWrapper: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  completeRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: Radii.full,
    borderWidth: 2,
  },
});
