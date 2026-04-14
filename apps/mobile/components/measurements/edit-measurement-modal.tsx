import { useEffect, useState } from "react";
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
import { DatePickerInput } from "@/components/measurements/date-picker-input";
import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { getMeasurementUnit } from "@/data/measurements";
import type { MeasurementField } from "@/data/measurements";

function parseMeasurementValue(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const parsed = parseFloat(val);
  if (isNaN(parsed)) return null;
  return Math.round(parsed * 1000) / 1000;
}

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
  const { unit: weightUnit } = useWeightUnit();
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

  const unit = getMeasurementUnit(field, weightUnit);
  const label = t(`fields.${field}`);
  const parsedValue = parseMeasurementValue(value);
  const isValid = parsedValue !== null;

  function handleSave() {
    const num = parseMeasurementValue(value);
    if (num === null) return;
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

          <View style={styles.inputSection}>
            <Text
              style={[
                Typography.label,
                { color: textMuted, marginBottom: Spacing.sm },
              ]}
            >
              {t("modal.valueLabel")}
            </Text>
            <View style={styles.valueRow}>
              <TextInput
                value={value}
                onChangeText={setValue}
                keyboardType="decimal-pad"
                placeholder={t("modal.placeholder")}
                placeholderTextColor={textMuted}
                style={[
                  styles.valueInput,
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

          <View style={styles.inputSection}>
            <DatePickerInput
              label={t("modal.dateLabel")}
              value={date}
              onChange={setDate}
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
  inputSection: {
    gap: Spacing.sm,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  valueInput: {
    flex: 1,
    ...Typography.displayLg,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    textAlign: "center",
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl + (Platform.OS === "ios" ? 20 : 0),
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
