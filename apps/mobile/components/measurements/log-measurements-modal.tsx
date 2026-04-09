import { useCallback, useEffect, useState } from "react";

function useForceUpdate() {
  const [, setTick] = useState(0);
  return useCallback(() => setTick((t) => t + 1), []);
}
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { DatePickerInput } from "@/components/measurements/date-picker-input";
import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";
import { Button } from "@/components/ui/button";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { MEASUREMENT_GROUPS, getMeasurementUnit } from "@/data/measurements";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { LatestMeasurements } from "@/lib/api/body-measurements";

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseMeasurementValue(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const normalized = val.trim().replace(",", ".");
  const parsed = parseFloat(normalized);
  if (isNaN(parsed)) return null;
  return parsed;
}

const measurementFields = MEASUREMENT_GROUPS.flatMap((g) => g.fields);

type FormData = {
  date: string;
  measurements: Record<string, string>;
};

interface LogMeasurementsModalProps {
  visible: boolean;
  latestData: LatestMeasurements | undefined;
  onSave: (date: string, fields: Record<string, number>) => void;
  onClose: () => void;
}

export function LogMeasurementsModal({
  visible,
  latestData,
  onSave,
  onClose,
}: LogMeasurementsModalProps) {
  const forceUpdate = useForceUpdate();
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const inputFill = useThemeColor({}, "inputFill");
  const _inputFillFocused = useThemeColor({}, "inputFillFocused");
  const border = useThemeColor({}, "border");
  const _primary = useThemeColor({}, "primary");

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      date: "",
      measurements: {},
    },
  });

  const measurementValues = watch("measurements");

  useEffect(() => {
    if (visible) {
      forceUpdate();
      reset({
        date: todayString(),
        measurements: {},
      });
    }
  }, [visible, reset, forceUpdate]);

  const filledCount = (
    measurementValues ? Object.values(measurementValues) : []
  ).filter(
    (v) => typeof v === "string" && v.length > 0 && !isNaN(parseFloat(v))
  ).length;

  function handleFormSubmit(data: FormData) {
    const fields: Record<string, number> = {};
    for (const field of measurementFields) {
      const val = data.measurements[field];
      const num = parseMeasurementValue(val ?? "");
      if (num !== null) {
        fields[field] = num;
      }
    }
    if (Object.keys(fields).length === 0) return;
    onSave(data.date, fields);
    Keyboard.dismiss();
  }

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      {visible ? (
        <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
          <View style={[styles.header, { borderBottomColor: border }]}>
            <TouchableOpacity
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel={t("modal.close")}
              hitSlop={8}
              style={styles.headerButton}
            >
              <IconSymbol name="xmark" size={20} color={textColor} />
            </TouchableOpacity>
            <Text style={[Typography.titleMd, { color: textColor }]}>
              {t("modal.title")}
            </Text>
            <View style={styles.headerButton} />
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Controller
              control={control}
              name="date"
              render={({ field: { value, onChange } }) => (
                <DatePickerInput
                  label={t("modal.dateLabel")}
                  value={value}
                  onChange={onChange}
                />
              )}
            />

            {MEASUREMENT_GROUPS.map((group) => (
              <View key={group.key} style={styles.groupSection}>
                <Text style={[Typography.label, { color: textMuted }]}>
                  {t(`groups.${group.key}`)}
                </Text>
                <View
                  style={[
                    styles.fieldsContainer,
                    { backgroundColor: backgroundSubtle, borderColor: border },
                  ]}
                >
                  {group.fields.map((field, i) => {
                    const unit = getMeasurementUnit(field);
                    const latest = latestData?.[field];

                    return (
                      <View
                        key={field}
                        style={[
                          styles.fieldRow,
                          i < group.fields.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: border,
                          },
                        ]}
                      >
                        <View style={styles.fieldLabel}>
                          <Text
                            style={[Typography.body, { color: textColor }]}
                            numberOfLines={1}
                          >
                            {t(`fields.${field}`)}
                          </Text>
                          {latest !== null && latest !== undefined && (
                            <Text
                              style={[
                                Typography.caption,
                                { color: textSecondary },
                              ]}
                            >
                              {latest} {unit}
                            </Text>
                          )}
                        </View>
                        <Controller
                          control={control}
                          name={`measurements.${field}` as const}
                          render={({ field: { value, onChange, onBlur } }) => (
                            <View style={styles.fieldInput}>
                              <TextInput
                                value={value ?? ""}
                                onChangeText={onChange}
                                onBlur={onBlur}
                                keyboardType="decimal-pad"
                                placeholder="—"
                                placeholderTextColor={textMuted}
                                style={[
                                  styles.valueInput,
                                  {
                                    color: textColor,
                                    backgroundColor: inputFill,
                                  },
                                ]}
                                inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
                              />
                              <Text
                                style={[
                                  Typography.caption,
                                  styles.unitLabel,
                                  { color: textMuted },
                                ]}
                              >
                                {unit}
                              </Text>
                            </View>
                          )}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            <View style={styles.bottomPadding} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: border }]}>
            <Button
              label={
                filledCount > 0
                  ? t("modal.saveCount", { count: filledCount })
                  : t("modal.save")
              }
              onPress={handleSubmit(handleFormSubmit)}
              disabled={filledCount === 0}
            />
          </View>
        </SafeAreaView>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: Spacing.xl,
    gap: Spacing.xl,
  },
  groupSection: {
    gap: Spacing.sm,
  },
  fieldsContainer: {
    borderRadius: Radii.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  fieldLabel: {
    flex: 1,
    gap: 2,
  },
  fieldInput: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  valueInput: {
    width: 80,
    borderRadius: Radii.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    textAlign: "center",
    ...Typography.bodyMedium,
    fontVariant: ["tabular-nums"],
    borderWidth: 1,
    borderColor: "transparent",
  },
  unitLabel: {
    width: 20,
  },
  bottomPadding: {
    height: 40,
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl + (Platform.OS === "ios" ? 20 : 0),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
