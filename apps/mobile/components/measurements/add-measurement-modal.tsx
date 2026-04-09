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
import { NUMERIC_ACCESSORY_ID } from "@/components/numeric-keyboard-accessory";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementField } from "@/data/measurements";
import { getMeasurementUnit } from "@/data/measurements";

interface AddMeasurementModalProps {
  visible: boolean;
  field: MeasurementField | null;
  initialValue: number | null;
  initialDate?: string;
  isEditing?: boolean;
  onSave: (date: string, value: number) => void;
  onClose: () => void;
}

export function AddMeasurementModal({
  visible,
  field,
  initialValue,
  initialDate,
  isEditing = false,
  onSave,
  onClose,
}: AddMeasurementModalProps) {
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");
  const primary = useThemeColor({}, "primary");
  const textSecondary = useThemeColor({}, "textSecondary");

  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayString());

  useEffect(() => {
    if (visible) {
      setValue(initialValue !== null ? String(initialValue) : "");
      setDate(initialDate ?? todayString());
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
        <View style={styles.header}>
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
            {isEditing ? t("modal.editTitle") : t("modal.title")}
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
              { color: primary, marginTop: Spacing.xs },
            ]}
          >
            {label}
          </Text>

          <View style={styles.inputSection}>
            <Text
              style={[
                Typography.caption,
                { color: textMuted, marginBottom: Spacing.sm },
              ]}
            >
              {t("modal.valueLabel")}
            </Text>
            <View style={[styles.valueInputContainer, { borderColor: border }]}>
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
            {initialValue !== null && !isEditing && (
              <Text style={[Typography.caption, { color: textSecondary }]}>
                {t("modal.previous", {
                  value: initialValue,
                  unit,
                })}
              </Text>
            )}
          </View>

          <View style={styles.inputSection}>
            <Text
              style={[
                Typography.caption,
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

        <View style={styles.footer}>
          <Button
            label={isEditing ? t("modal.update") : t("modal.save")}
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
  inputSection: {
    gap: Spacing.sm,
  },
  valueInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  valueInput: {
    flex: 1,
    ...Typography.displayLg,
    padding: 0,
    textAlign: "center",
  },
  dateInput: {
    borderRadius: Radii.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  footer: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xl + (Platform.OS === "ios" ? 20 : 0),
  },
});
