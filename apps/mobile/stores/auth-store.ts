import { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { syncQueue } from "@/lib/sync-queue";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { fetchProfile } from "@/lib/api/profiles";
import { cancelAccountDeletion } from "@/lib/api/delete-account";
import { flushPostHog } from "@/lib/posthog";
import {
  identifyUser,
  resetUser,
  setUserProperties,
  trackEvent,
} from "@/lib/track-event";

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
  let explicitSignOutInProgress = false;
  let activeAnalyticsUserId: string | null = null;
  let signOutAnalyticsHandled = false;

  function syncAnalyticsIdentity(session: Session | null) {
    const userId = session?.user?.id?.trim() || null;
    if (!userId) {
      // A null session can be returned on startup, after token expiry, or
      // during an external sign-out. Always clear the SDK's persisted person;
      // if there was an active account, capture its sign-out exactly once.
      handleSignedOutAnalytics();
      return;
    }

    activeAnalyticsUserId = userId;
    signOutAnalyticsHandled = false;
    identifyUser(userId);
  }

  function handleSignedOutAnalytics() {
    // Supabase can deliver SIGNED_OUT both from signOut() and from an external
    // session change. The explicit signOut path finalizes this same transition
    // after Supabase succeeds, so suppress its callback but never suppress the
    // actual cleanup.
    if (explicitSignOutInProgress || signOutAnalyticsHandled) {
      return;
    }

    if (activeAnalyticsUserId) {
      trackEvent("user_signed_out");
      flushPostHog();
    }

    // Even an initial/expired null session must clear PostHog's persisted
    // identity. This call also resets screen de-duplication for the next user.
    resetUser();
    activeAnalyticsUserId = null;
    signOutAnalyticsHandled = true;
  }

  function finalizeExplicitSignOut() {
    if (signOutAnalyticsHandled) return;

    if (activeAnalyticsUserId) {
      // Capture while the authenticated identity is still active. Resetting
      // afterwards prevents the next account from inheriting this timeline.
      trackEvent("user_signed_out");
      flushPostHog();
    }
    resetUser();
    activeAnalyticsUserId = null;
    signOutAnalyticsHandled = true;
  }

  async function syncOnboardingState() {
    try {
      const profile = await fetchProfile();
      if (profile) {
        useOnboardingStore.getState().syncWithDatabase(profile);
        setUserProperties({
          onboarding_completed: profile.onboarding_completed,
          goal_category: profile.goal,
          weekly_frequency:
            profile.weekly_frequency === "5_plus"
              ? 5
              : Number(profile.weekly_frequency),
          equipment: profile.equipment_level,
          experience: profile.difficulty_level,
        });
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
      // Each auth subscription owns a fresh transition guard. The PostHog
      // reset below still clears any persisted identity if getSession returns
      // null, while stale callbacks from a previous subscription cannot emit a
      // duplicate sign-out event.
      activeAnalyticsUserId = null;
      signOutAnalyticsHandled = false;

      // Get existing session
      supabase.auth.getSession().then(({ data: { session } }) => {
        set({ session, isInitialized: true });
        syncAnalyticsIdentity(session);
        if (session) {
          syncOnboardingState();
        }
      });

      // Subscribe to auth state changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        set({ session, isInitialized: true });
        if (!session) {
          handleSignedOutAnalytics();
        } else {
          syncAnalyticsIdentity(session);
        }
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
      explicitSignOutInProgress = true;

      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn("[auth-store] Sign out failed.");
          return;
        }

        try {
          await syncQueue.flush();
        } catch (error) {
          // A failed local flush must not leave a signed-out person persisted
          // or allow the next account to inherit this identity.
          console.warn(
            "[auth-store] Failed to flush sync queue on sign out:",
            error
          );
        }
        useOnboardingStore.getState().reset();
        set({ session: null });
        finalizeExplicitSignOut();
      } finally {
        explicitSignOutInProgress = false;
        set({ isLoading: false });
      }
    },
  };
});
