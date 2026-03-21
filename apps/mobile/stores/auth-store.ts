import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
}

interface AuthActions {
  initialize: () => () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  session: null,
  isLoading: false,
  isInitialized: false,

  initialize: () => {
    // Get existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session, isInitialized: true });
    });

    // Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session, isInitialized: true });
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
}));
