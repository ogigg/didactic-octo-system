import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchWeeklyDurations } from "@/lib/api/workouts";
import { getISOWeekKey, getMondayLocal } from "@/lib/iso-week";
import { workoutStatsKeys } from "@/lib/query-keys";

export interface WeeklyDurationEntry {
  week: string;
  minutes: number;
}

function weekKeyForLocalMonday(mondayLocal: Date): string {
  const mid = new Date(mondayLocal);
  mid.setDate(mid.getDate() + 3);
  return getISOWeekKey(mid);
}

function buildWeeklyDurations(
  rows: { started_at: string; completed_at: string }[],
  weekCount: number
): WeeklyDurationEntry[] {
  const now = new Date();
  const thisMonday = getMondayLocal(now);
  const oldestMonday = new Date(thisMonday);
  oldestMonday.setDate(oldestMonday.getDate() - 7 * (weekCount - 1));

  const sums = new Map<string, number>();
  for (const row of rows) {
    const start = new Date(row.started_at).getTime();
    const end = new Date(row.completed_at).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    const minutes = (end - start) / 60_000;
    const key = getISOWeekKey(new Date(row.completed_at));
    sums.set(key, (sums.get(key) ?? 0) + minutes);
  }

  const result: WeeklyDurationEntry[] = [];
  for (let i = 0; i < weekCount; i++) {
    const monday = new Date(oldestMonday);
    monday.setDate(monday.getDate() + i * 7);
    const key = weekKeyForLocalMonday(monday);
    result.push({
      week: `W${i + 1}`,
      minutes: Math.round(sums.get(key) ?? 0),
    });
  }
  return result;
}

export function useWeeklyDurations(weekCount: number) {
  const fromIso = useMemo(() => {
    const now = new Date();
    const thisMonday = getMondayLocal(now);
    const oldestMonday = new Date(thisMonday);
    oldestMonday.setDate(oldestMonday.getDate() - 7 * (weekCount - 1));
    return oldestMonday.toISOString();
  }, [weekCount]);

  const { data, isLoading } = useQuery({
    queryKey: [...workoutStatsKeys.all, "weekly-durations", weekCount] as const,
    queryFn: () => fetchWeeklyDurations(fromIso),
    staleTime: 60_000,
  });

  const weeklyDurations = useMemo(
    () => buildWeeklyDurations(data ?? [], weekCount),
    [data, weekCount]
  );

  return { weeklyDurations, isLoading };
}
