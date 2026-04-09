import { useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";

interface LineChartProps {
  data: MeasurementTrendPoint[];
  height?: number;
}

const PADDING = { top: 8, right: 8, bottom: 28, left: 44 };
const MIN_POINT_RADIUS = 2.5;
const MAX_POINTS_LABELS = 6;

export function MeasurementLineChart({ data, height = 180 }: LineChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40; // account for screen padding
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");

  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const { points, yMin, yMax, xLabels } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], yMin: 0, yMax: 100, xLabels: [] };
    }

    const values = data.map((d) => d.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = (rawMax - rawMin) * 0.1 || 1;
    const yMin = rawMin - padding;
    const yMax = rawMax + padding;

    const points = data.map((d, i) => {
      const x =
        PADDING.left +
        (data.length === 1
          ? plotWidth / 2
          : (i / (data.length - 1)) * plotWidth);
      const y =
        PADDING.top +
        plotHeight -
        ((d.value - yMin) / (yMax - yMin)) * plotHeight;
      return { x, y, value: d.value, date: d.date };
    });

    // Generate x-axis labels (evenly spaced from the data)
    const xLabels: string[] = [];
    if (data.length <= MAX_POINTS_LABELS) {
      xLabels.push(...data.map((d) => formatDate(d.date)));
    } else {
      const step = Math.ceil(data.length / MAX_POINTS_LABELS);
      for (let i = 0; i < data.length; i += step) {
        xLabels.push(formatDate(data[i].date));
      }
    }

    return { points, yMin, yMax, xLabels };
  }, [data, plotWidth, plotHeight]);

  // Build SVG path
  const linePath = useMemo(() => {
    if (points.length === 0) return "";
    return points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
  }, [points]);

  // Build area fill path (closes to the bottom)
  const areaPath = useMemo(() => {
    if (points.length === 0) return "";
    const bottom = PADDING.top + plotHeight;
    const line = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(" ");
    return `${line} L ${points[points.length - 1].x} ${bottom} L ${points[0].x} ${bottom} Z`;
  }, [points, plotHeight]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / steps);
    }
    return ticks;
  }, [yMin, yMax]);

  if (data.length === 0) return null;

  return (
    <View style={[styles.container, { height }]}>
      <Svg
        width={chartWidth}
        height={height}
        viewBox={`0 0 ${chartWidth} ${height}`}
      >
        <Defs>
          <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={primary} stopOpacity={0.2} />
            <Stop offset="100%" stopColor={primary} stopOpacity={0.02} />
          </LinearGradient>
        </Defs>

        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick) => {
          const y =
            PADDING.top +
            plotHeight -
            ((tick - yMin) / (yMax - yMin)) * plotHeight;
          return (
            <View key={`yt-${tick.toFixed(2)}`}>
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
                fontSize={10}
                fontWeight="400"
              >
                {formatTickValue(tick)}
              </SvgText>
            </View>
          );
        })}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#areaGradient)" />

        {/* Line */}
        <Path
          d={linePath}
          fill="none"
          stroke={primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p) => (
          <Circle
            key={`dp-${p.date}`}
            cx={p.x}
            cy={p.y}
            r={MIN_POINT_RADIUS}
            fill={primary}
          />
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => {
          const xIndex =
            data.length <= MAX_POINTS_LABELS
              ? i
              : Math.min(
                  Math.ceil((i * (data.length - 1)) / (xLabels.length - 1)),
                  data.length - 1
                );
          const x =
            data.length === 1
              ? PADDING.left + plotWidth / 2
              : PADDING.left + (xIndex / (data.length - 1)) * plotWidth;
          return (
            <SvgText
              key={`xl-${label}`}
              x={x}
              y={height - 4}
              textAnchor="middle"
              fill={textMuted}
              fontSize={9}
              fontWeight="400"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatTickValue(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
  },
});
