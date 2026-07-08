import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useStreakStatus } from "@/hooks/use-streak-protection";
import { getISOWeekKey } from "@/lib/iso-week";
import { supabase } from "@/lib/supabase";
import { workoutStatsKeys } from "@/lib/query-keys";

interface WorkoutStatsFetched {
  totalWorkouts: number | null;
  completedAtDates: string[];
}

function computeStreakWeeks(
  completedAtDates: string[],
  currentWorkoutFinishedAtMs?: number
): number {
  const weekSet = new Set<string>();

  if (currentWorkoutFinishedAtMs !== undefined) {
    weekSet.add(getISOWeekKey(new Date(currentWorkoutFinishedAtMs)));
  }

  for (const dateStr of completedAtDates) {
    if (dateStr) {
      weekSet.add(getISOWeekKey(new Date(dateStr)));
    }
  }

  const now = new Date();
  let streak = 0;
  const cursor = new Date(now);

  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < 520; i++) {
    const weekKey = getISOWeekKey(cursor);
    if (weekSet.has(weekKey)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    } else {
      if (i === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 7);
        continue;
      }
      break;
    }
  }

  return streak;
}

async function fetchWorkoutStatsBase(): Promise<WorkoutStatsFetched> {
  const [countResult, datesResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("workout_sessions")
      .select("completed_at")
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false }),
  ]);

  const totalWorkouts = countResult.count ?? null;
  const completedAtDates =
    datesResult.data?.map((r) => r.completed_at as string) ?? [];

  return { totalWorkouts, completedAtDates };
}

export function useWorkoutStats(currentWorkoutFinishedAtMs?: number) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: workoutStatsKeys.all,
    queryFn: fetchWorkoutStatsBase,
    staleTime: Infinity,
  });
  const streakStatusQuery = useStreakStatus();

  const streakWeeks = useMemo(() => {
    const protectedStreak =
      streakStatusQuery.data?.current_streak_weeks ?? null;
    const localStreak =
      data != null
        ? computeStreakWeeks(data.completedAtDates, currentWorkoutFinishedAtMs)
        : null;

    if (currentWorkoutFinishedAtMs !== undefined) {
      return Math.max(localStreak ?? 0, protectedStreak ?? 0);
    }

    return protectedStreak ?? localStreak;
  }, [currentWorkoutFinishedAtMs, data, streakStatusQuery.data]);

  return {
    totalWorkouts: data?.totalWorkouts ?? null,
    streakWeeks,
    isLoading: isLoading || streakStatusQuery.isLoading,
    refetch,
  };
}
