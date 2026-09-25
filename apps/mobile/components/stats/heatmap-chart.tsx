import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";

import { Spacing } from "@/constants/theme";
import { useAppCatalogLanguage } from "@/hooks/use-exercises-query";
import { useThemeColor } from "@/hooks/use-theme-color";

interface HeatmapDay {
  date: string;
  volume_kg: number;
  duration_minutes: number;
}

interface HeatmapChartProps {
  data: HeatmapDay[];
  cellSize?: number;
  weeks?: number;
}

const DAY_LABEL_WIDTH = 20;
const MONTH_LABEL_HEIGHT = 16;
const CELL_GAP = 2;
const DEFAULT_WEEKS = 52;
const DAYS_IN_WEEK = 7;
// Rows 0, 2 and 4 are Monday, Wednesday and Friday.
const DAY_LABEL_ROWS = [0, 2, 4];
// 2024-01-01 was a Monday; adding a row index gives that weekday.
const FIRST_MONDAY_UTC = Date.UTC(2024, 0, 1);
const LEGEND_CELLS_OFFSET = 26;
const LEGEND_LABEL_GAP = 3;
const LEGEND_FONT_SIZE = 9;
const DAY_MS = 24 * 60 * 60 * 1000;

// SVG text can't be measured before layout; ~0.6em per character is a safe
// upper bound for these short Latin labels.
function estimateLabelWidth(label: string): number {
  return Math.ceil(label.length * LEGEND_FONT_SIZE * 0.6);
}

/**
 * Monday/Wednesday/Friday initials, or short names when the initials clash
 * (Polish gives "P, Ś, P").
 */
function getDayLabels(locale: string) {
  const format = (style: "narrow" | "short") => {
    const formatter = new Intl.DateTimeFormat(locale, {
      weekday: style,
      timeZone: "UTC",
    });
    return DAY_LABEL_ROWS.map((row) =>
      formatter.format(FIRST_MONDAY_UTC + row * DAY_MS).replace(/\.$/, "")
    );
  };
  const narrow = format("narrow");
  const labels =
    new Set(narrow).size === narrow.length ? narrow : format("short");
  return DAY_LABEL_ROWS.map((row, index) => ({ row, label: labels[index] }));
}

function getIntensityLevel(day: HeatmapDay | undefined): number {
  if (!day) return 0;
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
  weeks = DEFAULT_WEEKS,
}: HeatmapChartProps) {
  const { t } = useTranslation("stats");
  const locale = useAppCatalogLanguage();
  const { width: screenWidth } = useWindowDimensions();
  const primaryColor = useThemeColor({}, "primary");
  const borderColor = useThemeColor({}, "border");
  const textMuted = useThemeColor({}, "textMuted");

  const WEEKS = weeks;
  const available = screenWidth - 2 * Spacing.xl - DAY_LABEL_WIDTH;
  const computed = Math.floor((available - (WEEKS - 1) * CELL_GAP) / WEEKS);
  const cellSize = cellSizeProp ?? Math.max(4, Math.min(28, computed));

  const gridWidth = DAY_LABEL_WIDTH + WEEKS * cellSize + (WEEKS - 1) * CELL_GAP;
  const lessLabel = t("heatmap.less");
  const moreLabel = t("heatmap.more");
  // The right-aligned "less" label must fit left of the cells, so push the
  // cells right when a translation is longer than the default offset.
  const legendCellsX = Math.max(
    DAY_LABEL_WIDTH + LEGEND_CELLS_OFFSET,
    estimateLabelWidth(lessLabel) + LEGEND_LABEL_GAP
  );
  const legendWidth =
    legendCellsX -
    DAY_LABEL_WIDTH +
    5 * cellSize +
    4 * CELL_GAP +
    Math.max(32, LEGEND_LABEL_GAP + estimateLabelWidth(moreLabel));
  const chartWidth = Math.max(gridWidth, DAY_LABEL_WIDTH + legendWidth);
  const chartHeight =
    MONTH_LABEL_HEIGHT +
    DAYS_IN_WEEK * (cellSize + CELL_GAP) +
    CELL_GAP +
    cellSize +
    12;

  const monthFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short" }),
    [locale]
  );
  const dayLabels = useMemo(() => getDayLabels(locale), [locale]);

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
          monthLabels.push({ col, label: monthFormatter.format(d) });
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
        {dayLabels.map((dl) => {
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
        {/* Right-aligned so longer translations grow away from the cells. */}
        <SvgText
          x={legendCellsX - LEGEND_LABEL_GAP}
          y={legendY + cellSize}
          fontSize={LEGEND_FONT_SIZE}
          fill={textMuted}
          textAnchor="end"
        >
          {lessLabel}
        </SvgText>
        {[0, 1, 2, 3, 4].map((level) => {
          const legendCellX = legendCellsX + level * (cellSize + CELL_GAP);
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
          x={legendCellsX + 5 * (cellSize + CELL_GAP) + LEGEND_LABEL_GAP}
          y={legendY + cellSize}
          fontSize={LEGEND_FONT_SIZE}
          fill={textMuted}
        >
          {moreLabel}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    overflow: "hidden",
  },
});
