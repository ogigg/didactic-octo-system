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

import { supabase } from "@/lib/supabase";
import { useAuthStore } from "../auth-store";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

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
  });
});
