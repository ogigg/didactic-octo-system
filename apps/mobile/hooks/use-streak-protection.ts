import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import {
  applyStreakProtection,
  dismissStreakPrompt,
  fetchStreakStatus,
  recordComebackEvent,
  restartStreak,
  type ComebackEventType,
  type StreakPromptState,
  type StreakProtectionType,
} from "@/lib/api/streak-protection";
import {
  statsKeys,
  streakProtectionKeys,
  workoutStatsKeys,
} from "@/lib/query-keys";

function useInvalidateStreakProtection() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: streakProtectionKeys.all });
    queryClient.invalidateQueries({ queryKey: workoutStatsKeys.all });
    queryClient.invalidateQueries({ queryKey: statsKeys.all });
  };
}

export function useStreakStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: streakProtectionKeys.status(user?.id ?? ""),
    queryFn: fetchStreakStatus,
    enabled: !!user,
    staleTime: 60_000,
  });
}

export function useApplyStreakProtection() {
  const invalidate = useInvalidateStreakProtection();

  return useMutation({
    mutationFn: (protectionType: StreakProtectionType) =>
      applyStreakProtection(protectionType),
    onSuccess: invalidate,
  });
}

export function useDismissStreakPrompt() {
  const invalidate = useInvalidateStreakProtection();

  return useMutation({
    mutationFn: (promptState: StreakPromptState) =>
      dismissStreakPrompt(promptState),
    onSuccess: invalidate,
  });
}

export function useRestartStreak() {
  const invalidate = useInvalidateStreakProtection();

  return useMutation({
    mutationFn: restartStreak,
    onSuccess: invalidate,
  });
}

export function useRecordComebackEvent() {
  const invalidate = useInvalidateStreakProtection();

  return useMutation({
    mutationFn: (input: {
      eventType: ComebackEventType;
      metadata?: Record<string, string | number | boolean | null>;
    }) => recordComebackEvent(input.eventType, input.metadata),
    onSuccess: invalidate,
  });
}
