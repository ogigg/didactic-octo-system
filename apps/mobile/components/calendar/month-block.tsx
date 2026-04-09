import { Spacing, Typography } from "@/constants/theme";
import { useThemeColor } from "@/hooks/use-theme-color";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DayCell } from "./day-cell";
import type { DayEntry, WorkoutSession } from "./types";

interface MonthBlockProps {
  year: number;
  month: number;
  entries: DayEntry[];
  onDayPress?: (dateKey: string, sessions: WorkoutSession[]) => void;
}

const DAYS_OF_WEEK = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const CELL_HEIGHT = 60;
const HEADER_HEIGHT = 24 + Spacing["2xl"]; // titleMd + margin
const WEEKDAY_ROW_HEIGHT = 20 + Spacing.md;
const BOTTOM_GAP = Spacing["4xl"];

export function getMonthHeight(year: number, month: number): number {
  const firstDay = new Date(year, month - 1, 1).getDay();
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
  onDayPress,
}: MonthBlockProps) {
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

  const { isCurrentMonth, todayDate } = useMemo(() => {
    const today = new Date();
    return {
      isCurrentMonth:
        today.getFullYear() === year && today.getMonth() + 1 === month,
      todayDate: today.getDate(),
    };
  }, [year, month]);

  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const entryByDay = new Map<number, DayEntry>();
  for (const entry of entries) {
    const day = parseInt(entry.date.split("-")[2], 10);
    entryByDay.set(day, entry);
  }

  const leadingBlanks = Array.from({ length: firstDayOfWeek });
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Text style={[Typography.titleMd, styles.header, { color: textColor }]}>
        {MONTH_NAMES[month - 1]} {year}
      </Text>

      <View style={styles.weekdayRow}>
        {DAYS_OF_WEEK.map((d) => (
          <Text
            key={d}
            style={[Typography.label, styles.weekdayCell, { color: textMuted }]}
          >
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {leadingBlanks.map((_, i) => (
          <View key={`blank-${i}`} style={styles.blankCell} />
        ))}
        {days.map((day) => {
          const entry = entryByDay.get(day);
          const sessions = entry ? entry.sessions : [];
          const key = dateKeyForDay(year, month, day);
          return (
            <DayCell
              key={day}
              day={day}
              isToday={isCurrentMonth && day === todayDate}
              sessions={sessions}
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
    width: `${100 / 7}%` as unknown as number,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    overflow: "visible",
  },
  blankCell: {
    width: `${100 / 7}%` as unknown as number,
    height: 60,
  },
});
