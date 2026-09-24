import { useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";
import { strengthBaselineSchema } from "@/lib/schemas/strength-baseline";
import type { Equipment, StrengthBaseline } from "@/stores/onboarding-store";

const EXERCISES = [
  "pushups",
  "pullups",
  "db_bench",
  "db_row",
  "bb_bench",
  "bb_squat",
  "deadlift",
] as const;
interface Draft {
  load: string;
  reps: string;
}
interface StrengthBaselineFormProps {
  equipment: Equipment | null;
  experience: "beginner" | "intermediate" | "advanced" | null;
  baselines: StrengthBaseline[];
  onChange: (baselines: StrengthBaseline[]) => void;
  onValidityChange?: (valid: boolean) => void;
}
export function StrengthBaselineForm({
  equipment,
  baselines,
  onChange,
  onValidityChange,
}: StrengthBaselineFormProps) {
  const { t } = useTranslation("strengthBaselines");
  const { label: unitLabel, unit, convert, toKg } = useWeightUnit();
  const text = useThemeColor({}, "text");
  const secondary = useThemeColor({}, "textSecondary");
  const errorColor = useThemeColor({}, "error");
  const fill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");
  const lastEmitted = useRef(baselines);
  function fromBaselines(rows: StrengthBaseline[]) {
    return Object.fromEntries(
      rows.map((row) => [
        row.exercise_key,
        {
          load:
            row.load_kg === null
              ? ""
              : String(Math.round(convert(row.load_kg) * 100) / 100),
          reps: String(row.reps),
        },
      ])
    );
  }
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    fromBaselines(baselines)
  );
  const previousUnit = useRef(unit);
  useEffect(() => {
    if (baselines !== lastEmitted.current || unit !== previousUnit.current) {
      setDrafts(fromBaselines(baselines));
      lastEmitted.current = baselines;
      previousUnit.current = unit;
    }
    // Conversion changes only when unit changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baselines, unit]);
  const visible = EXERCISES.filter((key) => {
    if (key === "pushups" || key === "pullups") return true;
    if (equipment === "full_gym") return true;
    return equipment === "dumbbells"
      ? key.startsWith("db_")
      : equipment === "barbell"
        ? key.startsWith("bb_") || key === "deadlift"
        : false;
  });
  function parse(key: (typeof EXERCISES)[number], draft: Draft) {
    const weighted = key !== "pushups" && key !== "pullups";
    if (!draft.load.trim() && !draft.reps.trim()) return null;
    return strengthBaselineSchema.safeParse({
      exercise_key: key,
      load_kg:
        weighted && draft.load.trim()
          ? toKg(Number(draft.load.replace(",", ".")))
          : null,
      reps: draft.reps.trim() ? Number(draft.reps) : NaN,
    });
  }
  const valid = visible.every(
    (key) =>
      parse(key, drafts[key] ?? { load: "", reps: "" })?.success !== false
  );
  useEffect(() => {
    onValidityChange?.(valid);
  }, [valid, onValidityChange]);
  function update(
    key: (typeof EXERCISES)[number],
    field: keyof Draft,
    value: string
  ) {
    const next = {
      ...drafts,
      [key]: { ...(drafts[key] ?? { load: "", reps: "" }), [field]: value },
    };
    setDrafts(next);
    const rows = visible.flatMap((exercise) => {
      const parsed = parse(exercise, next[exercise] ?? { load: "", reps: "" });
      return parsed?.success ? [parsed.data] : [];
    });
    lastEmitted.current = rows;
    onChange(rows);
  }
  return (
    <View>
      <Text style={[Typography.caption, styles.hint, { color: secondary }]}>
        {t("form.guidance")}
      </Text>
      {visible.map((key) => {
        const weighted = key !== "pushups" && key !== "pullups";
        const draft = drafts[key] ?? { load: "", reps: "" };
        const invalid = parse(key, draft)?.success === false;
        return (
          <View key={key} style={[styles.row, { borderColor: border }]}>
            <Text style={[Typography.bodyMedium, { color: text }]}>
              {t(`exercises.${key}`)}
            </Text>
            <View style={styles.inputs}>
              {(weighted
                ? (["load", "reps"] as const)
                : (["reps"] as const)
              ).map((field) => (
                <View style={styles.field} key={field}>
                  <Text style={[Typography.caption, { color: secondary }]}>
                    {field === "load" ? unitLabel : t("form.reps")}
                  </Text>
                  <TextInput
                    value={draft[field]}
                    onChangeText={(value) => update(key, field, value)}
                    style={[
                      styles.input,
                      {
                        color: text,
                        backgroundColor: fill,
                        borderColor: invalid ? errorColor : border,
                      },
                    ]}
                    keyboardType={
                      field === "load" ? "decimal-pad" : "number-pad"
                    }
                    maxLength={field === "load" ? 7 : 3}
                    placeholder="—"
                    placeholderTextColor={secondary}
                    returnKeyType="done"
                    inputAccessoryViewID={
                      Platform.OS === "ios" ? NUMERIC_ACCESSORY_ID : undefined
                    }
                    accessibilityLabel={t(
                      field === "load" ? "form.loadLabel" : "form.repsLabel",
                      { exercise: t(`exercises.${key}`), unit: unitLabel }
                    )}
                  />
                </View>
              ))}
            </View>
            {invalid && (
              <Text
                accessibilityRole="alert"
                style={[Typography.caption, { color: errorColor }]}
              >
                {t(weighted ? "form.pairError" : "form.repsError")}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inputs: { flexDirection: "row", gap: Spacing.lg },
  field: { flex: 1, gap: Spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radii.sm,
    padding: Spacing.md,
    ...Typography.body,
  },
  hint: { marginBottom: Spacing.md },
});
