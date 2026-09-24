import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { DayEntry, WorkoutSession } from "@/components/calendar/types";
import { fetchStreakCalendarData } from "@/lib/api/streak-calendar";
import {
  getCalendarWeekStartKey,
  getCalendarDateKey,
  getCalendarWeekStartKeyForDateKey,
  MOCK_NEXT_WEEK_AS_RUINED,
  MOCK_FAILED_WEEK_WITH_FREEZE,
  getStreakWeekStatuses,
  type StreakWeekStatus,
} from "@/lib/streak-calendar";
import { fetchCalendarEntries } from "@/lib/api/workouts";
import { calendarKeys } from "@/lib/query-keys";

function calendarQueryRange(): { fromIso: string; toIso: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  from.setHours(0, 0, 0, 0);
  return { fromIso: from.toISOString(), toIso: now.toISOString() };
}

function streakCalendarQueryRange(): { fromIso: string; toIso: string } {
  const range = calendarQueryRange();
  const from = new Date(
    `${getCalendarWeekStartKey(new Date(range.fromIso))}T00:00:00`
  );
  from.setDate(from.getDate() - 7);
  return { fromIso: from.toISOString(), toIso: range.toIso };
}

function buildDayEntryMap(
  rows: { id: string; name: string | null; completed_at: string }[],
  defaultTitle: string
): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>();
  for (const row of rows) {
    const dateKey = getCalendarDateKey(new Date(row.completed_at));
    const title = row.name?.trim() || defaultTitle;
    const list = map.get(dateKey) ?? [];
    list.push({ id: row.id, title });
    map.set(dateKey, list);
  }
  return map;
}

function entriesForMonth(
  byDate: Map<string, WorkoutSession[]>,
  year: number,
  month: number
): DayEntry[] {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const result: DayEntry[] = [];
  for (const [date, sessions] of byDate) {
    if (date.startsWith(prefix)) {
      result.push({ date, sessions });
    }
  }
  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export function useCalendarEntries(today = getCalendarDateKey(new Date())) {
  const { t } = useTranslation("calendar");
  const defaultTitle = t("defaultSessionTitle");

  const entriesQuery = useQuery({
    queryKey: calendarKeys.entries(),
    queryFn: async () => {
      const { fromIso, toIso } = calendarQueryRange();
      return fetchCalendarEntries(fromIso, toIso);
    },
    staleTime: 60_000,
  });

  const streakWeeksQuery = useQuery({
    queryKey: calendarKeys.streakWeeks(),
    queryFn: async () => {
      const { fromIso, toIso } = streakCalendarQueryRange();
      return fetchStreakCalendarData(fromIso, toIso);
    },
    staleTime: 60_000,
  });

  const { data } = entriesQuery;

  const byDate = useMemo(
    () => buildDayEntryMap(data ?? [], defaultTitle),
    [data, defaultTitle]
  );

  const weekStatuses = useMemo(
    () =>
      getStreakWeekStatuses(
        streakWeeksQuery.data ?? {
          qualifyingCompletedAtDates: [],
          protectedWeekStarts: [],
        },
        new Date(`${today}T00:00:00`),
        MOCK_NEXT_WEEK_AS_RUINED
      ),
    [streakWeeksQuery.data, today]
  );

  const getEntriesForMonth = useCallback(
    (year: number, month: number) => entriesForMonth(byDate, year, month),
    [byDate]
  );

  const getWeekStatusForDate = useCallback(
    (dateKey: string): StreakWeekStatus | undefined => {
      const weekStart = getCalendarWeekStartKeyForDateKey(dateKey);
      return weekStart === MOCK_FAILED_WEEK_WITH_FREEZE?.weekStart
        ? "ruined"
        : weekStatuses.get(weekStart);
    },
    [weekStatuses]
  );

  const refetch = useCallback(async () => {
    await Promise.all([entriesQuery.refetch(), streakWeeksQuery.refetch()]);
  }, [entriesQuery.refetch, streakWeeksQuery.refetch]);

  return {
    getEntriesForMonth,
    getWeekStatusForDate,
    isLoading: entriesQuery.isLoading,
    isRefetching: entriesQuery.isRefetching || streakWeeksQuery.isRefetching,
    refetch,
  };
}
