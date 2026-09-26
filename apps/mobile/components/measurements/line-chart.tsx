import { useCallback, useId, useMemo } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Svg, {
  Circle,
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
import { useChartScrub } from "@/hooks/use-chart-scrub";
import { useAppCatalogLanguage } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";
import type { MeasurementTrendPoint } from "@/lib/api/body-measurements";
import {
  buildSmoothAreaPath,
  buildSmoothLinePath,
  type ChartPoint,
} from "@/lib/chart-geometry";
import type { MeasurementUnit } from "@/data/measurements";

interface LineChartProps {
  data: MeasurementTrendPoint[];
  height?: number;
  unit: MeasurementUnit;
  selectedPoint?: MeasurementTrendPoint | null;
  onPointPress?: (point: MeasurementTrendPoint) => void;
  /** Screen-reader name for the chart, e.g. the measured field. */
  accessibilityLabel?: string;
}

const PADDING = { top: 16, right: 12, bottom: 28, left: 44 };
const MAX_POINTS_LABELS = 6;
/** Past this many points the dots crowd the line, so only the latest stays. */
const MAX_VISIBLE_DOTS = 12;

interface PlotPoint extends ChartPoint {
  value: number;
  date: string;
}

export function MeasurementLineChart({
  data,
  height = 180,
  unit,
  selectedPoint,
  onPointPress,
  accessibilityLabel,
}: LineChartProps) {
  const locale = useAppCatalogLanguage();
  // Measurement dates are date-only strings (parsed as UTC midnight), so
  // format them in UTC to show the logged day in every time zone.
  const { axisFormatter, fullFormatter } = useMemo(
    () => ({
      axisFormatter: new Intl.DateTimeFormat(locale, {
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
      }),
      fullFormatter: new Intl.DateTimeFormat(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }),
    }),
    [locale]
  );
  const { width: screenWidth } = useWindowDimensions();
  const chartWidth = screenWidth - 40;
  const textMuted = useThemeColor({}, "textMuted");
  const primary = useThemeColor({}, "primary");
  const accentEnd = useThemeColor({}, "heroGradientEnd");
  const border = useThemeColor({}, "border");
  const background = useThemeColor({}, "background");
  const gradientId = useId().replace(/:/g, "");
  const areaGradientId = `measurement-area-${gradientId}`;
  const lineGradientId = `measurement-line-${gradientId}`;

  const plotWidth = chartWidth - PADDING.left - PADDING.right;
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const baseline = PADDING.top + plotHeight;

  const { points, yMin, yMax, xLabels } = useMemo(() => {
    if (data.length === 0) {
      return { points: [] as PlotPoint[], yMin: 0, yMax: 100, xLabels: [] };
    }

    const values = data.map((d) => d.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const padding = (rawMax - rawMin) * 0.1 || 1;
    const yMin = rawMin - padding;
    const yMax = rawMax + padding;

    const points: PlotPoint[] = data.map((d, i) => {
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
      xLabels.push(...data.map((d) => formatDate(d.date, axisFormatter)));
    } else {
      const step = Math.ceil(data.length / MAX_POINTS_LABELS);
      for (let i = 0; i < data.length; i += step) {
        xLabels.push(formatDate(data[i].date, axisFormatter));
      }
    }

    return { points, yMin, yMax, xLabels };
  }, [axisFormatter, data, plotWidth, plotHeight]);

  const linePath = useMemo(() => buildSmoothLinePath(points), [points]);
  const areaPath = useMemo(
    () => buildSmoothAreaPath(points, baseline),
    [points, baseline]
  );

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      ticks.push(yMin + ((yMax - yMin) * i) / steps);
    }
    return ticks;
  }, [yMin, yMax]);

  const selectPoint = useCallback(
    (index: number) => {
      const point = data[index];
      if (point) onPointPress?.(point);
    },
    [data, onPointPress]
  );
  const { gesture, scrubIndex } = useChartScrub(points, {
    onScrubEnd: selectPoint,
    onTap: selectPoint,
  });

  if (data.length === 0) return null;

  const selectedIndex = selectedPoint
    ? data.findIndex(
        (d) => d.date === selectedPoint.date && d.value === selectedPoint.value
      )
    : -1;
  const activeIndex = scrubIndex ?? (selectedIndex >= 0 ? selectedIndex : null);
  const activePoint = activeIndex === null ? undefined : points[activeIndex];
  const lastIndex = points.length - 1;
  const lastPoint = points[lastIndex];
  const previousPoint =
    activeIndex !== null && activeIndex > 0
      ? points[activeIndex - 1]
      : undefined;
  const summaryPoint = activePoint ?? lastPoint;
  const describePoint = (point: PlotPoint) =>
    `${point.value} ${unit}, ${formatDate(point.date, fullFormatter) || point.date}`;

  // Stepping through points only means something when the parent selects them.
  const adjustable = onPointPress !== undefined;
  const handleAccessibilityAction = (actionName: string) => {
    const current = activeIndex ?? lastIndex;
    if (actionName === "increment")
      selectPoint(Math.min(current + 1, lastIndex));
    if (actionName === "decrement") selectPoint(Math.max(current - 1, 0));
  };

  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={[styles.container, { height }]}
        accessible
        accessibilityRole={adjustable ? "adjustable" : undefined}
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ text: describePoint(summaryPoint) }}
        accessibilityActions={
          adjustable
            ? [{ name: "increment" }, { name: "decrement" }]
            : undefined
        }
        onAccessibilityAction={
          adjustable
            ? ({ nativeEvent }) =>
                handleAccessibilityAction(nativeEvent.actionName)
            : undefined
        }
      >
        <Svg
          width={chartWidth}
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
        >
          <Defs>
            {/* User-space gradients also paint a perfectly flat line, whose
                bounding box has no height. */}
            <LinearGradient
              id={areaGradientId}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={PADDING.top}
              x2={0}
              y2={baseline}
            >
              <Stop offset="0" stopColor={primary} stopOpacity={0.28} />
              <Stop offset="0.6" stopColor={primary} stopOpacity={0.08} />
              <Stop offset="1" stopColor={primary} stopOpacity={0} />
            </LinearGradient>
            <LinearGradient
              id={lineGradientId}
              gradientUnits="userSpaceOnUse"
              x1={PADDING.left}
              y1={0}
              x2={chartWidth - PADDING.right}
              y2={0}
            >
              <Stop offset="0" stopColor={primary} />
              <Stop offset="1" stopColor={accentEnd} />
            </LinearGradient>
          </Defs>

          {yTicks.map((tick) => {
            const y =
              PADDING.top +
              plotHeight -
              ((tick - yMin) / (yMax - yMin)) * plotHeight;
            return (
              <G key={`yt-${tick.toFixed(2)}`}>
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
                  x={PADDING.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill={textMuted}
                  fontSize={10}
                  fontWeight="400"
                >
                  {formatTickValue(tick)}
                </SvgText>
              </G>
            );
          })}

          <Path d={areaPath} fill={`url(#${areaGradientId})`} />

          <Path
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradientId})`}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.length <= MAX_VISIBLE_DOTS
            ? points
                .slice(0, -1)
                .map((p, i) => (
                  <Circle
                    key={`dp-${i}-${p.date}`}
                    cx={p.x}
                    cy={p.y}
                    r={3}
                    fill={background}
                    stroke={`url(#${lineGradientId})`}
                    strokeWidth={1.5}
                  />
                ))
            : null}

          {/* The latest measurement gets a soft halo so "now" stands out. */}
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={9}
            fill={accentEnd}
            opacity={0.18}
          />
          <Circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={4}
            fill={accentEnd}
            stroke={background}
            strokeWidth={2}
          />

          {activePoint ? (
            <ChartCrosshair
              point={activePoint}
              top={PADDING.top}
              bottom={baseline}
              color={primary}
              guideColor={textMuted}
              surfaceColor={background}
            />
          ) : null}

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
                key={`xl-${xIndex}`}
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

        {activePoint ? (
          <ChartTooltip
            anchor={activePoint}
            containerWidth={chartWidth}
            value={`${activePoint.value} ${unit}`}
            detail={
              previousPoint
                ? formatChange(activePoint.value - previousPoint.value, unit)
                : undefined
            }
            caption={
              formatDate(activePoint.date, fullFormatter) || activePoint.date
            }
          />
        ) : null}
      </View>
    </GestureDetector>
  );
}

// `Intl` throws on an invalid date, so return an empty label instead.
function formatDate(dateStr: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(dateStr);
  return Number.isNaN(date.getTime()) ? "" : formatter.format(date);
}

function formatTickValue(value: number): string {
  if (value >= 100) return Math.round(value).toString();
  if (value >= 10) return value.toFixed(0);
  return value.toFixed(1);
}

/** Signed change since the previous entry, e.g. "+0.4 kg" or "−1.2 cm". */
function formatChange(delta: number, unit: string): string {
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "±";
  return `${sign}${Math.abs(rounded)} ${unit}`;
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
    position: "relative",
  },
});
