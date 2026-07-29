import { act } from "@testing-library/react-native";

import { MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS } from "@/lib/pending-workout-recovery";
import { pendingWorkoutKeys } from "@/lib/query-keys";
import {
  canUsePendingWorkoutState,
  usePendingWorkoutStore,
} from "@/stores/pending-workout-store";

describe("pending workout user-scoped recovery state", () => {
  beforeEach(() => {
    act(() => {
      usePendingWorkoutStore.setState({
        ownerUserId: null,
        hasHydrated: true,
        queueGenerationStartedAt: null,
        queueGenerationTrigger: null,
        queueGenerationSource: null,
        recoveryAttempts: {},
        recoveryExposedAt: {},
        regeneratingWorkoutIds: [],
      });
    });
  });

  it("clears retry and attribution state when the authenticated user changes", () => {
    act(() => {
      usePendingWorkoutStore.getState().bindUser("user-a");
      usePendingWorkoutStore
        .getState()
        .markQueueGenerationStarted("onboarding");
      usePendingWorkoutStore.getState().recordRecoveryAttempt("workout-a");
      usePendingWorkoutStore.getState().markRecoveryExposed("workout-a", 1234);
      usePendingWorkoutStore.getState().bindUser("user-b");
    });

    const state = usePendingWorkoutStore.getState();
    expect(state.ownerUserId).toBe("user-b");
    expect(state.recoveryAttempts).toEqual({});
    expect(state.recoveryExposedAt).toEqual({});
    expect(state.queueGenerationTrigger).toBeNull();
  });

  it("retains a bounded retry count at the limit after hydration", () => {
    act(() => {
      usePendingWorkoutStore.setState({
        ownerUserId: "user-a",
        hasHydrated: true,
        recoveryAttempts: {
          "workout-a": MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS,
        },
      });
    });

    expect(
      usePendingWorkoutStore.getState().recoveryAttempts["workout-a"]
    ).toBe(MAX_PENDING_WORKOUT_RECOVERY_ATTEMPTS);
  });

  it("does not consume an attempt when an offline claim is rejected", async () => {
    await expect(
      usePendingWorkoutStore
        .getState()
        .recordRecoveryAttemptAfterClaim("workout-a", async () => {
          throw new Error("Network request failed");
        })
    ).rejects.toThrow("Network request failed");

    expect(
      usePendingWorkoutStore.getState().recoveryAttempts["workout-a"]
    ).toBeUndefined();
  });

  it("increments only after the server accepts the claim", async () => {
    const result = await usePendingWorkoutStore
      .getState()
      .recordRecoveryAttemptAfterClaim("workout-a", async () => ({
        claimToken: "claim",
        generationVersion: 2,
      }));

    expect(result.attemptCount).toBe(1);
    expect(result.claim.generationVersion).toBe(2);
  });

  it("gates queue state until hydration completes for the same user", () => {
    expect(canUsePendingWorkoutState("user-a", "user-a", false)).toBe(false);
    expect(canUsePendingWorkoutState("user-a", "user-b", true)).toBe(false);
    expect(canUsePendingWorkoutState("user-a", "user-a", true)).toBe(true);
  });

  it("uses distinct TanStack query keys for different accounts", () => {
    expect(pendingWorkoutKeys.list("user-a")).not.toEqual(
      pendingWorkoutKeys.list("user-b")
    );
  });
});
