import { act } from "@testing-library/react-native";

// Mock supabase before importing the store
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock("@/lib/sync-queue", () => ({
  syncQueue: {
    flush: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("@/lib/posthog", () => ({
  flushPostHog: jest.fn(),
}));

jest.mock("@/lib/track-event", () => ({
  identifyUser: jest.fn(),
  resetUser: jest.fn(),
  setUserProperties: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: {
    getState: jest.fn().mockReturnValue({
      reset: jest.fn(),
      syncWithDatabase: jest.fn(),
    }),
  },
}));

jest.mock("@/lib/api/profiles", () => ({
  fetchProfile: jest.fn(),
}));

import { supabase } from "@/lib/supabase";
import { flushPostHog } from "@/lib/posthog";
import { identifyUser, resetUser, trackEvent } from "@/lib/track-event";
import { useAuthStore } from "../auth-store";
import { fetchProfile } from "@/lib/api/profiles";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockFetchProfile = fetchProfile as jest.MockedFunction<
  typeof fetchProfile
>;
const mockFlushPostHog = flushPostHog as jest.MockedFunction<
  typeof flushPostHog
>;
const mockIdentifyUser = identifyUser as jest.MockedFunction<
  typeof identifyUser
>;
const mockResetUser = resetUser as jest.MockedFunction<typeof resetUser>;
const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;

function resetStore() {
  useAuthStore.setState({
    session: null,
    isLoading: false,
    isInitialized: false,
  });
}

describe("useAuthStore", () => {
  beforeEach(() => {
    resetStore();
    jest.clearAllMocks();
  });

  describe("initialize()", () => {
    it("sets isInitialized after getSession resolves", async () => {
      const mockSession = { user: { id: "123" } } as never;

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        await Promise.resolve(); // flush microtasks
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().session).toBe(mockSession);

      unsubscribe();
    });

    it("sets session to null when no session exists", async () => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        await Promise.resolve();
      });

      expect(useAuthStore.getState().isInitialized).toBe(true);
      expect(useAuthStore.getState().session).toBeNull();
      expect(mockResetUser).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).not.toHaveBeenCalledWith("user_signed_out");

      unsubscribe();
    });

    it("handles repeated signed-out callbacks without duplicate analytics", async () => {
      const mockSession = { user: { id: "signed-out-user" } } as never;
      let capturedCallback: (event: string, session: unknown) => void;

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
      );

      const unsubscribe = useAuthStore.getState().initialize();
      await act(async () => {
        await Promise.resolve();
      });
      jest.clearAllMocks();

      act(() => {
        capturedCallback!("SIGNED_OUT", null);
        capturedCallback!("SIGNED_OUT", null);
      });

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith("user_signed_out");
      expect(mockFlushPostHog).toHaveBeenCalledTimes(1);
      expect(mockResetUser).toHaveBeenCalledTimes(1);

      unsubscribe();
    });

    it("returns unsubscribe function that calls subscription.unsubscribe", () => {
      const mockUnsubscribe = jest.fn();
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } },
      });

      const unsubscribe = useAuthStore.getState().initialize();
      unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    it("updates session on onAuthStateChange events", async () => {
      const mockSession = { user: { id: "456" } } as never;
      let capturedCallback: (event: string, session: unknown) => void;

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
      );

      const unsubscribe = useAuthStore.getState().initialize();

      act(() => {
        capturedCallback!("SIGNED_IN", mockSession);
      });

      expect(useAuthStore.getState().session).toBe(mockSession);
      unsubscribe();
    });

    it("syncs onboarding state when session exists on init", async () => {
      const mockSession = { user: { id: "123" } } as never;
      const mockProfile = {
        onboarding_completed: true as const,
        gender: "male" as const,
        goal: "build_strength" as const,
        weekly_frequency: "3" as const,
        equipment_level: "full_gym" as const,
        difficulty_level: "intermediate" as const,
        weight_unit: "kg" as const,
      };

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      mockFetchProfile.mockResolvedValue(mockProfile);

      const { useOnboardingStore } = require("@/stores/onboarding-store");
      const mockSyncWithDatabase = jest.fn();
      useOnboardingStore.getState = jest.fn().mockReturnValue({
        reset: jest.fn(),
        syncWithDatabase: mockSyncWithDatabase,
      });

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        await Promise.resolve(); // flush microtasks
      });

      expect(mockFetchProfile).toHaveBeenCalledTimes(1);
      expect(mockSyncWithDatabase).toHaveBeenCalledWith(mockProfile);

      unsubscribe();
    });

    it("does not sync onboarding state when no session exists", async () => {
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });

      const { useOnboardingStore } = require("@/stores/onboarding-store");
      const mockSyncWithDatabase = jest.fn();
      useOnboardingStore.getState = jest.fn().mockReturnValue({
        reset: jest.fn(),
        syncWithDatabase: mockSyncWithDatabase,
      });

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetchProfile).not.toHaveBeenCalled();
      expect(mockSyncWithDatabase).not.toHaveBeenCalled();

      unsubscribe();
    });

    it("syncs onboarding state on auth state change to signed in", async () => {
      const mockSession = { user: { id: "456" } } as never;
      const mockProfile = {
        onboarding_completed: false as const,
        gender: "female" as const,
        goal: "lose_weight" as const,
        weekly_frequency: "4" as const,
        equipment_level: null as string | null,
        difficulty_level: null as string | null,
        weight_unit: "kg" as const,
      };
      let capturedCallback: (event: string, session: unknown) => void;

      // Get the original mock that was set up at the top of the file
      const { useOnboardingStore } = require("@/stores/onboarding-store");
      const getStateMock = useOnboardingStore.getState;
      const syncWithDatabaseMock = getStateMock().syncWithDatabase;

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockImplementation(
        (cb) => {
          capturedCallback = cb;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        }
      );
      mockFetchProfile.mockResolvedValue(mockProfile);

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        capturedCallback!("SIGNED_IN", mockSession);
        await Promise.resolve(); // flush microtasks
        await Promise.resolve(); // flush more microtasks
      });

      expect(syncWithDatabaseMock).toHaveBeenCalledWith(mockProfile);

      unsubscribe();
    });

    it("handles errors when syncing onboarding state gracefully", async () => {
      const mockSession = { user: { id: "123" } } as never;

      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      mockFetchProfile.mockRejectedValue(new Error("Database error"));

      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

      const unsubscribe = useAuthStore.getState().initialize();

      await act(async () => {
        await Promise.resolve();
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[auth-store] Failed to sync onboarding state:",
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
      unsubscribe();
    });
  });

  describe("signOut()", () => {
    it("calls supabase.auth.signOut", async () => {
      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({});

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      expect(mockSupabase.auth.signOut).toHaveBeenCalledTimes(1);
    });

    it("resets isLoading to false after sign out", async () => {
      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({});

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it("flushes sync queue and resets onboarding store on sign out", async () => {
      const { syncQueue } = require("@/lib/sync-queue");
      const { useOnboardingStore } = require("@/stores/onboarding-store");

      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({});

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      expect(syncQueue.flush).toHaveBeenCalledTimes(1);
      expect(useOnboardingStore.getState().reset).toHaveBeenCalledTimes(1);
    });

    it("captures and resets exactly once when Supabase emits no callback", async () => {
      const mockSession = { user: { id: "explicit-sign-out-user" } } as never;
      (mockSupabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: mockSession },
      });
      (mockSupabase.auth.onAuthStateChange as jest.Mock).mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      });
      (mockSupabase.auth.signOut as jest.Mock).mockResolvedValue({});

      const unsubscribe = useAuthStore.getState().initialize();
      await act(async () => {
        await Promise.resolve();
      });
      jest.clearAllMocks();

      await act(async () => {
        await useAuthStore.getState().signOut();
      });

      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledWith("user_signed_out");
      expect(mockFlushPostHog).toHaveBeenCalledTimes(1);
      expect(mockResetUser).toHaveBeenCalledTimes(1);

      unsubscribe();
    });
  });
});
