import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { DayEntry, WorkoutSession } from "@/components/calendar/types";
import { fetchCalendarEntries } from "@/lib/api/workouts";
import { calendarKeys } from "@/lib/query-keys";

function calendarQueryRange(): { fromIso: string; toIso: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 23, 1);
  from.setHours(0, 0, 0, 0);
  return { fromIso: from.toISOString(), toIso: now.toISOString() };
}

function toLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDayEntryMap(
  rows: { id: string; name: string | null; completed_at: string }[],
  defaultTitle: string
): Map<string, WorkoutSession[]> {
  const map = new Map<string, WorkoutSession[]>();
  for (const row of rows) {
    const dateKey = toLocalDateKey(row.completed_at);
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

export function useCalendarEntries() {
  const { t } = useTranslation("calendar");
  const defaultTitle = t("defaultSessionTitle");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: calendarKeys.entries(),
    queryFn: async () => {
      const { fromIso, toIso } = calendarQueryRange();
      return fetchCalendarEntries(fromIso, toIso);
    },
    staleTime: 60_000,
  });

  const byDate = useMemo(
    () => buildDayEntryMap(data ?? [], defaultTitle),
    [data, defaultTitle]
  );

  const getEntriesForMonth = useCallback(
    (year: number, month: number) => entriesForMonth(byDate, year, month),
    [byDate]
  );

  return { getEntriesForMonth, isLoading, isRefetching, refetch };
}
