import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "owner-a" } }),
}));
jest.mock("@/lib/api/profiles", () => ({ upsertProfile: jest.fn() }));
jest.mock("@/lib/sync-queue", () => ({
  syncQueue: { enqueue: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
import { useUpsertProfile } from "../use-profile-mutations";
import { upsertProfile } from "@/lib/api/profiles";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { syncQueue } from "@/lib/sync-queue";
const data = {
  gender: null,
  goal: "build_strength" as const,
  customGoal: null,
  frequency: 3 as const,
  equipment: "bodyweight" as const,
  experience: "beginner" as const,
  strengthBaselines: [],
};
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      {children}
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  useOnboardingStore.getState().reset();
  useOnboardingStore.getState().prepareForUser("owner-a");
});
it("completes the owned draft after a confirmed save", async () => {
  (upsertProfile as jest.Mock).mockResolvedValue(undefined);
  const { result } = renderHook(useUpsertProfile, { wrapper });
  await act(async () => {
    await result.current.mutateAsync(data);
  });
  expect(useOnboardingStore.getState().isCompleted).toBe(true);
});
it("keeps failed answers unfinished and queues them for the original account", async () => {
  (upsertProfile as jest.Mock).mockRejectedValue(new Error("offline"));
  const { result } = renderHook(useUpsertProfile, { wrapper });
  act(() => result.current.mutate(data));
  await waitFor(() => expect(result.current.isError).toBe(true));
  expect(useOnboardingStore.getState().isCompleted).toBe(false);
  expect(syncQueue.enqueue).toHaveBeenCalledWith(
    "upsert_profile",
    "owner-a",
    data,
    "owner-a"
  );
});
it("does not complete another account's draft after a delayed success", async () => {
  let finish!: () => void;
  (upsertProfile as jest.Mock).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  const { result } = renderHook(useUpsertProfile, { wrapper });
  act(() => result.current.mutate(data));
  await waitFor(() => expect(upsertProfile).toHaveBeenCalled());
  useOnboardingStore.getState().prepareForUser("owner-b");
  await act(async () => finish());
  expect(useOnboardingStore.getState().isCompleted).toBe(false);
});
