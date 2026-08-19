import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { fetchProfile } from "@/lib/api/profiles";
import { cancelAccountDeletion } from "@/lib/api/delete-account";
import {
  identifyObservabilityUser,
  resetObservabilityIdentity,
} from "@/lib/operational-observability";

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
  let observedUserId: string | null = null;

  function syncObservabilityForSession(session: Session | null) {
    const nextUserId = session?.user.id ?? null;
    if (nextUserId !== observedUserId) {
      resetObservabilityIdentity();
      observedUserId = nextUserId;
    }
    if (session) {
      void identifyObservabilityUser().catch(() => {
        // Identity telemetry must never interrupt authentication.
      });
    }
  }

  async function syncOnboardingState() {
    try {
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
      supabase.auth.getSession().then(({ data: { session } }) => {
        set({ session, isInitialized: true });
        syncObservabilityForSession(session);
        if (session) {
          syncOnboardingState();
        }
      });

      // Subscribe to auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        set({ session, isInitialized: true });
        syncObservabilityForSession(session);
        if (session) {
          syncOnboardingState();
          if (event === "SIGNED_IN") {
            clearPendingDeletion();
          }
        }
      });

      return () => subscription.unsubscribe();
    },

    signOut: async () => {
      set({ isLoading: true });
      resetObservabilityIdentity();
      observedUserId = null;
      await supabase.auth.signOut();
      await syncQueue.flush();
      useOnboardingStore.getState().reset();
      set({ isLoading: false });
    },
  };
});
