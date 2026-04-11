import { useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { Fonts, Radii, Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
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

const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };
const TARGET_POINTS = 60;
const Y_TICKS = 4;
const X_LABEL_COUNT = 4;

interface PlotPoint {
  x: number;
  y: number;
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

  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

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

  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const bottom = PADDING.top + plotHeight;
    const line = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    return `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  }, [points, plotHeight]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let i = 0; i <= Y_TICKS; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / Y_TICKS);
    }
    return ticks;
  }, [yMin, yMax]);

  if (!stats) return null;

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

      <View style={{ height }}>
        <Svg
          width={chartWidth}
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
        >
          <Defs>
            <LinearGradient id="hrAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={error} stopOpacity={0.22} />
              <Stop offset="100%" stopColor={error} stopOpacity={0.02} />
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
                  strokeWidth={0.5}
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

          <Path d={areaPath} fill="url(#hrAreaGradient)" />

          <Path
            d={linePath}
            fill="none"
            stroke={error}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {xLabels.map((label, i) => (
            <SvgText
              key={`hr-xl-${i}-${label.label}`}
              x={label.x}
              y={height - 4}
              textAnchor={
                i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"
              }
              fill={textMuted}
              fontSize={9}
              fontWeight="400"
            >
              {label.label}
            </SvgText>
          ))}
        </Svg>
      </View>
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
});
