import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { RpePicker } from "@/components/workout/rpe-picker";
import { IconSymbol } from "@/components/ui/icon-symbol";
import type { WorkoutSet } from "@/stores/workout-store";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
}: SetRowProps) {
  const [rpePickerVisible, setRpePickerVisible] = useState(false);
  const [kgFocused, setKgFocused] = useState(false);
  const [repsFocused, setRepsFocused] = useState(false);

  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const success = useThemeColor({}, "success");
  const warning = useThemeColor({}, "warning");

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

  return (
    <View style={[styles.row, set.isCompleted && styles.completedRow]}>
      <Text
        style={[Typography.caption, styles.setCol, { color: setLabelColor }]}
      >
        {setLabel}
      </Text>

      <Text style={[Typography.caption, styles.prevCol, { color: textMuted }]}>
        {set.previousDisplay ?? "-"}
      </Text>

      <TextInput
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
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={textDisabled}
        accessibilityLabel={`Weight in kg for set ${setLabel}`}
        selectTextOnFocus
      />

      <TextInput
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
        onPress={onToggleComplete}
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
    textAlign: "center",
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
});
