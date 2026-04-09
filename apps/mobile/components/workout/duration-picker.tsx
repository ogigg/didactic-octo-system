import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useCallback, useState, useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { IconSymbol } from "@/components/ui/icon-symbol";

interface DurationPickerProps {
  visible: boolean;
  currentSeconds: number | null;
  onSelect: (seconds: number) => void;
  onClose: () => void;
}

export function DurationPicker({
  visible,
  currentSeconds,
  onSelect,
  onClose,
}: DurationPickerProps) {
  const { t } = useTranslation("workout");
  const background = useThemeColor({}, "backgroundElevated");
  const primary = useThemeColor({}, "primary");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textDisabled = useThemeColor({}, "textDisabled");
  const borderSubtle = useThemeColor({}, "borderSubtle");
  const inputFill = useThemeColor({}, "inputFill");

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(30);

  // Sync with currentSeconds when modal opens
  useEffect(() => {
    if (visible) {
      const total = currentSeconds ?? 30;
      setHours(Math.floor(total / 3600));
      setMinutes(Math.floor((total % 3600) / 60));
      setSeconds(total % 60);
    }
  }, [visible, currentSeconds]);

  const handleConfirm = useCallback(() => {
    const total = hours * 3600 + minutes * 60 + seconds;
    onSelect(total > 0 ? total : 0);
    onClose();
  }, [hours, minutes, seconds, onSelect, onClose]);

  function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.container, { backgroundColor: background }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {t("durationPicker.title")}
          </Text>

          <View style={styles.columnsRow}>
            {/* Hours */}
            <View style={styles.column}>
              <Pressable
                onPress={() => setHours((h) => clamp(h + 1, 0, 23))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Increase hours"
                hitSlop={8}
              >
                <IconSymbol name="chevron.up" size={16} color={primary} />
              </Pressable>
              <View style={[styles.valueBox, { backgroundColor: inputFill }]}>
                <Text
                  style={[
                    styles.valueText,
                    { color: hours > 0 ? textColor : textDisabled },
                  ]}
                >
                  {String(hours).padStart(2, "0")}
                </Text>
              </View>
              <Pressable
                onPress={() => setHours((h) => clamp(h - 1, 0, 23))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Decrease hours"
                hitSlop={8}
              >
                <IconSymbol name="chevron.down" size={16} color={primary} />
              </Pressable>
              <Text
                style={[
                  Typography.micro,
                  styles.unitLabel,
                  { color: textMuted },
                ]}
              >
                {t("durationPicker.hours")}
              </Text>
            </View>

            <Text style={[styles.separator, { color: textMuted }]}>:</Text>

            {/* Minutes */}
            <View style={styles.column}>
              <Pressable
                onPress={() => setMinutes((m) => clamp(m + 1, 0, 59))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Increase minutes"
                hitSlop={8}
              >
                <IconSymbol name="chevron.up" size={16} color={primary} />
              </Pressable>
              <View style={[styles.valueBox, { backgroundColor: inputFill }]}>
                <Text
                  style={[
                    styles.valueText,
                    {
                      color:
                        minutes > 0 || hours > 0 ? textColor : textDisabled,
                    },
                  ]}
                >
                  {String(minutes).padStart(2, "0")}
                </Text>
              </View>
              <Pressable
                onPress={() => setMinutes((m) => clamp(m - 1, 0, 59))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Decrease minutes"
                hitSlop={8}
              >
                <IconSymbol name="chevron.down" size={16} color={primary} />
              </Pressable>
              <Text
                style={[
                  Typography.micro,
                  styles.unitLabel,
                  { color: textMuted },
                ]}
              >
                {t("durationPicker.minutes")}
              </Text>
            </View>

            <Text style={[styles.separator, { color: textMuted }]}>:</Text>

            {/* Seconds */}
            <View style={styles.column}>
              <Pressable
                onPress={() => setSeconds((s) => clamp(s + 1, 0, 59))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Increase seconds"
                hitSlop={8}
              >
                <IconSymbol name="chevron.up" size={16} color={primary} />
              </Pressable>
              <View style={[styles.valueBox, { backgroundColor: inputFill }]}>
                <Text style={[styles.valueText, { color: textColor }]}>
                  {String(seconds).padStart(2, "0")}
                </Text>
              </View>
              <Pressable
                onPress={() => setSeconds((s) => clamp(s - 1, 0, 59))}
                style={[styles.stepBtn, { backgroundColor: inputFill }]}
                accessibilityLabel="Decrease seconds"
                hitSlop={8}
              >
                <IconSymbol name="chevron.down" size={16} color={primary} />
              </Pressable>
              <Text
                style={[
                  Typography.micro,
                  styles.unitLabel,
                  { color: textMuted },
                ]}
              >
                {t("durationPicker.seconds")}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={handleConfirm}
            style={[styles.confirmBtn, { backgroundColor: primary }]}
            accessibilityRole="button"
            accessibilityLabel={t("durationPicker.confirm")}
          >
            <Text style={[Typography.bodyMedium, styles.confirmText]}>
              {t("durationPicker.confirm")}
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    borderRadius: Radii.lg,
    padding: Spacing.xl,
    marginHorizontal: Spacing["3xl"],
    gap: Spacing.lg,
    alignItems: "center",
  },
  columnsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  column: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  stepBtn: {
    width: 40,
    height: 32,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  valueBox: {
    width: 56,
    height: 44,
    borderRadius: Radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: {
    fontSize: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  unitLabel: {
    marginTop: 2,
  },
  separator: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: Spacing["2xl"],
    marginHorizontal: 2,
  },
  confirmBtn: {
    width: "100%",
    paddingVertical: 13,
    borderRadius: Radii.lg,
    alignItems: "center",
  },
  confirmText: {
    color: "#FFFFFF",
  },
});
