import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { upsertProfile } from "@/lib/api/profiles";
import type { OnboardingData } from "@/lib/api/profiles";
import { profileKeys } from "@/lib/query-keys";
import { syncQueue } from "@/lib/sync-queue";

export function useUpsertProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: OnboardingData) => upsertProfile(data),
    onSuccess: () => {
      if (user) {
        queryClient.invalidateQueries({
          queryKey: profileKeys.detail(user.id),
        });
      }
    },
    onError: (_error: unknown, variables: OnboardingData) => {
      if (user) {
        syncQueue
          .enqueue("upsert_profile", user.id, variables)
          .catch(console.warn);
      }
    },
  });
}
