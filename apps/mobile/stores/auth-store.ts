import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { fetchProfile } from "@/lib/api/profiles";
import { cancelAccountDeletion } from "@/lib/api/delete-account";

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
  async function syncOnboardingState() {
    try {
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
          await syncOnboardingState();
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
          set({ session, isInitialized: true });
        } else if (shouldResolveActivation) {
          set({ session, isInitialized: false });
          void syncOnboardingState().finally(() => {
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
      set({ isLoading: false });
    },
  };
});
