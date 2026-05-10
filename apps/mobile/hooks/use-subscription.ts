import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile-query";
import { fetchWeeklyUsage } from "@/lib/api/subscription";
import { subscriptionKeys } from "@/lib/query-keys";

const FREE_WEEKLY_LIMIT = 5;

export interface SubscriptionState {
  tier: "free" | "pro";
  isProActive: boolean;
  weeklyUsage: number;
  weeklyLimit: number;
  remainingGenerations: number;
  canGenerate: boolean;
  isLoading: boolean;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const tier = profile?.subscription_tier ?? "free";
  const expiresAt = profile?.subscription_expires_at ?? null;

  const isProActive =
    tier === "pro" && (expiresAt === null || new Date(expiresAt) > new Date());

  const usageQuery = useQuery({
    queryKey: subscriptionKeys.usage(),
    queryFn: fetchWeeklyUsage,
    // Only fetch usage for free users — pro users are unlimited
    enabled: !!user && !isProActive && !profileLoading,
    staleTime: 60_000,
  });

  if (isProActive) {
    return {
      tier: "pro",
      isProActive: true,
      weeklyUsage: 0,
      weeklyLimit: Infinity,
      remainingGenerations: Infinity,
      canGenerate: true,
      isLoading: profileLoading,
    };
  }

  const weeklyUsage = usageQuery.data?.used ?? 0;
  const remaining = Math.max(FREE_WEEKLY_LIMIT - weeklyUsage, 0);

  return {
    tier: "free",
    isProActive: false,
    weeklyUsage,
    weeklyLimit: FREE_WEEKLY_LIMIT,
    remainingGenerations: remaining,
    canGenerate: remaining > 0,
    isLoading: profileLoading || usageQuery.isLoading,
  };
}
