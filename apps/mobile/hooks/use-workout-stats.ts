import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { workoutStatsKeys } from "@/lib/query-keys";

interface WorkoutStats {
  totalWorkouts: number | null;
  streakWeeks: number | null;
}

function getISOWeekKey(date: Date): string {
  // Returns "YYYY-WNN" for a given date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week starts on Monday; adjust to Thursday to find the week's year
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function computeStreakWeeks(
  completedAtDates: string[],
  currentWorkoutFinishedAtMs: number
): number {
  const weekSet = new Set<string>();

  // Include current (unsaved) workout
  weekSet.add(getISOWeekKey(new Date(currentWorkoutFinishedAtMs)));

  for (const dateStr of completedAtDates) {
    if (dateStr) {
      weekSet.add(getISOWeekKey(new Date(dateStr)));
    }
  }

  // Walk backwards from current week, counting consecutive weeks in the set
  const now = new Date();
  let streak = 0;
  const cursor = new Date(now);

  // Align cursor to Monday of current week
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
  cursor.setUTCHours(0, 0, 0, 0);

  for (let i = 0; i < 520; i++) {
    // max ~10 years
    const weekKey = getISOWeekKey(cursor);
    if (weekSet.has(weekKey)) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    } else {
      // Allow a one-week gap at the very start (current week may not be done yet)
      if (i === 0) {
        cursor.setUTCDate(cursor.getUTCDate() - 7);
        continue;
      }
      break;
    }
  }

  return streak;
}

async function fetchWorkoutStats(currentWorkoutFinishedAtMs: number): Promise<WorkoutStats> {
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

  const streakWeeks = computeStreakWeeks(completedAtDates, currentWorkoutFinishedAtMs);

  return { totalWorkouts, streakWeeks };
}

export function useWorkoutStats(currentWorkoutFinishedAtMs: number) {
  const { data, isLoading } = useQuery({
    queryKey: workoutStatsKeys.all,
    queryFn: () => fetchWorkoutStats(currentWorkoutFinishedAtMs),
    staleTime: Infinity,
  });

  return {
    totalWorkouts: data?.totalWorkouts ?? null,
    streakWeeks: data?.streakWeeks ?? null,
    isLoading,
  };
}
