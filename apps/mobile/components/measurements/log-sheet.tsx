import { useEffect, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementField } from "@/data/measurements";
import { getMeasurementUnit } from "@/data/measurements";
import { useTranslation } from "react-i18next";

interface LogSheetProps {
  visible: boolean;
  field: MeasurementField | null;
  initialValue: number | null;
  onSave: (date: string, value: number) => void;
  onClose: () => void;
}

export function LogSheet({
  visible,
  field,
  initialValue,
  onSave,
  onClose,
}: LogSheetProps) {
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const inputFill = useThemeColor({}, "inputFill");
  const border = useThemeColor({}, "border");

  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayString());

  useEffect(() => {
    if (visible) {
      setValue(initialValue !== null ? String(initialValue) : "");
      setDate(todayString());
    }
  }, [visible, initialValue]);

  if (!field) return null;

  const unit = getMeasurementUnit(field);
  const label = t(`fields.${field}`);

  function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    onSave(date, num);
    Keyboard.dismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[styles.sheet, { backgroundColor: background }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={[styles.handle, { backgroundColor: textMuted }]} />
          <Text
            style={[Typography.titleMd, { color: textColor }, styles.title]}
          >
            {label}
          </Text>

          <View style={styles.form}>
            {/* Date */}
            <Text style={[Typography.caption, { color: textMuted }]}>
              {t("sheet.date")}
            </Text>
            <TextInput
              value={date}
              onChangeText={setDate}
              style={[
                styles.input,
                {
                  backgroundColor: inputFill,
                  borderColor: border,
                  color: textColor,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={textMuted}
            />

            {/* Value */}
            <Text
              style={[
                Typography.caption,
                { color: textMuted, marginTop: Spacing.md },
              ]}
            >
              {t("sheet.value")} ({unit})
            </Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
              style={[
                styles.input,
                {
                  backgroundColor: inputFill,
                  borderColor: border,
                  color: textColor,
                },
              ]}
              placeholder={t("sheet.placeholder")}
              placeholderTextColor={textMuted}
              autoFocus
            />
          </View>

          <Button
            label={t("sheet.save")}
            onPress={handleSave}
            accessibilityLabel={t("sheet.save")}
            style={styles.saveButton}
            disabled={!value || isNaN(parseFloat(value))}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.xs,
  },
  input: {
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    ...Typography.body,
  },
  saveButton: {
    marginTop: Spacing.xl,
  },
});
