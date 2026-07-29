import AsyncStorage from "@react-native-async-storage/async-storage";

import { SyncQueue, type SyncQueueItem } from "../sync-queue";

const mockTrackEvent = jest.fn();
jest.mock("@/lib/track-event", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
let storedQueue: string | null;

function createStoredItem(
  overrides: Partial<SyncQueueItem> = {}
): SyncQueueItem {
  return {
    id: "id-1",
    operation: "op",
    payload: {},
    updatedAt: Date.now(),
    retryCount: 0,
    nextRetryAt: 0,
    createdAt: Date.now(),
    status: "pending",
    recoveryAttempts: 0,
    diagnosticReference: "SYNC-TEST0001",
    version: 1,
    ...overrides,
  };
}

function readStoredItems(): SyncQueueItem[] {
  return JSON.parse(storedQueue ?? "[]") as SyncQueueItem[];
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("SyncQueue", () => {
  let queue: SyncQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    storedQueue = null;
    mockAsyncStorage.getItem.mockImplementation(() =>
      Promise.resolve(storedQueue)
    );
    mockAsyncStorage.setItem.mockImplementation((_key, value) => {
      storedQueue = value;
      return Promise.resolve();
    });
    mockAsyncStorage.removeItem.mockImplementation(() => {
      storedQueue = null;
      return Promise.resolve();
    });
    queue = new SyncQueue();
  });

  afterEach(() => {
    queue.setActive(false);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("enqueue()", () => {
    it("adds a versioned item with a privacy-safe diagnostic reference", async () => {
      await queue.enqueue("upsert_profile", "user-1", { name: "test" });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "sync-queue",
        expect.any(String)
      );
      expect(readStoredItems()[0]).toMatchObject({
        id: "user-1",
        operation: "upsert_profile",
        payload: { name: "test" },
        status: "pending",
        retryCount: 0,
        recoveryAttempts: 0,
        version: 1,
      });
      expect(readStoredItems()[0].diagnosticReference).toMatch(
        /^SYNC-[A-Z0-9]{8}$/
      );
    });

    it("coalesces the same logical write using last-call-wins versioning", async () => {
      await queue.enqueue("upsert_profile", "user-1", { value: "old" });
      await queue.enqueue("upsert_profile", "user-1", { value: "new" });

      expect(readStoredItems()).toHaveLength(1);
      expect(readStoredItems()[0]).toMatchObject({
        payload: { value: "new" },
        version: 2,
      });
    });

    it("keeps different logical identities as separate writes", async () => {
      await queue.enqueue("upsert_measurement", "user-1:measurement:day-1", {
        value: 80,
      });
      await queue.enqueue("upsert_measurement", "user-1:measurement:day-2", {
        value: 81,
      });

      expect(readStoredItems()).toHaveLength(2);
    });
  });

  describe("processing and concurrency", () => {
    it("processes an online enqueue immediately and removes it on success", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", { name: "test" });
      await queue.processQueue();

      expect(handler).toHaveBeenCalledWith(
        { name: "test" },
        expect.objectContaining({ id: "id-1", version: 1 })
      );
      expect(readStoredItems()).toHaveLength(0);
      expect(queue.getHealthSnapshot().state).toBe("saved");
    });

    it("keeps a newer enqueue when an older in-flight write succeeds", async () => {
      let resolveOld: (() => void) | undefined;
      let resolveNew: (() => void) | undefined;
      const handler = jest
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveOld = resolve;
            })
        )
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              resolveNew = resolve;
            })
        );
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", { value: "old" });
      await flushMicrotasks();
      expect(handler).toHaveBeenCalledTimes(1);

      await queue.enqueue("op", "id-1", { value: "new" });
      expect(readStoredItems()[0]).toMatchObject({
        payload: { value: "new" },
        version: 2,
      });

      resolveOld?.();
      await flushMicrotasks();
      expect(handler).toHaveBeenCalledTimes(2);
      expect(readStoredItems()[0]).toMatchObject({
        payload: { value: "new" },
        version: 2,
      });

      resolveNew?.();
      await queue.processQueue();
      expect(readStoredItems()).toHaveLength(0);
    });

    it("runs a manual dead-item retry requested during an active pass", async () => {
      storedQueue = JSON.stringify([
        createStoredItem({ id: "active", payload: { value: "active" } }),
        createStoredItem({
          id: "dead",
          payload: { value: "dead" },
          status: "dead",
          retryCount: 15,
          diagnosticReference: "SYNC-DEAD0001",
        }),
      ]);
      let resolveActive: (() => void) | undefined;
      const handler = jest.fn((payload: unknown) => {
        if ((payload as { value: string }).value === "active") {
          return new Promise<void>((resolve) => {
            resolveActive = resolve;
          });
        }
        return Promise.resolve();
      });

      await queue.hydrate();
      queue.registerHandler("op", handler);
      await flushMicrotasks();
      expect(handler).toHaveBeenCalledTimes(1);

      const retryPromise = queue.retryDeadItems();
      await flushMicrotasks();
      resolveActive?.();
      await retryPromise;

      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenLastCalledWith(
        { value: "dead" },
        expect.objectContaining({
          id: "dead",
          recoveryAttempts: 1,
        })
      );
      expect(readStoredItems()).toHaveLength(0);
    });

    it("increments retries without discarding the local item", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("network"));
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", { name: "test" });
      await queue.processQueue();

      expect(readStoredItems()[0]).toMatchObject({
        retryCount: 1,
        status: "pending",
      });
    });

    it("moves an exhausted item to the dead queue", async () => {
      storedQueue = JSON.stringify([
        createStoredItem({ retryCount: 14, nextRetryAt: 0 }),
      ]);
      const handler = jest.fn().mockRejectedValue(new Error("fail"));

      await queue.hydrate();
      queue.registerHandler("op", handler);
      await queue.processQueue();

      expect(readStoredItems()[0]).toMatchObject({
        status: "dead",
        retryCount: 15,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sync_failed",
        expect.objectContaining({
          diagnostic_reference: "SYNC-TEST0001",
          operation: "op",
        })
      );
    });
  });

  describe("retry scheduling", () => {
    it("automatically retries at nextRetryAt while active and online", async () => {
      jest.useFakeTimers({ now: 10_000 });
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(undefined);
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});
      await queue.processQueue();
      expect(handler).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1_999);
      expect(handler).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      await queue.processQueue();
      expect(handler).toHaveBeenCalledTimes(2);
      expect(queue.getHealthSnapshot().state).toBe("saved");
    });

    it("cancels scheduled retries in background and resumes on activation", async () => {
      jest.useFakeTimers({ now: 20_000 });
      const handler = jest
        .fn()
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(undefined);
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});
      await queue.processQueue();
      queue.setActive(false);

      await jest.advanceTimersByTimeAsync(2_000);
      expect(handler).toHaveBeenCalledTimes(1);

      queue.setActive(true);
      await queue.processQueue();
      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("caps automatic backoff at 60 seconds", async () => {
      jest.useFakeTimers({ now: 30_000 });
      storedQueue = JSON.stringify([
        createStoredItem({ retryCount: 10, nextRetryAt: 0 }),
      ]);
      queue.registerHandler(
        "op",
        jest.fn().mockRejectedValue(new Error("fail"))
      );

      await queue.processQueue();

      expect(readStoredItems()[0].nextRetryAt).toBe(90_000);
    });
  });

  describe("hydration and recovery", () => {
    it("hydrates pending work while offline without attempting cloud sync", async () => {
      storedQueue = JSON.stringify([
        createStoredItem({ payload: { workout: "safe" } }),
      ]);
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("op", handler);
      queue.setOnline(false);

      await queue.hydrate();

      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("sync-queue");
      expect(handler).not.toHaveBeenCalled();
      expect(queue.getHealthSnapshot()).toMatchObject({
        state: "offline",
        pendingCount: 1,
      });
    });

    it("preserves valid and dead legacy entries when a sibling is malformed", async () => {
      storedQueue = JSON.stringify([
        {
          id: "valid",
          operation: "op",
          payload: { safe: true },
          updatedAt: 1,
          retryCount: 0,
          nextRetryAt: 0,
          createdAt: 1,
          status: "pending",
        },
        { operation: "op", payload: { malformed: true } },
        {
          id: "dead",
          operation: "op",
          payload: { preserved: true },
          updatedAt: 1,
          retryCount: 15,
          nextRetryAt: 0,
          createdAt: 1,
          status: "dead",
        },
      ]);
      queue.setOnline(false);

      await queue.hydrate();

      expect(readStoredItems()).toHaveLength(2);
      expect(readStoredItems()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "valid",
            version: 1,
            recoveryAttempts: 0,
          }),
          expect.objectContaining({ id: "dead", status: "dead" }),
        ])
      );
      expect(await queue.getDeadItems()).toHaveLength(1);
      expect(mockTrackEvent).toHaveBeenCalledWith("sync_queue_items_dropped", {
        invalid_count: 1,
      });
      expect(console.warn).toHaveBeenCalledWith(
        "Dropped 1 invalid sync queue item(s)"
      );
    });

    it("offers support immediately when a user-requested retry fails", async () => {
      storedQueue = JSON.stringify([
        createStoredItem({ status: "dead", retryCount: 15 }),
      ]);
      queue.registerHandler(
        "op",
        jest.fn().mockRejectedValue(new Error("fail"))
      );

      await queue.retryDeadItems();

      expect(queue.getHealthSnapshot()).toEqual({
        state: "failed",
        pendingCount: 0,
        failedCount: 1,
        diagnosticReference: "SYNC-TEST0001",
        canContactSupport: true,
      });
    });

    it("reports recovery only after a user-requested retry succeeds", async () => {
      storedQueue = JSON.stringify([
        createStoredItem({ status: "dead", retryCount: 15 }),
      ]);
      queue.registerHandler("op", jest.fn().mockResolvedValue(undefined));

      await queue.retryDeadItems();

      expect(queue.getHealthSnapshot().state).toBe("recovered");
      expect(mockTrackEvent).toHaveBeenCalledWith(
        "sync_recovered",
        expect.objectContaining({
          diagnostic_reference: "SYNC-TEST0001",
          recovery_attempt: 1,
        })
      );
    });

    it("flushes local queue state and cancels future work", async () => {
      await queue.enqueue("unknown", "id-1", {});
      await queue.flush();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("sync-queue");
      expect(queue.getHealthSnapshot().state).toBe("saved");
    });
  });
});
