import type { QueryClient } from "@tanstack/react-query";

import {
  calendarKeys,
  statsKeys,
  streakProtectionKeys,
  workoutKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";

/**
 * Refresh everything derived from completed workouts (history, calendar,
 * statistics, streak and the home widgets), whether the save happened online
 * or was replayed from the offline sync queue.
 */
export function invalidateAfterWorkoutSave(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: workoutKeys.all });
  queryClient.invalidateQueries({ queryKey: calendarKeys.all });
  queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
  queryClient.invalidateQueries({ queryKey: statsKeys.all });
  queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });
}
