import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import {
  getCalendarWeekStartKeyForDateKey,
  getCalendarDateKey,
  MOCK_FAILED_WEEK_WITH_FREEZE,
  type StreakWeekStatus,
} from "@/lib/streak-calendar";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
} from "react-native";
import { DayCell } from "./day-cell";
import type { DayEntry, WorkoutSession } from "./types";

interface MonthBlockProps {
  year: number;
  month: number;
  entries: DayEntry[];
  todayDateKey?: string;
  onDayPress?: (dateKey: string, sessions: WorkoutSession[]) => void;
  getWeekStatusForDate?: (dateKey: string) => StreakWeekStatus | undefined;
}

const DAYS_OF_WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const CELL_HEIGHT = 60;
const COLUMN_COUNT = 7;
const FALLBACK_COLUMN_WIDTH = `${100 / COLUMN_COUNT}%` as const;
const HEADER_HEIGHT = 24 + Spacing["2xl"]; // titleMd + margin
const WEEKDAY_ROW_HEIGHT = 20 + Spacing.md;
const BOTTOM_GAP = Spacing["4xl"];

export function getMonthHeight(year: number, month: number): number {
  const firstDay = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const totalCells = firstDay + daysInMonth;
  const rows = Math.ceil(totalCells / 7);
  return HEADER_HEIGHT + WEEKDAY_ROW_HEIGHT + rows * CELL_HEIGHT + BOTTOM_GAP;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function dateKeyForDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function MonthBlock({
  year,
  month,
  entries,
  todayDateKey = getCalendarDateKey(new Date()),
  onDayPress,
  getWeekStatusForDate,
}: MonthBlockProps) {
  const { t } = useTranslation("calendar");
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");
  const [containerWidth, setContainerWidth] = useState<number>();

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (nextWidth <= 0) return;

    setContainerWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth
    );
  }, []);

  const columnWidth: DimensionValue =
    containerWidth === undefined
      ? FALLBACK_COLUMN_WIDTH
      : Math.floor(containerWidth / COLUMN_COUNT);

  const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const entryByDay = new Map<number, DayEntry>();
  for (const entry of entries) {
    const day = parseInt(entry.date.split("-")[2], 10);
    entryByDay.set(day, entry);
  }

  const leadingBlanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View
      testID="calendar-month-layout"
      style={styles.container}
      onLayout={handleLayout}
    >
      <Text style={[Typography.titleMd, styles.header, { color: textColor }]}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      <View style={styles.weekdayRow}>
        {DAYS_OF_WEEK.map((d) => (
          <Text
            key={d}
            style={[
              Typography.label,
              styles.weekdayCell,
              { color: textMuted, width: columnWidth },
            ]}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {leadingBlanks.map((_, i) => (
          <View
            key={`blank-${i}`}
            style={[styles.blankCell, { width: columnWidth }]}
          />
        ))}
        {days.map((day) => {
          const entry = entryByDay.get(day);
          const sessions = entry ? entry.sessions : [];
          const key = dateKeyForDay(year, month, day);
          const weekStart = getCalendarWeekStartKeyForDateKey(key);
          const weekStatus = getWeekStatusForDate?.(key);
          const column = (firstDayOfWeek + day - 1) % COLUMN_COUNT;
          const previousKey = dateKeyForDay(year, month, day - 1);
          const nextKey = dateKeyForDay(year, month, day + 1);
          const bandStart =
            day === 1 ||
            column === 0 ||
            getCalendarWeekStartKeyForDateKey(previousKey) !== weekStart ||
            getWeekStatusForDate?.(previousKey) !== weekStatus;
          const bandEnd =
            day === daysInMonth ||
            column === 6 ||
            getCalendarWeekStartKeyForDateKey(nextKey) !== weekStart ||
            getWeekStatusForDate?.(nextKey) !== weekStatus;
          return (
            <DayCell
              key={day}
              day={day}
              isToday={key === todayDateKey}
              sessions={sessions}
              width={columnWidth}
              dateKey={key}
              weekStart={weekStart}
              weekStatus={weekStatus}
              isFreezeDay={key === MOCK_FAILED_WEEK_WITH_FREEZE?.freezeDate}
              bandStart={bandStart}
              bandEnd={bandEnd}
              showWeekMarker={column === 6 || day === daysInMonth}
              weekStatusLabel={
                weekStatus ? t(`weekStatus.${weekStatus}`) : undefined
              }
              onPress={
                sessions.length > 0 && onDayPress
                  ? () => onDayPress(key, sessions)
                  : undefined
              }
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: BOTTOM_GAP,
  },
  header: {
    marginBottom: Spacing["2xl"],
  },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  weekdayCell: {
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "visible",
  },
  blankCell: {
    height: 60,
  },
});
