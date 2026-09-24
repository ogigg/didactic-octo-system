import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { fetchWeeklyDurations } from "@/lib/api/workouts";
import { workoutStatsKeys } from "@/lib/query-keys";
import { buildWeeklyMinutes, getWindowStart } from "@/lib/weekly-activity";

export interface WeeklyDurationEntry {
  week: string;
  minutes: number;
}

export function useWeeklyDurations(weekCount: number) {
  const fromIso = useMemo(
    () => getWindowStart(new Date(), weekCount).toISOString(),
    [weekCount]
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: [...workoutStatsKeys.all, "weekly-durations", weekCount] as const,
    queryFn: () => fetchWeeklyDurations(fromIso),
    staleTime: 60_000,
  });

  const weeklyDurations = useMemo<WeeklyDurationEntry[]>(
    () =>
      buildWeeklyMinutes(data ?? [], new Date(), weekCount).map(
        (week, index) => ({ week: `W${index + 1}`, minutes: week.minutes })
      ),
    [data, weekCount]
  );

  return { weeklyDurations, isLoading, refetch };
}
