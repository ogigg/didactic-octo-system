import { StyleSheet, View, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";

interface VolumeWeek {
  week_start: string;
  volume_kg: number;
  total_duration_seconds?: number | null;
}

interface VolumeBarChartProps {
  data: VolumeWeek[];
  chartHeight?: number;
  metric?: "volume" | "duration";
  labels?: {
    total: string;
    average: string;
    perWeek: string;
  };
}

function getMonthLabel(
  dateStr: string,
  prevDateStr: string | undefined
): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "";
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "short",
  }).format(date);
  if (!prevDateStr) return monthLabel;
  const prevDate = new Date(prevDateStr);
  if (
    Number.isNaN(prevDate.getTime()) ||
    date.getMonth() !== prevDate.getMonth()
  ) {
    return monthLabel;
  }
  return "";
}

export function VolumeBarChart({
  data,
  chartHeight = 120,
  metric = "volume",
  labels,
}: VolumeBarChartProps) {
  const { t } = useTranslation("stats");
  const { formatVolume } = useWeightUnit();
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  if (data.length === 0) return null;

  const values = data.map((item) =>
    metric === "duration" ? (item.total_duration_seconds ?? 0) : item.volume_kg
  );
  const maxValue = Math.max(...values, 1);
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const weeklyAvg = data.length > 0 ? totalValue / data.length : 0;
  const formatValue =
    metric === "duration"
      ? (value: number) => formatExerciseDuration(Math.round(value))
      : formatVolume;
  const chartLabels = labels ?? {
    total: t("volume.total"),
    average: t("volume.weeklyAvg"),
    perWeek: t("volume.perWeek"),
  };

  // Determine label interval (~every 4 weeks)
  const labelEvery = Math.max(1, Math.floor(data.length / 10) * 4 || 4);

  return (
    <View>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: textColor }]}>
          {chartLabels.total}
          {": "}
          <Text style={{ color: primaryColor }}>{formatValue(totalValue)}</Text>
        </Text>
        <Text style={[styles.summaryText, { color: textSecondary }]}>
          {chartLabels.average}
          {": "}
          <Text style={{ color: primaryColor }}>{formatValue(weeklyAvg)}</Text>
          {chartLabels.perWeek}
        </Text>
      </View>

      {/* Bars */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {data.map((week, index) => {
          const isCurrentWeek = index === data.length - 1;
          const value = values[index] ?? 0;
          const isEmpty = value === 0;
          const barHeight = isEmpty
            ? 3
            : Math.max(6, (value / maxValue) * chartHeight);

          return (
            <View key={week.week_start} style={styles.barWrapper}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isEmpty ? borderColor : primaryColor,
                    opacity: isEmpty ? 1 : isCurrentWeek ? 1 : 0.6,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/* Labels row */}
      <View style={styles.labelsRow}>
        {data.map((week, index) => {
          const showLabel = index % labelEvery === 0;
          const label = showLabel
            ? getMonthLabel(week.week_start, data[index - 1]?.week_start)
            : "";

          return (
            <View key={week.week_start} style={styles.labelWrapper}>
              {label ? (
                <Text
                  style={[styles.labelText, { color: textMuted }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  summaryText: {
    ...Typography.caption,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  barWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: Radii.sm,
    borderTopRightRadius: Radii.sm,
  },
  labelsRow: {
    flexDirection: "row",
    marginTop: Spacing.xs,
    gap: 2,
  },
  labelWrapper: {
    flex: 1,
    alignItems: "center",
  },
  labelText: {
    ...Typography.micro,
  },
});
