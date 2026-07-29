import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { fetchProfile } from "@/lib/api/profiles";
import { cancelAccountDeletion } from "@/lib/api/delete-account";
import { queryClient } from "@/lib/query-client";
import { usePendingWorkoutStore } from "@/stores/pending-workout-store";

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => {
  let activeUserId: string | null = null;

  async function prepareUserState(userId: string) {
    if (!usePendingWorkoutStore.persist.hasHydrated()) {
      await usePendingWorkoutStore.persist.rehydrate();
    }

    if (activeUserId !== userId) {
      queryClient.clear();
      usePendingWorkoutStore.getState().bindUser(userId);
      activeUserId = userId;
    }
  }

  function clearUserState() {
    queryClient.clear();
    usePendingWorkoutStore.getState().reset();
    activeUserId = null;
  }

  async function syncOnboardingState(userId: string) {
    try {
      await prepareUserState(userId);
      if (!useOnboardingStore.persist.hasHydrated()) {
        await useOnboardingStore.persist.rehydrate();
      }
      const profile = await fetchProfile();
      if (profile) {
        useOnboardingStore.getState().syncWithDatabase(profile);
      }
    } catch (error) {
      console.warn("[auth-store] Failed to sync onboarding state:", error);
    }
  }

  // If the user scheduled deletion and then signed back in during the grace
  // period, treat that as a change of heart and clear the pending deletion.
  async function clearPendingDeletion() {
    try {
      await cancelAccountDeletion();
    } catch (error) {
      console.warn("[auth-store] Failed to clear pending deletion:", error);
    }
  }

  return {
    session: null,
    isLoading: false,
    isInitialized: false,

    initialize: () => {
      // Get existing session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        set({ session });
        if (session) {
          await syncOnboardingState(session.user.id);
        } else {
          clearUserState();
        }
        set({ isInitialized: true });
      });

      // Subscribe to auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        const shouldResolveActivation =
          event === "SIGNED_IN" || event === "INITIAL_SESSION";

        if (!session) {
          clearUserState();
          set({ session, isInitialized: true });
        } else if (shouldResolveActivation) {
          set({ session, isInitialized: false });
          void syncOnboardingState(session.user.id).finally(() => {
            set({ isInitialized: true });
          });
        } else {
          set({ session });
        }

        if (session) {
          if (event === "SIGNED_IN") {
            clearPendingDeletion();
          }
        }
      });

      return () => subscription.unsubscribe();
    },

    signOut: async () => {
      set({ isLoading: true });
      await supabase.auth.signOut();
      await syncQueue.flush();
      useOnboardingStore.getState().reset();
      clearUserState();
      set({ isLoading: false });
    },
  };
});
