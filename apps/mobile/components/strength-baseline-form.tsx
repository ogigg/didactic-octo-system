import { useState } from "react";
import type { Equipment, StrengthBaseline } from "@/stores/onboarding-store";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";

import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";

interface BaselineField {
  exercise_key: string;
  label: string;
  hasLoad: boolean;
  /** If true, show only when equipment allows load exercises */
  requiresLoadEquipment: boolean;
}

const BASELINE_FIELDS: BaselineField[] = [
  {
    exercise_key: "pushups",
    label: "Push-ups",
    hasLoad: false,
    requiresLoadEquipment: false,
  },
  {
    exercise_key: "pullups",
    label: "Pull-ups / Chin-ups",
    hasLoad: false,
    requiresLoadEquipment: false,
  },
  {
    exercise_key: "db_bench",
    label: "Dumbbell Bench Press",
    hasLoad: true,
    requiresLoadEquipment: true,
  },
  {
    exercise_key: "db_row",
    label: "Dumbbell Row",
    hasLoad: true,
    requiresLoadEquipment: true,
  },
  {
    exercise_key: "bb_bench",
    label: "Barbell Bench Press",
    hasLoad: true,
    requiresLoadEquipment: true,
  },
  {
    exercise_key: "bb_squat",
    label: "Barbell Squat",
    hasLoad: true,
    requiresLoadEquipment: true,
  },
  {
    exercise_key: "deadlift",
    label: "Deadlift",
    hasLoad: true,
    requiresLoadEquipment: true,
  },
];

interface StrengthBaselineFormProps {
  equipment: Equipment | null;
  experience: "beginner" | "intermediate" | "advanced" | null;
  baselines: StrengthBaseline[];
  onChange: (baselines: StrengthBaseline[]) => void;
}

export function StrengthBaselineForm({
  equipment,
  experience,
  baselines,
  onChange,
}: StrengthBaselineFormProps) {
  const { label: unitLabel } = useWeightUnit();
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const inputFill = useThemeColor({}, "inputFill");

  const showLoadExercises =
    equipment === "dumbbells" || equipment === "full_gym";
  const showFullGymOnly = equipment === "full_gym";
  // Hide pullups for bodyweight beginners (can't do them yet)
  const hidePullups = equipment === "bodyweight" && experience === "beginner";

  function getBaseline(key: string): StrengthBaseline | undefined {
    return baselines.find((b) => b.exercise_key === key);
  }

  function updateBaseline(
    key: string,
    field: "load_kg" | "reps",
    rawValue: string
  ) {
    const numericValue = rawValue === "" ? null : Number(rawValue);
    if (rawValue !== "" && numericValue !== null && isNaN(numericValue)) return;

    const existing = baselines.find((b) => b.exercise_key === key);
    let updated: StrengthBaseline[];
    if (existing) {
      updated = baselines.map((b) =>
        b.exercise_key === key ? { ...b, [field]: numericValue } : b
      );
    } else {
      updated = [
        ...baselines,
        { exercise_key: key, load_kg: null, reps: 0, [field]: numericValue },
      ];
    }

    // Remove entries that have no meaningful data
    const cleaned = updated.filter((b) => b.load_kg !== null || b.reps !== 0);
    onChange(cleaned);
  }

  const visibleFields = BASELINE_FIELDS.filter((f) => {
    if (f.exercise_key === "pullups" && hidePullups) return false;

    // Bodyweight-only exercises: always show pushups and pullups
    if (!f.requiresLoadEquipment) return true;

    // Load exercises need dumbbells+
    if (!showLoadExercises) return false;

    // Barbell and deadlift only for full gym
    if (
      (f.exercise_key === "bb_bench" ||
        f.exercise_key === "bb_squat" ||
        f.exercise_key === "deadlift") &&
      !showFullGymOnly
    ) {
      return false;
    }

    return true;
  });

  // Split into bodyweight and load sections
  const bodyweightFields = visibleFields.filter((f) => !f.hasLoad);
  const loadFields = visibleFields.filter((f) => f.hasLoad);

  return (
    <View>
      {bodyweightFields.map((field) => (
        <BaselineRow
          key={field.exercise_key}
          label={field.label}
          hasLoad={false}
          loadKg={getBaseline(field.exercise_key)?.load_kg ?? null}
          reps={getBaseline(field.exercise_key)?.reps ?? 0}
          onLoadChange={(v) => updateBaseline(field.exercise_key, "load_kg", v)}
          onRepsChange={(v) => updateBaseline(field.exercise_key, "reps", v)}
          unitLabel={unitLabel}
          textColor={textColor}
          textSecondary={textSecondary}
          textMuted={textMuted}
          border={border}
          inputFill={inputFill}
        />
      ))}

      {loadFields.length > 0 && bodyweightFields.length > 0 && (
        <View style={[styles.sectionDivider, { backgroundColor: border }]} />
      )}

      {loadFields.length > 0 && (
        <Text
          style={[Typography.label, { color: textMuted }, styles.sectionLabel]}
        >
          WEIGHTED EXERCISES
        </Text>
      )}

      {loadFields.map((field) => (
        <BaselineRow
          key={field.exercise_key}
          label={field.label}
          hasLoad={true}
          loadKg={getBaseline(field.exercise_key)?.load_kg ?? null}
          reps={getBaseline(field.exercise_key)?.reps ?? 0}
          onLoadChange={(v) => updateBaseline(field.exercise_key, "load_kg", v)}
          onRepsChange={(v) => updateBaseline(field.exercise_key, "reps", v)}
          unitLabel={unitLabel}
          textColor={textColor}
          textSecondary={textSecondary}
          textMuted={textMuted}
          border={border}
          inputFill={inputFill}
        />
      ))}
    </View>
  );
}

