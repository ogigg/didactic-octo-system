import { StyleSheet, View, Text } from "react-native";

import { Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface VolumeWeek {
  week_start: string;
  volume_kg: number;
}

interface VolumeBarChartProps {
  data: VolumeWeek[];
  chartHeight?: number;
}

const MONTH_ABBREVS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatVolume(kg: number): string {
  if (kg >= 1000) {
    const t = Math.round((kg / 1000) * 10) / 10;
    return `${t}t`;
  }
  return `${Math.round(kg)}kg`;
}

function getMonthLabel(
  dateStr: string,
  prevDateStr: string | undefined
): string {
  const date = new Date(dateStr);
  if (!prevDateStr) return MONTH_ABBREVS[date.getMonth()];
  const prevDate = new Date(prevDateStr);
  if (date.getMonth() !== prevDate.getMonth()) {
    return MONTH_ABBREVS[date.getMonth()];
  }
  return "";
}

export function VolumeBarChart({
  data,
  chartHeight = 120,
}: VolumeBarChartProps) {
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");

  if (data.length === 0) return null;

  const maxVolume = Math.max(...data.map((d) => d.volume_kg), 1);
  const totalVolume = data.reduce((sum, d) => sum + d.volume_kg, 0);
  const weeklyAvg = data.length > 0 ? totalVolume / data.length : 0;

  // Determine label interval (~every 4 weeks)
  const labelEvery = Math.max(1, Math.floor(data.length / 10) * 4 || 4);

  return (
    <View>
      {/* Summary row */}
      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: textColor }]}>
          {"Total: "}
          <Text style={{ color: primaryColor }}>
            {formatVolume(totalVolume)}
          </Text>
        </Text>
        <Text style={[styles.summaryText, { color: textSecondary }]}>
          {"Avg: "}
          <Text style={{ color: primaryColor }}>{formatVolume(weeklyAvg)}</Text>
          {"/wk"}
        </Text>
      </View>

      {/* Bars */}
      <View style={[styles.chartArea, { height: chartHeight }]}>
        {data.map((week, index) => {
          const isCurrentWeek = index === data.length - 1;
          const barHeight = Math.max(
            2,
            (week.volume_kg / maxVolume) * chartHeight
          );
          const isEmpty = week.volume_kg === 0;

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
