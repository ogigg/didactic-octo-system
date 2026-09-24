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

/**
 * Local fallback for the weekly streak, used before `get_streak_status`
 * resolves and to reflect a workout that was just saved.
 *
 * Known discrepancy (SWE-139): this counts every `completed` session, while
 * `get_streak_status` only counts sessions with at least one completed set and
 * also credits weeks covered by a freeze or restore. The server value wins
 * whenever it is available; see `resolveStreakWeeks`.
 */
export function computeStreakWeeks(
  completedAtDates: string[],
  currentWorkoutFinishedAtMs?: number,
  now: Date = new Date()
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

/**
 * Prefer the server streak (it applies freezes and restarts). While a freshly
 * finished workout is not yet reflected server-side, the local streak may be
 * one week ahead, so take the larger value only in that window.
 */
export function resolveStreakWeeks(input: {
  protectedStreak: number | null;
  localStreak: number | null;
  hasJustFinishedWorkout: boolean;
}): number | null {
  const { protectedStreak, localStreak, hasJustFinishedWorkout } = input;

  if (hasJustFinishedWorkout) {
    return Math.max(localStreak ?? 0, protectedStreak ?? 0);
  }

  return protectedStreak ?? localStreak;
}

// Total workouts intentionally counts every `completed` session. The streak
// RPC additionally requires a completed set, so a session finished with zero
// logged sets raises the total without extending the streak (SWE-139).
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

  const streakWeeks = useMemo(
    () =>
      resolveStreakWeeks({
        protectedStreak: streakStatusQuery.data?.current_streak_weeks ?? null,
        localStreak:
          data != null
            ? computeStreakWeeks(
                data.completedAtDates,
                currentWorkoutFinishedAtMs
              )
            : null,
        hasJustFinishedWorkout: currentWorkoutFinishedAtMs !== undefined,
      }),
    [currentWorkoutFinishedAtMs, data, streakStatusQuery.data]
  );

  return {
    totalWorkouts: data?.totalWorkouts ?? null,
    streakWeeks,
    isLoading: isLoading || streakStatusQuery.isLoading,
    refetch,
  };
}
