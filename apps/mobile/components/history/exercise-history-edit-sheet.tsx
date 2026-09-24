import {
  AppBottomSheet,
  type AppBottomSheetHandle,
} from "@/components/ui/app-bottom-sheet";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  NUMERIC_ACCESSORY_ID,
  NumericKeyboardAccessory,
} from "@/components/numeric-keyboard-accessory";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import type {
  CompletedExerciseSetInput,
  EditableExerciseSet,
} from "@/lib/api/workouts";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

interface ExerciseHistoryEditSheetProps {
  visible: boolean;
  exerciseName: string;
  workoutName: string;
  workoutDate: string;
  exerciseType: "weight" | "time";
  sets: EditableExerciseSet[];
  onClose: () => void;
  onSave: (sets: CompletedExerciseSetInput[]) => void | Promise<void>;
}

interface SetDraft {
  key: string;
  id?: string;
  setType: "warmup" | "working";
  load: string;
  reps: string;
  duration: string;
  rpe: string;
}

function displayNumber(value: number | null): string {
  return value == null ? "" : String(value);
}

function parseDecimal(value: string): number {
  return Number(value.replace(",", "."));
}

function isPositiveInteger(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

function isValidRpe(value: string): boolean {
  return (
    value.trim() === "" || (isPositiveInteger(value) && Number(value) <= 10)
  );
}

export function ExerciseHistoryEditSheet({
  visible,
  exerciseName,
  workoutName,
  workoutDate,
  exerciseType,
  sets,
  onClose,
  onSave,
}: ExerciseHistoryEditSheetProps) {
  const { t } = useTranslation("history");
  const sheetRef = useRef<AppBottomSheetHandle>(null);
  const initialDraftsRef = useRef<SetDraft[]>([]);
  const nextKey = useRef(0);
  const wu = useWeightUnit();
  const [drafts, setDrafts] = useState<SetDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const text = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textDisabled = useThemeColor({}, "textDisabled");
  const inputFill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const error = useThemeColor({}, "error");

  useEffect(() => {
    if (!visible) return;
    const initialDrafts = sets.map((set) => ({
      key: set.id,
      id: set.id,
      setType: set.set_type,
      load: displayNumber(
        set.load_kg == null
          ? null
          : Math.round(wu.convert(set.load_kg) * 10) / 10
      ),
      reps: displayNumber(set.reps),
      duration: displayNumber(set.duration_seconds),
      rpe: displayNumber(set.rpe),
    }));
    initialDraftsRef.current = initialDrafts;
    setDrafts(initialDrafts);
    setIsSaving(false);
  }, [sets, visible, wu]);

  const updateDraft = (key: string, field: keyof SetDraft, value: string) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft
      )
    );
  };

  const handleAdd = () => {
    nextKey.current += 1;
    setDrafts((current) => [
      ...current,
      {
        key: `new-${nextKey.current}`,
        setType: "working",
        load: "",
        reps: "",
        duration: "",
        rpe: "",
      },
    ]);
  };

  const hasUnsavedChanges =
    JSON.stringify(drafts) !== JSON.stringify(initialDraftsRef.current);
  const allDraftsValid =
    drafts.length > 0 &&
    drafts.every((draft) =>
      exerciseType === "time"
        ? isPositiveInteger(draft.duration) && isValidRpe(draft.rpe)
        : parseDecimal(draft.load) > 0 &&
          isPositiveInteger(draft.reps) &&
          isValidRpe(draft.rpe)
    );

  const handleRequestClose = () => {
    if (isSaving) return;

    if (!hasUnsavedChanges) {
      sheetRef.current?.dismiss();
      return;
    }

    Alert.alert(
      t("detail.exerciseEditor.discardTitle"),
      t("detail.exerciseEditor.discardMessage"),
      [
        {
          text: t("detail.exerciseEditor.keepEditing"),
          style: "cancel",
        },
        {
          text: t("detail.exerciseEditor.discardChanges"),
          style: "destructive",
          onPress: () => sheetRef.current?.dismiss(),
        },
      ]
    );
  };

  const handleRemove = (draft: SetDraft, index: number) => {
    const remove = () =>
      setDrafts((current) => current.filter((item) => item.key !== draft.key));

    if (!draft.id) {
      remove();
      return;
    }

    Alert.alert(
      t("detail.exerciseEditor.removeSetTitle"),
      t("detail.exerciseEditor.removeSetMessage", { number: index + 1 }),
      [
        { text: t("detail.exerciseEditor.cancel"), style: "cancel" },
        {
          text: t("detail.exerciseEditor.remove"),
          style: "destructive",
          onPress: remove,
        },
      ]
    );
  };

  const handleSave = async () => {
    if (drafts.length === 0) {
      return;
    }

    const payload: CompletedExerciseSetInput[] = [];
    for (const draft of drafts) {
      const rpe = draft.rpe.trim() === "" ? undefined : parseDecimal(draft.rpe);
      if (
        rpe !== undefined &&
        (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)
      ) {
        return;
      }

      if (exerciseType === "time") {
        const duration = Number(draft.duration);
        if (!Number.isInteger(duration) || duration <= 0) {
          return;
        }
        payload.push({
          id: draft.id,
          set_type: draft.setType,
          actual_duration_seconds: duration,
          rpe,
        });
      } else {
        const load = parseDecimal(draft.load);
        const reps = Number(draft.reps);
        if (
          !Number.isFinite(load) ||
          load <= 0 ||
          !Number.isInteger(reps) ||
          reps <= 0
        ) {
          return;
        }
        payload.push({
          id: draft.id,
          set_type: draft.setType,
          actual_load_kg: wu.toKg(load),
          actual_reps: reps,
          rpe,
        });
      }
    }

    setIsSaving(true);
    try {
      await onSave(payload);
      sheetRef.current?.dismiss();
    } catch {
      return;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppBottomSheet
      ref={sheetRef}
      visible={visible}
      onClose={onClose}
      onRequestClose={handleRequestClose}
      closeAccessibilityLabel={t("detail.exerciseEditor.close")}
      height="88%"
      testID="exercise-history-edit-sheet"
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heading}>
          <Text style={[Typography.titleMd, { color: text }]} numberOfLines={2}>
            {t("detail.exerciseEditor.title", { exerciseName })}
          </Text>
          <Text style={[Typography.label, { color: primary }]}>
            {t("detail.exerciseEditor.workoutContext", {
              workoutName,
              workoutDate,
            })}
          </Text>
          <Text style={[Typography.caption, { color: textSecondary }]}>
            {t("detail.exerciseEditor.subtitle")}
          </Text>
        </View>

        <View style={styles.columnLabels}>
          <Text
            style={[
              styles.setLabel,
              Typography.micro,
              { color: textSecondary },
            ]}
          >
            {t("detail.exerciseEditor.set")}
          </Text>
          {exerciseType === "time" ? (
            <Text
              style={[
                styles.inputLabel,
                Typography.micro,
                { color: textSecondary },
              ]}
            >
              {t("detail.exerciseEditor.seconds")}
            </Text>
          ) : (
            <>
              <Text
                style={[
                  styles.inputLabel,
                  Typography.micro,
                  { color: textSecondary },
                ]}
              >
                {wu.label.toUpperCase()}
              </Text>
              <Text
                style={[
                  styles.inputLabel,
                  Typography.micro,
                  { color: textSecondary },
                ]}
              >
                {t("detail.exerciseEditor.reps")}
              </Text>
            </>
          )}
          <Text
            style={[
              styles.inputLabel,
              Typography.micro,
              { color: textSecondary },
            ]}
          >
            RPE
          </Text>
          <View style={styles.removeButton} />
        </View>

        {drafts.map((draft, index) => {
          const durationInvalid = !isPositiveInteger(draft.duration);
          const loadInvalid = parseDecimal(draft.load) <= 0;
          const repsInvalid = !isPositiveInteger(draft.reps);
          const rpeInvalid = !isValidRpe(draft.rpe);
          const accessoryId =
            Platform.OS === "ios" ? NUMERIC_ACCESSORY_ID : undefined;

          return (
            <View
              key={draft.key}
              style={[styles.setRow, { borderColor: border }]}
            >
              <Text
                style={[
                  styles.setLabel,
                  styles.setNumber,
                  Typography.label,
                  { color: textSecondary },
                ]}
              >
                {index + 1}
              </Text>
              {exerciseType === "time" ? (
                <View style={styles.inputColumn}>
                  <TextInput
                    accessibilityLabel={t(
                      "detail.exerciseEditor.durationForSet",
                      { number: index + 1 }
                    )}
                    editable={!isSaving}
                    inputAccessoryViewID={accessoryId}
                    keyboardType="number-pad"
                    onChangeText={(value) => {
                      if (/^\d*$/.test(value)) {
                        updateDraft(draft.key, "duration", value);
                      }
                    }}
                    placeholder="0"
                    placeholderTextColor={textDisabled}
                    style={[
                      styles.input,
                      {
                        backgroundColor: inputFill,
                        borderColor: durationInvalid ? error : "transparent",
                        color: text,
                      },
                    ]}
                    value={draft.duration}
                  />
                  {durationInvalid ? (
                    <Text
                      style={[
                        Typography.micro,
                        styles.fieldHint,
                        { color: error },
                      ]}
                    >
                      {t("detail.exerciseEditor.positiveHint")}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={styles.inputColumn}>
                    <TextInput
                      accessibilityLabel={t(
                        "detail.exerciseEditor.weightForSet",
                        { number: index + 1, unit: wu.label }
                      )}
                      editable={!isSaving}
                      inputAccessoryViewID={accessoryId}
                      keyboardType="decimal-pad"
                      onChangeText={(value) =>
                        updateDraft(draft.key, "load", value)
                      }
                      placeholder="0"
                      placeholderTextColor={textDisabled}
                      style={[
                        styles.input,
                        {
                          backgroundColor: inputFill,
                          borderColor: loadInvalid ? error : "transparent",
                          color: text,
                        },
                      ]}
                      value={draft.load}
                    />
                    {loadInvalid ? (
                      <Text
                        style={[
                          Typography.micro,
                          styles.fieldHint,
                          { color: error },
                        ]}
                      >
                        {t("detail.exerciseEditor.positiveHint")}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.inputColumn}>
                    <TextInput
                      accessibilityLabel={t(
                        "detail.exerciseEditor.repsForSet",
                        { number: index + 1 }
                      )}
                      editable={!isSaving}
                      inputAccessoryViewID={accessoryId}
                      keyboardType="number-pad"
                      onChangeText={(value) => {
                        if (/^\d*$/.test(value)) {
                          updateDraft(draft.key, "reps", value);
                        }
                      }}
                      placeholder="0"
                      placeholderTextColor={textDisabled}
                      style={[
                        styles.input,
                        {
                          backgroundColor: inputFill,
                          borderColor: repsInvalid ? error : "transparent",
                          color: text,
                        },
                      ]}
                      value={draft.reps}
                    />
                    {repsInvalid ? (
                      <Text
                        style={[
                          Typography.micro,
                          styles.fieldHint,
                          { color: error },
                        ]}
                      >
                        {t("detail.exerciseEditor.positiveHint")}
                      </Text>
                    ) : null}
                  </View>
                </>
              )}
              <View style={styles.inputColumn}>
                <TextInput
                  accessibilityLabel={t("detail.exerciseEditor.rpeForSet", {
                    number: index + 1,
                  })}
                  editable={!isSaving}
                  inputAccessoryViewID={accessoryId}
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    if (/^\d*$/.test(value)) {
                      updateDraft(draft.key, "rpe", value);
                    }
                  }}
                  placeholder="—"
                  placeholderTextColor={textDisabled}
                  style={[
                    styles.input,
                    {
                      backgroundColor: inputFill,
                      borderColor: rpeInvalid ? error : "transparent",
                      color: text,
                    },
                  ]}
                  value={draft.rpe}
                />
                {rpeInvalid ? (
                  <Text
                    style={[
                      Typography.micro,
                      styles.fieldHint,
                      { color: error },
                    ]}
                  >
                    {t("detail.exerciseEditor.rpeHint")}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("detail.exerciseEditor.removeSet", {
                  number: index + 1,
                })}
                disabled={isSaving}
                hitSlop={6}
                onPress={() => handleRemove(draft, index)}
                style={styles.removeButton}
              >
                <IconSymbol name="trash" size={18} color={error} />
              </Pressable>
            </View>
          );
        })}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("detail.exerciseEditor.addSet")}
          disabled={isSaving}
          onPress={handleAdd}
          style={[styles.addButton, { borderColor: primary }]}
        >
          <IconSymbol name="plus" size={18} color={primary} />
          <Text style={[Typography.label, { color: primary }]}>
            {t("detail.exerciseEditor.addSet")}
          </Text>
        </Pressable>

        {drafts.length === 0 ? (
          <Text
            accessibilityRole="alert"
            style={[Typography.caption, { color: error }]}
          >
            {t("detail.exerciseEditor.atLeastOneSet")}
          </Text>
        ) : null}

        <Button
          disabled={!hasUnsavedChanges || !allDraftsValid}
          label={t("detail.exerciseEditor.save")}
          loading={isSaving}
          onPress={handleSave}
        />
      </ScrollView>
      <NumericKeyboardAccessory />
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  heading: { gap: Spacing.xs, marginBottom: Spacing.sm },
  columnLabels: { alignItems: "center", flexDirection: "row", gap: Spacing.sm },
  setRow: {
    alignItems: "flex-start",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  setLabel: { textAlign: "center", width: 28 },
  setNumber: { paddingTop: Spacing.md },
  inputLabel: { flex: 1, textAlign: "center" },
  inputColumn: { flex: 1, gap: 2 },
  fieldHint: { textAlign: "center" },
  input: {
    ...Typography.bodyMedium,
    borderRadius: Radii.sm,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: Spacing.sm,
    textAlign: "center",
  },
  removeButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    width: 36,
  },
  addButton: {
    alignItems: "center",
    borderRadius: Radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: Spacing.sm,
    justifyContent: "center",
    minHeight: 48,
  },
});
