import { useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";

import { IconSymbol } from "@/components/ui/icon-symbol";
import type { ExerciseChartProgress } from "@/lib/exercise-chart-progress";
import { Elevation, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useWeightUnit } from "@/hooks/use-weight-unit";
import { formatExerciseDuration } from "@/lib/format-exercise-duration";

interface ChartAnchor {
  x: number;
  y: number;
  width: number;
}

interface VolumeWeek {
  week_start: string;
  volume_kg: number;
  total_duration_seconds?: number | null;
}

interface VolumeBarChartProps {
  data: VolumeWeek[];
  today?: ExerciseChartProgress;
  chartHeight?: number;
  metric?: "volume" | "duration";
  labels?: {
    total: string;
    average: string;
    perWeek: string;
  };
  getTooltip?: (week: VolumeWeek) => {
    title: string;
    accessibilityLabel: string;
    metrics: { label: string; value: string }[];
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
  today,
  chartHeight = 120,
  metric = "volume",
  labels,
  getTooltip,
}: VolumeBarChartProps) {
  const { t } = useTranslation("stats");
  const { formatVolume } = useWeightUnit();
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const textSecondary = useThemeColor({}, "textSecondary");
  const backgroundElevated = useThemeColor({}, "backgroundElevated");
  const chartRef = useRef<View>(null);
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const [anchor, setAnchor] = useState<ChartAnchor>({
    x: Spacing.lg,
    y: windowHeight / 2,
    width: windowWidth - Spacing.lg * 2,
  });
  const [activeWeek, setActiveWeek] = useState<string | null>(null);
  const selectBar = (key: string) => {
    chartRef.current?.measureInWindow((x, y, width) =>
      setAnchor({ x, y, width })
    );
    setActiveWeek(key);
  };

  if (data.length === 0 && !today) return null;

  const values = data.map((item) =>
    metric === "duration" ? (item.total_duration_seconds ?? 0) : item.volume_kg
  );
  const maxValue = Math.max(...values, today?.forecast ?? 0, 1);
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
  const activeWeekData = data.find((week) => week.week_start === activeWeek);
  const todayMetrics = today
    ? [
        { label: t("volume.completed"), value: formatValue(today.completed) },
        { label: t("volume.forecast"), value: formatValue(today.forecast) },
        {
          label: t("volume.sets"),
          value: `${today.completedSets}/${today.totalSets}`,
        },
      ]
    : [];
  const todayLabel = [
    t("volume.today"),
    ...todayMetrics.map(({ label, value }) => `${label}: ${value}`),
  ].join(", ");
  const activeTooltip =
    activeWeek === "today" && today
      ? { title: t("volume.today"), metrics: todayMetrics }
      : activeWeekData
        ? getTooltip?.(activeWeekData)
        : null;

  // Keep the close button reachable when the chart is partly above the viewport.
  const tooltipBottom = Math.max(
    Spacing.lg,
    Math.min(
      windowHeight - anchor.y + Spacing.sm,
      windowHeight - Spacing["5xl"] - 88
    )
  );

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

      {activeTooltip ? (
        <Modal
          transparent
          visible
          animationType="none"
          statusBarTranslucent
          onRequestClose={() => setActiveWeek(null)}
        >
          <View style={styles.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessible={false}
              onPress={() => setActiveWeek(null)}
            />
            <ScrollView
              accessibilityViewIsModal
              onAccessibilityEscape={() => setActiveWeek(null)}
              style={[
                styles.tooltipPosition,
                {
                  left: anchor.x,
                  width: anchor.width,
                  bottom: tooltipBottom,
                  maxHeight: windowHeight - tooltipBottom - Spacing["5xl"],
                },
              ]}
            >
              <View
                style={[
                  styles.tooltip,
                  {
                    backgroundColor: backgroundElevated,
                    borderColor,
                  },
                ]}
              >
                <View style={styles.tooltipHeader}>
                  <Text
                    style={[
                      Typography.titleSm,
                      styles.tooltipTitle,
                      { color: textColor },
                    ]}
                  >
                    {activeTooltip.title}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("volume.closeTooltip")}
                    onPress={() => setActiveWeek(null)}
                    style={styles.closeButton}
                  >
                    <IconSymbol name="xmark" size={20} color={textColor} />
                  </Pressable>
                </View>
                <View style={styles.tooltipMetrics}>
                  {activeTooltip.metrics.map((metric) => (
                    <View key={metric.label} style={styles.tooltipMetric}>
                      <Text style={[Typography.micro, { color: textMuted }]}>
                        {metric.label}
                      </Text>
                      <Text
                        style={[
                          Typography.bodyMedium,
                          styles.tooltipValue,
                          { color: textColor },
                        ]}
                      >
                        {metric.value}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      ) : null}

      {/* Bars */}
      <View
        ref={chartRef}
        collapsable={false}
        style={[styles.chartArea, { height: chartHeight }]}
      >
        {data.map((week, index) => {
          const isCurrentWeek = index === data.length - 1;
          const isActive = activeWeek === week.week_start;
          const value = values[index] ?? 0;
          const isEmpty = value === 0;
          const barHeight = isEmpty
            ? 3
            : Math.max(6, (value / maxValue) * chartHeight);

          return (
            <Pressable
              key={week.week_start}
              accessibilityRole={getTooltip ? "button" : undefined}
              accessibilityLabel={getTooltip?.(week).accessibilityLabel}
              onHoverIn={() => selectBar(week.week_start)}
              onPress={() => selectBar(week.week_start)}
              disabled={!getTooltip}
              style={styles.barWrapper}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: isEmpty ? borderColor : primaryColor,
                    opacity: activeWeek
                      ? isActive
                        ? 1
                        : 0.35
                      : isEmpty || isCurrentWeek
                        ? 1
                        : 0.6,
                  },
                ]}
              />
            </Pressable>
          );
        })}
        {today ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={todayLabel}
            onHoverIn={() => selectBar("today")}
            onPress={() => selectBar("today")}
            style={styles.barWrapper}
          >
            {today.forecast > today.completed ? (
              <View
                testID="today-forecast"
                style={[
                  styles.bar,
                  styles.forecastBar,
                  {
                    height:
                      ((today.forecast - today.completed) / maxValue) *
                      chartHeight,
                    borderColor: primaryColor,
                  },
                ]}
              />
            ) : null}
            <View
              testID="today-completed"
              style={[
                styles.bar,
                today.forecast > today.completed ? styles.stackedBar : null,
                {
                  height: (today.completed / maxValue) * chartHeight,
                  backgroundColor: primaryColor,
                },
              ]}
            />
          </Pressable>
        ) : null}
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
        {today ? (
          <View style={styles.labelWrapper}>
            <Text
              numberOfLines={1}
              style={[
                styles.labelText,
                styles.todayLabel,
                { color: textMuted },
              ]}
            >
              {t("volume.today")}
            </Text>
          </View>
        ) : null}
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
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: Radii.sm,
    borderTopRightRadius: Radii.sm,
  },
  overlay: { flex: 1 },
  tooltipPosition: { position: "absolute" },
  tooltip: {
    ...Elevation.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  tooltipHeader: { flexDirection: "row", alignItems: "center" },
  tooltipTitle: { flex: 1 },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  todayLabel: { width: 64, alignSelf: "flex-end", textAlign: "right" },
  stackedBar: { borderTopLeftRadius: 0, borderTopRightRadius: 0 },
  forecastBar: {
    borderWidth: 1,
    opacity: 0.45,
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  tooltipMetrics: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  tooltipMetric: {
    width: "50%",
    paddingTop: Spacing.sm,
  },
  tooltipValue: {
    fontVariant: ["tabular-nums"],
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
