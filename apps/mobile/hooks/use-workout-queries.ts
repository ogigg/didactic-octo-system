import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { fetchWorkoutDetail, fetchWorkoutSessions } from "@/lib/api/workouts";
import { workoutKeys } from "@/lib/query-keys";

export function useWorkoutSessions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: workoutKeys.list(),
    queryFn: () => fetchWorkoutSessions(),
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
