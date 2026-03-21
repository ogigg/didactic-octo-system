import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { RpePicker } from "@/components/workout/rpe-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { WorkoutSet } from "@/stores/workout-store";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SetRowProps {
  set: WorkoutSet;
  setIndex: number;
  exerciseId: string;
  onToggleComplete: () => void;
  onUpdateField: (field: "kg" | "reps", value: string) => void;
  onUpdateRpe: (rpe: number | null) => void;
  onRemove: () => void;
}

export function SetRow({
  set,
  setIndex,
  onToggleComplete,
  onUpdateField,
  onUpdateRpe,
  onRemove,
}: SetRowProps) {
  const { t } = useTranslation("workout");
  const [rpePickerVisible, setRpePickerVisible] = useState(false);
  const [kgFocused, setKgFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const kgRef = useRef<TextInput>(null);
  const repsRef = useRef<TextInput>(null);
  const completeScale = useRef(new Animated.Value(1)).current;
  const completeRing = useRef(new Animated.Value(0)).current;

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
    // Parse "80×8" or "80x8" format
    const match = set.previousDisplay.match(/^([\d.]+)[×x]([\d.]+)$/);
    if (match) {
      if (Platform.OS === "ios") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      onUpdateField("kg", match[1]);
      onUpdateField("reps", match[2]);
    }
  }, [set.previousDisplay, onUpdateField]);

  const handleDelete = useCallback(() => {
    if (Platform.OS === "ios") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    swipeableRef.current?.close();
    onRemove();
  }, [onRemove]);

  const handleSwipeableOpen = useCallback(
    (direction: "left" | "right") => {
      if (direction === "right") {
        handleDelete();
      }
    },
    [handleDelete]
  );

  const handleKgSubmit = useCallback(() => {
    repsRef.current?.focus();
  }, []);

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

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-96, -24, 0],
      outputRange: [1.08, 0.92, 0.84],
      extrapolate: "clamp",
    });
    const opacity = dragX.interpolate({
      inputRange: [-96, -64, -28, 0],
      outputRange: [1, 0.9, 0.45, 0.25],
      extrapolate: "clamp",
    });
    const translateX = dragX.interpolate({
      inputRange: [-96, 0],
      outputRange: [0, 18],
      extrapolate: "clamp",
    });
    const actionScaleX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.78, 1],
      extrapolate: "clamp",
    });

    return (
      <Animated.View
        style={[
          styles.deleteAction,
          {
            backgroundColor: errorColor,
            transform: [{ translateX }, { scaleX: actionScaleX }],
          },
        ]}
      >
        <View style={styles.deleteActionContent}>
          <Pressable
            onPress={handleDelete}
            accessibilityRole="button"
            accessibilityLabel={t("exercise.removeSet")}
            style={styles.deletePressable}
          >
            <Animated.View style={{ transform: [{ scale }], opacity }}>
              <IconSymbol name="trash" size={20} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={56}
      overshootRight={false}
      friction={1.8}
      onSwipeableOpen={handleSwipeableOpen}
    >
      <View style={[styles.row, set.isCompleted && styles.completedRow]}>
        <Text
          style={[Typography.caption, styles.setCol, { color: setLabelColor }]}
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
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={textDisabled}
          accessibilityLabel={`Weight in kg for set ${setLabel}`}
          selectTextOnFocus
        />

        <TextInput
          ref={repsRef}
          style={[
            styles.input,
            {
              backgroundColor: repsFocused ? inputFillFocused : inputFill,
              color: textColor,
              borderColor: repsFocused ? primary : "transparent",
            },
          ]}
          value={set.reps}
          onChangeText={handleRepsChange}
          onFocus={() => setRepsFocused(true)}
          onBlur={() => setRepsFocused(false)}
          returnKeyType="done"
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={textDisabled}
          accessibilityLabel={`Reps for set ${setLabel}`}
          selectTextOnFocus
        />

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
                  backgroundColor: set.isCompleted ? success : "transparent",
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
    </Swipeable>
  );
}

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
    borderRadius: 999,
    borderWidth: 2,
  },
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionContent: {
    width: 72,
    height: "100%",
  },
  deletePressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});
