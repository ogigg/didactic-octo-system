import { useCallback, useId, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { ChartCrosshair } from "@/components/charts/chart-crosshair";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { useChartScrub } from "@/hooks/use-chart-scrub";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  buildSmoothAreaPath,
  buildSmoothLinePath,
  type ChartPoint,
} from "@/lib/chart-geometry";
import type { HeartRateSample } from "@/lib/health";

interface HeartRateChartProps {
  samples: HeartRateSample[];
  /** Used to anchor the x-axis time range so short sessions render correctly. */
  startedAt: Date;
  endedAt: Date;
  title: string;
  /** Stat labels — passed in by caller so namespacing stays with the screen. */
  minLabel: string;
  avgLabel: string;
  maxLabel: string;
  unitLabel: string;
  height?: number;
}

const PADDING = { top: 16, right: 12, bottom: 24, left: 36 };
const TARGET_POINTS = 60;
const Y_TICKS = 4;
const X_LABEL_COUNT = 4;

interface PlotPoint extends ChartPoint {
  bpm: number;
  tMs: number;
}

/**
 * Downsample a series of HR samples to at most `target` points by time
 * bucketing (averaging BPM within each bucket). Keeps the curve smooth
 * without rendering hundreds of SVG nodes for long sessions.
 */
function downsample(
  samples: HeartRateSample[],
  startMs: number,
  endMs: number,
  target: number
): { tMs: number; bpm: number }[] {
  if (samples.length === 0) return [];
  if (samples.length <= target) {
    return samples.map((s) => ({ tMs: s.timestamp.getTime(), bpm: s.bpm }));
  }
  const span = Math.max(endMs - startMs, 1);
  const bucketSize = span / target;
  const buckets: { sum: number; count: number; tMs: number }[] = [];
  for (let i = 0; i < target; i++) {
    buckets.push({ sum: 0, count: 0, tMs: startMs + bucketSize * (i + 0.5) });
  }
  for (const s of samples) {
    const t = s.timestamp.getTime();
    if (t < startMs || t > endMs) continue;
    const idx = Math.min(
      target - 1,
      Math.max(0, Math.floor((t - startMs) / bucketSize))
    );
    buckets[idx].sum += s.bpm;
    buckets[idx].count += 1;
  }
  return buckets
    .filter((b) => b.count > 0)
    .map((b) => ({ tMs: b.tMs, bpm: b.sum / b.count }));
}

function formatClock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  return `${h}:${m}`;
}

