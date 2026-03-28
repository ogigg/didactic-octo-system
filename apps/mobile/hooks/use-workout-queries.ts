import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  fetchWorkoutDetail,
  fetchWorkoutHistoryForDayRange,
  fetchWorkoutHistoryPage,
  fetchWorkoutSessions,
} from "@/lib/api/workouts";
import { localDayBoundsIso } from "@/lib/local-day-bounds";
import { workoutKeys } from "@/lib/query-keys";

export function useWorkoutSessions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.list(),
    queryFn: () => fetchWorkoutSessions(),
    enabled: !!user,
  });
}

const HISTORY_PAGE_SIZE = 20;

export function useWorkoutHistory(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const enabled = options?.enabled ?? true;

  return useInfiniteQuery({
    queryKey: workoutKeys.list(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchWorkoutHistoryPage(HISTORY_PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage) => {
      if (lastPage.length < HISTORY_PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return last?.completed_at ?? undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!user && enabled,
  });
}

export function useWorkoutHistoryForDay(dateKey: string) {
  const { user } = useAuth();
  const bounds = localDayBoundsIso(dateKey);

  return useQuery({
    queryKey: workoutKeys.forDay(dateKey),
    queryFn: () => {
      if (!bounds) {
        throw new Error("Invalid date key");
      }
      return fetchWorkoutHistoryForDayRange(bounds.startIso, bounds.endIso);
    },
    enabled: !!user && !!bounds,
    staleTime: 60_000,
  });
}

export function useWorkoutDetail(sessionId: string) {
  return useQuery({
    queryKey: workoutKeys.detail(sessionId),
    queryFn: () => fetchWorkoutDetail(sessionId),
    enabled: !!sessionId,
  });
}
