import {
  mergePersistedPendingWorkoutState,
  usePendingWorkoutStore,
} from "../pending-workout-store";

describe("pending workout ownership", () => {
  beforeEach(() => {
    usePendingWorkoutStore.getState().prepareForUser(null);
  });

  it("clears another account's queue-generation context", () => {
    usePendingWorkoutStore.getState().prepareForUser("user-a");
    usePendingWorkoutStore
      .getState()
      .markQueueGenerationStarted("onboarding", "request-a");

    usePendingWorkoutStore.getState().prepareForUser("user-b");

    expect(usePendingWorkoutStore.getState()).toMatchObject({
      ownerUserId: "user-b",
      queueGenerationRequestId: null,
      queueGenerationTrigger: null,
      queueGenerationStartedAt: null,
    });
  });

  it("keeps the account's own context", () => {
    usePendingWorkoutStore.getState().prepareForUser("user-a");
    usePendingWorkoutStore
      .getState()
      .markQueueGenerationStarted("replenishment", "request-a");

    usePendingWorkoutStore.getState().prepareForUser("user-a");

    expect(usePendingWorkoutStore.getState().queueGenerationRequestId).toBe(
      "request-a"
    );
  });

  describe("mergePersistedPendingWorkoutState", () => {
    const current = {
      ...usePendingWorkoutStore.getState(),
      ownerUserId: "user-b",
    };
    const saved = {
      ownerUserId: "user-a",
      queueGenerationRequestId: "request-a",
    };

    it("ignores a late load of another account's context", () => {
      expect(mergePersistedPendingWorkoutState(saved, current, "user-b")).toBe(
        current
      );
    });

    it("ignores ownerless saved context once an account is signed in", () => {
      const legacy = { queueGenerationRequestId: "request-legacy" };

      expect(mergePersistedPendingWorkoutState(legacy, current, "user-b")).toBe(
        current
      );
    });

    it("restores the account's own saved context", () => {
      expect(
        mergePersistedPendingWorkoutState(saved, current, "user-a")
      ).toMatchObject({ queueGenerationRequestId: "request-a" });
    });

    it("restores saved context before auth has reported an account", () => {
      expect(
        mergePersistedPendingWorkoutState(saved, current, undefined)
      ).toMatchObject({
        ownerUserId: "user-a",
        queueGenerationRequestId: "request-a",
      });
    });
  });
});