export function HeartRateChart({
  samples,
  startedAt,
  endedAt,
  title,
  minLabel,
  avgLabel,
  maxLabel,
  unitLabel,
  height = 180,
}: HeartRateChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - Spacing.xl * 2 - Spacing.lg * 2;

  const backgroundSubtle = useThemeColor({}, "backgroundSubtle");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const border = useThemeColor({}, "border");
  const error = useThemeColor({}, "error");
  const warning = useThemeColor({}, "warning");
  const gradientId = useId().replace(/:/g, "");
  const areaGradientId = `hr-area-${gradientId}`;
  const lineGradientId = `hr-line-${gradientId}`;

  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + plotHeight;

  const { points, stats, yMin, yMax, xLabels } = useMemo(() => {
    const startMs = startedAt.getTime();
    const endMs = endedAt.getTime();
    const series = downsample(samples, startMs, endMs, TARGET_POINTS);

    if (series.length === 0) {
      return {
        points: [] as PlotPoint[],
        stats: null,
        yMin: 0,
        yMax: 100,
        xLabels: [] as { x: number; label: string }[],
      };
    }

    // Use raw samples for accurate stats, not the downsampled series.
    const allBpms = samples.map((s) => s.bpm);
    const minBpm = Math.min(...allBpms);
    const maxBpm = Math.max(...allBpms);
    const avgBpm = Math.round(
      allBpms.reduce((sum, v) => sum + v, 0) / allBpms.length
    );

    const yPad = Math.max((maxBpm - minBpm) * 0.15, 5);
    const yMin = Math.max(0, Math.floor((minBpm - yPad) / 5) * 5);
    const yMax = Math.ceil((maxBpm + yPad) / 5) * 5;
    const span = Math.max(endMs - startMs, 1);

    const points: PlotPoint[] = series.map((p) => {
      const x = PADDING.left + ((p.tMs - startMs) / span) * plotWidth;
      const y =
        PADDING.top +
        plotHeight -
        ((p.bpm - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;
      return { x, y, bpm: p.bpm, tMs: p.tMs };
    });

    const xLabels: { x: number; label: string }[] = [];
    for (let i = 0; i < X_LABEL_COUNT; i++) {
      const ratio = i / (X_LABEL_COUNT - 1);
      const tMs = startMs + span * ratio;
      xLabels.push({
        x: PADDING.left + ratio * plotWidth,
        label: formatClock(tMs),
      });
    }

    return {
      points,
      stats: { min: Math.round(minBpm), avg: avgBpm, max: Math.round(maxBpm) },
      yMin,
      yMax,
      xLabels,
    };
  }, [samples, startedAt, endedAt, plotWidth, plotHeight]);

  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const areaPath = useMemo(
    () => buildSmoothAreaPath(points, baseline),
    [points, baseline]
  );

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= Y_TICKS; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / Y_TICKS);
    }
    return ticks;
  }, [yMin, yMax]);

  // A tapped or scrubbed point stays pinned until it's tapped again. It's
  // pinned by time, so late Health samples can't move it to another reading.
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  const pinPoint = useCallback(
    (index: number) => setPinnedTime(points[index]?.tMs ?? null),
    [points]
  );
  const togglePinned = useCallback(
    (index: number) => {
      const tMs = points[index]?.tMs ?? null;
      setPinnedTime((current) => (current === tMs ? null : tMs));
    },
    [points]
  );
  const { gesture, scrubIndex } = useChartScrub(points, {
    onScrubEnd: pinPoint,
    onTap: togglePinned,
  });

  if (!stats) return null;

  const pinnedIndex =
    pinnedTime === null ? -1 : points.findIndex((p) => p.tMs === pinnedTime);
  const activeIndex = scrubIndex ?? (pinnedIndex >= 0 ? pinnedIndex : null);
  const activePoint = activeIndex === null ? undefined : points[activeIndex];
  const avgY =
    PADDING.top +
    plotHeight -
    ((stats.avg - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;
  const lastIndex = points.length - 1;
  const handleAccessibilityAction = (actionName: string) => {
    const current = activeIndex ?? lastIndex;
    if (actionName === "increment") pinPoint(Math.min(current + 1, lastIndex));
    if (actionName === "decrement") pinPoint(Math.max(current - 1, 0));
  };

  return (
    <View style={[styles.card, { backgroundColor: backgroundSubtle }]}>
      <Text style={[Typography.titleSm, { color: textColor }]}>{title}</Text>

      <View style={styles.statsRow}>
        <StatCell
          label={avgLabel}
          value={stats.avg}
          unit={unitLabel}
          valueColor={error}
          labelColor={textMuted}
          textColor={textColor}
        />
        <StatCell
          label={minLabel}
          value={stats.min}
          unit={unitLabel}
          valueColor={textColor}
          labelColor={textMuted}
          textColor={textColor}
        />
        <StatCell
          label={maxLabel}
          value={stats.max}
          unit={unitLabel}
          valueColor={textColor}
          labelColor={textMuted}
          textColor={textColor}
        />
      </View>

      <GestureDetector gesture={gesture}>
        <View
          collapsable={false}
          style={[styles.plot, { height }]}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={title}
          accessibilityValue={{
            text: activePoint
              ? `${Math.round(activePoint.bpm)} ${unitLabel}, ${formatClock(activePoint.tMs)}`
              : `${avgLabel} ${stats.avg} ${unitLabel}`,
          }}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={({ nativeEvent }) =>
            handleAccessibilityAction(nativeEvent.actionName)
          }
        >
          <Svg
            width={chartWidth}
            height={height}
            viewBox={`0 0 ${chartWidth} ${height}`}
          >
            <Defs>
              <LinearGradient
                id={areaGradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={PADDING.top}
                x2={0}
                y2={baseline}
              >
                <Stop offset="0" stopColor={error} stopOpacity={0.26} />
                <Stop offset="0.6" stopColor={error} stopOpacity={0.08} />
                <Stop offset="1" stopColor={error} stopOpacity={0} />
              </LinearGradient>
              {/* Warmer toward the bottom, hotter red at the peaks. */}
              <LinearGradient
                id={lineGradientId}
                gradientUnits="userSpaceOnUse"
                x1={0}
                y1={PADDING.top}
                x2={0}
                y2={baseline}
              >
                <Stop offset="0" stopColor={error} />
                <Stop offset="1" stopColor={warning} />
              </LinearGradient>
            </Defs>

            {yTicks.map((tick) => {
              const y =
                PADDING.top +
                plotHeight -
                ((tick - yMin) / Math.max(yMax - yMin, 1)) * plotHeight;
              return (
                <G key={`hr-yt-${tick.toFixed(1)}`}>
                  <Line
                    x1={PADDING.left}
                    y1={y}
                    x2={chartWidth - PADDING.right}
                    y2={y}
                    stroke={border}
                    strokeWidth={1}
                    strokeDasharray="2 6"
                    strokeLinecap="round"
                  />
                  <SvgText
                    x={PADDING.left - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill={textMuted}
                    fontSize={9}
                    fontWeight="400"
                  >
                    {Math.round(tick).toString()}
                  </SvgText>
                </G>
              );
            })}

            <Path d={areaPath} fill={`url(#${areaGradientId})`} />

            <G testID="hr-average-line">
              <Line
                x1={PADDING.left}
                y1={avgY}
                x2={chartWidth - PADDING.right}
                y2={avgY}
                stroke={error}
                strokeOpacity={0.7}
                strokeWidth={1.5}
                strokeDasharray="0.5 5"
                strokeLinecap="round"
              />
              <SvgText
                x={chartWidth - PADDING.right}
                y={avgY - 5}
                textAnchor="end"
                fill={error}
                fontSize={9}
                fontWeight="600"
              >
                {`${avgLabel} ${stats.avg}`}
              </SvgText>
            </G>

            <Path
              d={linePath}
              fill="none"
              stroke={`url(#${lineGradientId})`}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {activePoint ? (
              <ChartCrosshair
                point={activePoint}
                top={PADDING.top}
                bottom={baseline}
                color={error}
                guideColor={textMuted}
                surfaceColor={backgroundSubtle}
              />
            ) : null}

            {xLabels.map((label, i) => (
              <SvgText
                key={`hr-xl-${i}-${label.label}`}
                x={label.x}
                y={height - 4}
                textAnchor={
                  i === 0
                    ? "start"
                    : i === xLabels.length - 1
                      ? "end"
                      : "middle"
                }
                fill={textMuted}
                fontSize={9}
                fontWeight="400"
              >
                {label.label}
              </SvgText>
            ))}
          </Svg>

          {activePoint ? (
            <ChartTooltip
              anchor={activePoint}
              containerWidth={chartWidth}
              value={`${Math.round(activePoint.bpm)} ${unitLabel}`}
              caption={formatClock(activePoint.tMs)}
            />
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  unit: string;
  valueColor: string;
  labelColor: string;
  textColor: string;
}

function StatCell({
  label,
  value,
  unit,
  valueColor,
  labelColor,
}: StatCellProps) {
  return (
    <View style={styles.statCell}>
      <Text style={[Typography.label, { color: labelColor }]}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text
          style={[
            styles.statValue,
            { color: valueColor, fontFamily: Fonts?.rounded ?? undefined },
          ]}
        >
          {value}
        </Text>
        <Text style={[Typography.caption, { color: labelColor }]}> {unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCell: {
    flex: 1,
    gap: 2,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  statValue: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  plot: {
    position: "relative",
  },
});