interface BaselineRowProps {
  label: string;
  hasLoad: boolean;
  loadKg: number | null;
  reps: number;
  onLoadChange: (value: string) => void;
  onRepsChange: (value: string) => void;
  unitLabel: string;
  textColor: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  inputFill: string;
}

function BaselineRow({
  label,
  hasLoad,
  loadKg,
  reps,
  onLoadChange,
  onRepsChange,
  unitLabel,
  textColor,
  textSecondary,
  textMuted,
  border,
  inputFill,
}: BaselineRowProps) {
  return (
    <View style={styles.fieldRow}>
      <Text style={[Typography.body, { color: textColor }, styles.fieldLabel]}>
        {label}
      </Text>
      <View style={styles.inputGroup}>
        {hasLoad && (
          <>
            <NumberInput
              value={loadKg === null ? "" : String(loadKg)}
              onChange={onLoadChange}
              placeholder={unitLabel}
              textColor={textColor}
              textMuted={textMuted}
              inputFill={inputFill}
              border={border}
              style={styles.loadInput}
            />
            <Text style={[Typography.caption, { color: textMuted }]}>×</Text>
          </>
        )}
        <NumberInput
          value={reps === 0 ? "" : String(reps)}
          onChange={onRepsChange}
          placeholder="reps"
          textColor={textColor}
          textMuted={textMuted}
          inputFill={inputFill}
          border={border}
          style={styles.repsInput}
        />
      </View>
    </View>
  );
}

interface NumberInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  textColor: string;
  textMuted: string;
  inputFill: string;
  border: string;
  style?: object;
}

function NumberInput({
  value,
  onChange,
  placeholder,
  textColor,
  textMuted,
  inputFill,
  border,
  style,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      style={[
        styles.numberInput,
        {
          backgroundColor: inputFill,
          color: textColor,
          borderColor: focused ? border : "transparent",
        },
        style,
      ]}
      value={value}
      onChangeText={onChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={textMuted}
      keyboardType="number-pad"
      returnKeyType="done"
      maxLength={5}
      inputAccessoryViewID={
        Platform.OS === "ios" ? NUMERIC_ACCESSORY_ID : undefined
      }
      accessibilityLabel={`${placeholder} input`}
    />
  );
}

const styles = StyleSheet.create({
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  fieldLabel: {
    flex: 1,
  },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadInput: {
    width: 64,
  },
  repsInput: {
    width: 64,
  },
  numberInput: {
    borderRadius: Radii.sm,
    borderWidth: 1.5,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    textAlign: "center",
    ...Typography.bodyMedium,
  },
  sectionDivider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
  },
});
