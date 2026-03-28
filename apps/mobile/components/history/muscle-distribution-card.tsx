import {
  DonutChart,
  type DonutSegment,
} from "@/components/history/donut-chart";
import { MuscleLegend } from "@/components/history/muscle-legend";
import { Radii, Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";

export interface MuscleDistributionCardProps {
  segments: DonutSegment[];
  title: string;
  titleColor: string;
  backgroundColor: string;
  borderColor: string;
  /** When false, matches elevated summary cards (no outline). Default true (history detail). */
  showBorder?: boolean;
  size?: number;
  strokeWidth?: number;
}

export function MuscleDistributionCard({
  segments,
  title,
  titleColor,
  backgroundColor,
  borderColor,
  showBorder = true,
  size = 160,
  strokeWidth = 22,
}: MuscleDistributionCardProps) {
  if (segments.length === 0) return null;

  const total = segments.reduce((s, seg) => s + seg.value, 0);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor,
          borderWidth: showBorder ? 1 : 0,
        },
      ]}
    >
      <Text style={[Typography.titleMd, { color: titleColor }]}>{title}</Text>
      <View style={styles.chartContainer}>
        <DonutChart segments={segments} size={size} strokeWidth={strokeWidth} />
      </View>
      <MuscleLegend segments={segments} total={total} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.md,
    padding: Spacing.lg,
  },
  chartContainer: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
});
