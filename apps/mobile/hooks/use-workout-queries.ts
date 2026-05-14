import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { useAppCatalogLanguage } from "@/hooks/use-exercises-query";
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
  const language = useAppCatalogLanguage();
  const enabled = options?.enabled ?? true;

  return useInfiniteQuery({
    queryKey: workoutKeys.list(language),
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
  const language = useAppCatalogLanguage();

  return useQuery({
    queryKey: workoutKeys.detail(sessionId, language),
    queryFn: () => fetchWorkoutDetail(sessionId),
    enabled: !!sessionId,
  });
}
