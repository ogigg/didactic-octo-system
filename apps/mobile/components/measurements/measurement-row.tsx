import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementField, MeasurementUnit } from "@/data/measurements";

interface MeasurementRowProps {
  field: MeasurementField;
  label: string;
  latestValue: number | null;
  unit: MeasurementUnit;
  onAdd: () => void;
}

export function MeasurementRow({
  label,
  latestValue,
  unit,
  onAdd,
}: MeasurementRowProps) {
  const textColor = useThemeColor({}, "text");
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");

  return (
    <View style={styles.row}>
      <Text style={[Typography.body, { color: textColor }, styles.label]}>
        {label}
      </Text>
      <View style={styles.valueContainer}>
        {latestValue !== null ? (
          <Text style={[Typography.bodyMedium, { color: textSecondary }]}>
            {latestValue} {unit}
          </Text>
        ) : (
          <Text style={[Typography.body, { color: textMuted }]}>—</Text>
        )}
      </View>
      <TouchableOpacity
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={`Log ${label}`}
        style={[styles.addButton, { backgroundColor: backgroundSubtle }]}
      >
        <IconSymbol name="plus" size={16} color={primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  label: {
    flex: 1,
  },
  valueContainer: {
    minWidth: 72,
    alignItems: "flex-end",
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: Radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
});
