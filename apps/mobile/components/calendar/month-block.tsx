import { useThemeColor } from "@/hooks/use-theme-color";
import { Spacing, Typography } from "@/constants/theme";
import { StyleSheet, Text, View } from "react-native";
import { DayCell } from "./day-cell";
import type { DayEntry } from "./mock-data";

interface MonthBlockProps {
  year: number;
  month: number;
  entries: DayEntry[];
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

export function MonthBlock({ year, month, entries }: MonthBlockProps) {
  const textColor = useThemeColor({}, "text");
  const textMuted = useThemeColor({}, "textMuted");

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
          return (
            <DayCell
              key={day}
              day={day}
              sessions={entry ? entry.sessions : []}
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
