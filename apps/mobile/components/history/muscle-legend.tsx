import { useThemeColor } from "@/hooks/use-theme-color";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import type { DonutSegment } from "./donut-chart";

interface MuscleLegendProps {
  segments: DonutSegment[];
  total: number;
}

export function MuscleLegend({ segments, total }: MuscleLegendProps) {
  const textSecondary = useThemeColor({}, "textSecondary");
  const textMuted = useThemeColor({}, "textMuted");

  return (
    <View style={styles.container}>
      {segments.map((seg, idx) => {
        const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
        return (
          <View key={idx} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: seg.color }]} />
            <Text
              style={[Typography.caption, { color: textSecondary, flex: 1 }]}
              numberOfLines={1}
            >
              {capitalize(seg.label)}
            </Text>
            <Text
              style={[
                Typography.caption,
                { color: textMuted, fontVariant: ["tabular-nums"] },
              ]}
            >
              {pct}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, " ");
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
