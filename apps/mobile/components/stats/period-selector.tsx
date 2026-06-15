import { StyleSheet, TouchableOpacity, View, Text } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface Period {
  key: string;
  label: string;
}

interface PeriodSelectorProps {
  selected: string;
  onChange: (period: string) => void;
  periods?: Period[];
}

const DEFAULT_PERIODS: Period[] = [
  { key: "30d", label: "30d" },
  { key: "90d", label: "90d" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

export function PeriodSelector({
  selected,
  onChange,
  periods = DEFAULT_PERIODS,
}: PeriodSelectorProps) {
  const primaryColor = useThemeColor({}, "primary");
  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textSecondary = useThemeColor({}, "textSecondary");

  return (
    <View style={styles.row}>
      {periods.map((period) => {
        const isActive = period.key === selected;
        return (
          <TouchableOpacity
            key={period.key}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            onPress={() => onChange(period.key)}
            style={[
              styles.pill,
              {
                backgroundColor: isActive ? primaryColor : backgroundSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.pillText,
                { color: isActive ? "#FFFFFF" : textSecondary },
              ]}
            >
              {period.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  pill: {
    borderRadius: Radii.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  pillText: {
    ...Typography.label,
  },
});
