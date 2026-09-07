import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { upsertProfile } from "@/lib/api/profiles";
import type { OnboardingData } from "@/lib/api/profiles";
import { profileKeys } from "@/lib/query-keys";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { trackEvent } from "@/lib/track-event";
import { syncQueue } from "@/lib/sync-queue";

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: OnboardingData) => upsertProfile(data, user?.id),
    onSuccess: (_result, data) => {
      const draft = useOnboardingStore.getState();
      if (user && draft.ownerUserId === user.id) {
        const started = draft.onboardingStartedAt
          ? Date.parse(draft.onboardingStartedAt)
          : NaN;
        draft.complete();
        trackEvent("onboarding_completed", {
          goal_category: data.goal ?? "custom",
          weekly_frequency: data.frequency,
          equipment: data.equipment,
          experience: data.experience,
          baseline_count: data.strengthBaselines.length,
          ...(Number.isFinite(started)
            ? {
                duration_seconds: Math.max(
                  0,
                  Math.floor((Date.now() - started) / 1000)
                ),
              }
            : {}),
        });
      }
      if (user) {
        queryClient.invalidateQueries({
          queryKey: profileKeys.detail(user.id),
        });
      }
    },
    onError: (_error: unknown, variables: OnboardingData) => {
      if (user) {
        syncQueue
          .enqueue("upsert_profile", user.id, variables, user.id)
          .catch(console.warn);
      }
    },
  });
}
