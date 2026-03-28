import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  fetchWorkoutDetail,
  fetchWorkoutHistoryPage,
  fetchWorkoutSessions,
} from "@/lib/api/workouts";
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

export function useWorkoutHistory() {
  const { user } = useAuth();

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
    enabled: !!user,
  });
}

export function useWorkoutDetail(sessionId: string) {
  return useQuery({
    queryKey: workoutKeys.detail(sessionId),
    queryFn: () => fetchWorkoutDetail(sessionId),
    enabled: !!sessionId,
  });
}
