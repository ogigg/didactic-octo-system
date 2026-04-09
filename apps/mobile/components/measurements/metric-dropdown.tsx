import { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementField } from "@/data/measurements";
import { MEASUREMENT_FIELDS } from "@/data/measurements";
import { useTranslation } from "react-i18next";

interface MetricDropdownProps {
  selected: MeasurementField;
  onChange: (field: MeasurementField) => void;
}

export function MetricDropdown({ selected, onChange }: MetricDropdownProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("measurements");
  const background = useThemeColor({}, "backgroundElevated");
  const textColor = useThemeColor({}, "text");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textMuted = useThemeColor({}, "textMuted");

  const selectedLabel = t(`fields.${selected}`);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Select metric, currently ${selectedLabel}`}
        style={[
          styles.trigger,
          { backgroundColor: background, borderColor: border },
        ]}
      >
        <Text style={[Typography.titleSm, { color: primary }]}>
          {selectedLabel}
        </Text>
        <IconSymbol name="chevron.down" size={14} color={primary} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View
            style={[styles.sheet, { backgroundColor: background }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.handle, { backgroundColor: textMuted }]} />
            <FlatList
              data={MEASUREMENT_FIELDS as unknown as MeasurementField[]}
              keyExtractor={(item) => item}
              renderItem={({ item }) => {
                const isSelected = item === selected;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[styles.option, { borderBottomColor: border }]}
                  >
                    <Text
                      style={[
                        Typography.titleSm,
                        { color: isSelected ? primary : textColor },
                      ]}
                    >
                      {t(`fields.${item}`)}
                    </Text>
                    {isSelected && (
                      <IconSymbol name="checkmark" size={18} color={primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
              bounces={false}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radii.md,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: Radii.lg,
    borderTopRightRadius: Radii.lg,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing["4xl"],
    paddingTop: Spacing.md,
    maxHeight: "60%",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: Radii.full,
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
});
