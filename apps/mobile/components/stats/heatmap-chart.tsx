import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { Spacing } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";

interface HeatmapDay {
  date: string;
  volume_kg: number;
  duration_minutes: number;
}

interface HeatmapChartProps {
  data: HeatmapDay[];
  cellSize?: number;
}

const DAY_LABEL_WIDTH = 20;
const MONTH_LABEL_HEIGHT = 16;
const CELL_GAP = 2;
const WEEKS = 52;
const DAYS_IN_WEEK = 7;
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
const DAY_LABELS: { row: number; label: string }[] = [
  { row: 0, label: "M" },
  { row: 2, label: "W" },
  { row: 4, label: "F" },
];

function getIntensityLevel(day: HeatmapDay | undefined): number {
  if (!day || day.volume_kg === 0) return 0;
  if (day.volume_kg > 6000) return 4;
  if (day.volume_kg > 3000) return 3;
  if (day.volume_kg > 1000) return 2;
  return 1;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  // getDay(): 0=Sun, 1=Mon ... 6=Sat; we want Mon=0
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function HeatmapChart({
  data,
  cellSize: cellSizeProp,
}: HeatmapChartProps) {
  const { width: screenWidth } = useWindowDimensions();
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");
  const textMuted = useThemeColor({}, "textMuted");

  const cellSize =
    cellSizeProp ??
    Math.floor((screenWidth - 2 * Spacing.xl - DAY_LABEL_WIDTH) / 53);

  const chartHeight =
    MONTH_LABEL_HEIGHT + DAYS_IN_WEEK * (cellSize + CELL_GAP) + CELL_GAP + 16;
  const chartWidth =
    DAY_LABEL_WIDTH + WEEKS * cellSize + (WEEKS - 1) * CELL_GAP;

  // Build lookup map
  const dataMap = new Map<string, HeatmapDay>();
  for (const d of data) {
    dataMap.set(d.date, d);
  }

  // Start from Monday of week 52 weeks ago
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMonday = getMondayOfWeek(today);
  startMonday.setDate(startMonday.getDate() - WEEKS * 7);

  // Build grid: columns = weeks, rows = days (0=Mon, 6=Sun)
  interface GridCell {
    col: number;
    row: number;
    date: string;
    level: number;
  }
  const cells: GridCell[] = [];

  interface MonthLabel {
    col: number;
    label: string;
  }
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;

  for (let col = 0; col < WEEKS; col++) {
    for (let row = 0; row < DAYS_IN_WEEK; row++) {
      const d = new Date(startMonday);
      d.setDate(d.getDate() + col * 7 + row);
      const dateStr = toISODate(d);
      const level = getIntensityLevel(dataMap.get(dateStr));
      cells.push({ col, row, date: dateStr, level });

      if (row === 0) {
        const month = d.getMonth();
        if (month !== prevMonth) {
          monthLabels.push({ col, label: MONTH_ABBREVS[month] });
          prevMonth = month;
        }
      }
    }
  }

  // Legend
  const legendY =
    MONTH_LABEL_HEIGHT + DAYS_IN_WEEK * (cellSize + CELL_GAP) + CELL_GAP + 2;
  const intensityOpacities = [0.25, 0.5, 0.75, 1.0];

  return (
    <View style={styles.container}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Month labels */}
        {monthLabels.map((ml) => {
          const x = DAY_LABEL_WIDTH + ml.col * (cellSize + CELL_GAP);
          return (
            <SvgText
              key={`month-${ml.col}`}
              x={x}
              y={MONTH_LABEL_HEIGHT - 4}
              fontSize={9}
              fill={textMuted}
            >
              {ml.label}
            </SvgText>
          );
        })}

        {/* Day labels */}
        {DAY_LABELS.map((dl) => {
          const y =
            MONTH_LABEL_HEIGHT +
            dl.row * (cellSize + CELL_GAP) +
            cellSize / 2 +
            3;
          return (
            <SvgText
              key={`day-${dl.row}`}
              x={0}
              y={y}
              fontSize={9}
              fill={textMuted}
            >
              {dl.label}
            </SvgText>
          );
        })}

        {/* Cells */}
        {cells.map((cell) => {
          const x = DAY_LABEL_WIDTH + cell.col * (cellSize + CELL_GAP);
          const y = MONTH_LABEL_HEIGHT + cell.row * (cellSize + CELL_GAP);
          const isEmpty = cell.level === 0;
          return (
            <Rect
              key={cell.date}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={isEmpty ? borderColor : primaryColor}
              opacity={isEmpty ? 0.15 : intensityOpacities[cell.level - 1]}
            />
          );
        })}

        {/* Legend */}
        <SvgText
          x={DAY_LABEL_WIDTH}
          y={legendY + cellSize}
          fontSize={9}
          fill={textMuted}
        >
          Less
        </SvgText>
        {[0, 1, 2, 3, 4].map((level) => {
          const legendCellX =
            DAY_LABEL_WIDTH + 26 + level * (cellSize + CELL_GAP);
          const isEmpty = level === 0;
          return (
            <Rect
              key={`legend-${level}`}
              x={legendCellX}
              y={legendY}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={isEmpty ? borderColor : primaryColor}
              opacity={isEmpty ? 0.15 : intensityOpacities[level - 1]}
            />
          );
        })}
        <SvgText
          x={DAY_LABEL_WIDTH + 26 + 5 * (cellSize + CELL_GAP) + 2}
          y={legendY + cellSize}
          fontSize={9}
          fill={textMuted}
        >
          More
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
});
