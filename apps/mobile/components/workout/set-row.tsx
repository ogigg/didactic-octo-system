import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { RpePicker } from "@/components/workout/rpe-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { WorkoutSet } from "@/stores/workout-store";
import * as Haptics from "expo-haptics";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useTranslation } from "react-i18next";

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
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onToggleComplete();
  }, [onToggleComplete]);

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
    swipeableRef.current?.close();
    onRemove();
  }, [onRemove]);

  const handleKgSubmit = useCallback(() => {
    repsRef.current?.focus();
  }, []);

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0.5],
      extrapolate: "clamp",
    });

    return (
      <Pressable
        onPress={handleDelete}
        accessibilityRole="button"
        accessibilityLabel={t("exercise.removeSet")}
        style={[styles.deleteAction, { backgroundColor: errorColor }]}
      >
        <Animated.View style={{ transform: [{ scale }] }}>
          <IconSymbol name="trash" size={20} color="#FFFFFF" />
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      overshootRight={false}
    >
      <View style={[styles.row, set.isCompleted && styles.completedRow]}>
        <Text
          style={[Typography.caption, styles.setCol, { color: setLabelColor }]}
        >
          {setLabel}
        </Text>

        <Pressable
          onLongPress={handleFillFromPrevious}
          delayLongPress={300}
          style={styles.prevCol}
          accessibilityRole="button"
          accessibilityLabel={
            set.previousDisplay
              ? `Previous: ${set.previousDisplay}. Long press to fill.`
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

        <Pressable
          onPress={handleToggleComplete}
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
  deleteAction: {
    justifyContent: "center",
    alignItems: "center",
    width: 72,
  },
});
