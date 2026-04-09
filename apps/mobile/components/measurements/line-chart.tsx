import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
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
import { Spacing, Typography } from "@/constants/theme";
import type { MeasurementUnit } from "@/data/measurements";

interface LineChartProps {
  data: MeasurementTrendPoint[];
  height?: number;
  unit: MeasurementUnit;
  selectedPoint?: MeasurementTrendPoint | null;
  onPointPress?: (point: MeasurementTrendPoint) => void;
}

const PADDING = { top: 8, right: 8, bottom: 28, left: 44 };
const MIN_POINT_RADIUS = 4;
const SELECTED_POINT_RADIUS = 6;
const MAX_POINTS_LABELS = 6;
const TOUCH_SLOP = 20;

interface ChartPoint {
  x: number;
  y: number;
  value: number;
  date: string;
}

export function MeasurementLineChart({
  data,
  height = 180,
  unit,
  selectedPoint,
  onPointPress,
}: LineChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const border = useThemeColor({}, "border");
  const textColor = useThemeColor({}, "text");
  const primaryContainer = useThemeColor({}, "primaryContainer");

  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;

  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);

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
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / steps);
    }
    return ticks;
  }, [yMin, yMax]);

  const activePoint = hoveredPoint || selectedPoint;

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

        <Path d={areaPath} fill="url(#areaGradient)" />

        <Path
          d={linePath}
          fill="none"
          stroke={primary}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {points.map((p) => {
          const isActive =
            activePoint?.date === p.date && activePoint?.value === p.value;
          return (
            <Circle
              key={`dp-${p.date}`}
              cx={p.x}
              cy={p.y}
              r={isActive ? SELECTED_POINT_RADIUS : MIN_POINT_RADIUS}
              fill={isActive ? primaryContainer : primary}
              stroke={primary}
              strokeWidth={isActive ? 2 : 0}
            />
          );
        })}

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

      {points.map((p) => {
        const isActive =
          activePoint?.date === p.date && activePoint?.value === p.value;
        return (
          <Pressable
            key={`touch-${p.date}`}
            style={[
              styles.touchArea,
              {
                left: p.x - TOUCH_SLOP,
                top: p.y - TOUCH_SLOP,
                width: TOUCH_SLOP * 2,
                height: TOUCH_SLOP * 2,
              },
            ]}
            onPress={() => onPointPress?.(p)}
            onPressIn={() => setHoveredPoint(p)}
            onPressOut={() => setHoveredPoint(null)}
          >
            {isActive && (
              <View
                style={[
                  styles.activeIndicator,
                  { backgroundColor: primaryContainer },
                ]}
              />
            )}
          </Pressable>
        );
      })}

      {activePoint && (
        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: primaryContainer,
              borderColor: primary,
            },
          ]}
        >
          <Text style={[Typography.titleSm, { color: textColor }]}>
            {activePoint.value} {unit}
          </Text>
          <Text style={[Typography.caption, { color: textMuted }]}>
            {formatFullDate(activePoint.date)}
          </Text>
        </View>
      )}
    </View>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatFullDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTickValue(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    position: "relative",
  },
  touchArea: {
    position: "absolute",
  },
  activeIndicator: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -4 }, { translateY: -4 }],
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tooltip: {
    position: "absolute",
    top: Spacing.sm,
    left: "50%",
    transform: [{ translateX: -50 }],
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    gap: 2,
  },
});
