import { useEffect, useRef, useState } from "react";
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
import { useTranslation } from "react-i18next";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Button } from "@/components/ui/button";
import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { MEASUREMENT_GROUPS, getMeasurementUnit } from "@/data/measurements";
import type { MeasurementField } from "@/data/measurements";
import type { LatestMeasurements } from "@/lib/api/body-measurements";

interface AddMeasurementModalProps {
  visible: boolean;
  latestData: LatestMeasurements | undefined;
  onSave: (date: string, fields: Record<string, number>) => void;
  onClose: () => void;
}

export function AddMeasurementModal({
  visible,
  latestData,
  onSave,
  onClose,
}: AddMeasurementModalProps) {
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const inputFill = useThemeColor({}, "inputFill");
  const inputFillFocused = useThemeColor({}, "inputFillFocused");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");

  const [date, setDate] = useState(todayString());
  const [values, setValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDate(todayString());
      setValues({});
      setFocusedField(null);
    }
  }, [visible]);

  const filledCount = Object.values(values).filter(
    (v) => v.length > 0 && !isNaN(parseFloat(v))
  ).length;

  function handleSave() {
    const fields: Record<string, number> = {};
    for (const [key, val] of Object.entries(values)) {
      const num = parseFloat(val);
      if (!isNaN(num)) {
        fields[key] = num;
      }
    }
    if (Object.keys(fields).length === 0) return;
    onSave(date, fields);
    Keyboard.dismiss();
  }

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  function updateValue(field: string, val: string) {
    setValues((prev) => ({ ...prev, [field]: val }));
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
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
          <View style={styles.dateSection}>
            <Text style={[Typography.label, { color: textMuted }]}>
              {t("modal.dateLabel")}
            </Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={[
                styles.dateInput,
                {
                  color: textColor,
                  backgroundColor: inputFill,
                  borderColor: border,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={textMuted}
            />
          </View>

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
                  const isFocused = focusedField === field;
                  const hasValue =
                    values[field] !== undefined && values[field].length > 0;

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
                      <View style={styles.fieldInput}>
                        <TextInput
                          value={values[field] ?? ""}
                          onChangeText={(v) => updateValue(field, v)}
                          onFocus={() => setFocusedField(field)}
                          onBlur={() => setFocusedField(null)}
                          keyboardType="decimal-pad"
                          placeholder="—"
                          placeholderTextColor={textMuted}
                          style={[
                            styles.valueInput,
                            {
                              color: textColor,
                              backgroundColor: isFocused
                                ? inputFillFocused
                                : inputFill,
                            },
                            isFocused && {
                              borderColor: primary,
                              borderWidth: 1.5,
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
            onPress={handleSave}
            disabled={filledCount === 0}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

/** Single-field edit modal for editing an existing history entry */
interface EditMeasurementModalProps {
  visible: boolean;
  field: MeasurementField | null;
  initialValue: number;
  initialDate: string;
  onSave: (date: string, value: number) => void;
  onClose: () => void;
}

export function EditMeasurementModal({
  visible,
  field,
  initialValue,
  initialDate,
  onSave,
  onClose,
}: EditMeasurementModalProps) {
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");

  const [value, setValue] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    if (visible) {
      setValue(String(initialValue));
      setDate(initialDate);
    }
  }, [visible, initialValue, initialDate]);

  if (!field) return null;

  const unit = getMeasurementUnit(field);
  const label = t(`fields.${field}`);
  const isValid = value.length > 0 && !isNaN(parseFloat(value));

  function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onSave(date, num);
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
      <SafeAreaView style={[styles.root, { backgroundColor: background }]}>
        <View style={[styles.header, { borderBottomColor: border }]}>
          <TouchableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={styles.headerButton}
          >
            <IconSymbol name="xmark" size={20} color={textColor} />
          </TouchableOpacity>
          <Text style={[Typography.titleMd, { color: textColor }]}>
            {t("modal.editTitle")}
          </Text>
          <View style={styles.headerButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={[Typography.caption, { color: textMuted }]}>
            {t("modal.fieldLabel")}
          </Text>
          <Text
            style={[
              Typography.titleLg,
              { color: textColor, marginTop: Spacing.xs },
            ]}
          >
            {label}
          </Text>

          <View style={styles.editInputSection}>
            <Text
              style={[
                Typography.label,
                { color: textMuted, marginBottom: Spacing.sm },
              ]}
            >
              {t("modal.valueLabel")}
            </Text>
            <View style={styles.editValueRow}>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={t("modal.placeholder")}
                placeholderTextColor={textMuted}
                style={[
                  styles.editValueInput,
                  { color: textColor, backgroundColor: inputFill },
                ]}
                inputAccessoryViewID={NUMERIC_ACCESSORY_ID}
                autoFocus
              />
              <Text style={[Typography.titleMd, { color: textMuted }]}>
                {unit}
              </Text>
            </View>
          </View>

          <View style={styles.editInputSection}>
            <Text
              style={[
                Typography.label,
                { color: textMuted, marginBottom: Spacing.sm },
              ]}
            >
              {t("modal.dateLabel")}
            </Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={[
                styles.dateInput,
                {
                  color: textColor,
                  backgroundColor: inputFill,
                  borderColor: border,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={textMuted}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: border }]}>
          <Button
            label={t("modal.update")}
            onPress={handleSave}
            disabled={!isValid}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  dateSection: {
    gap: Spacing.sm,
  },
  dateInput: {
    borderRadius: Radii.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
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
  editInputSection: {
    gap: Spacing.sm,
  },
  editValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  editValueInput: {
    flex: 1,
    ...Typography.displayLg,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    textAlign: "center",
  },
});
