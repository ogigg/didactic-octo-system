import AsyncStorage from "@react-native-async-storage/async-storage";

import { SyncQueue } from "../sync-queue";

const mockReportHandledOperationalError = jest.fn();
const mockReportOperationalMetric = jest.fn();

jest.mock("@/lib/operational-observability", () => ({
  reportHandledOperationalError: (...args: unknown[]) =>
    mockReportHandledOperationalError(...args),
  reportOperationalMetric: (...args: unknown[]) =>
    mockReportOperationalMetric(...args),
}));

// Mock AsyncStorage
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe("SyncQueue", () => {
  let queue: SyncQueue;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAsyncStorage.getItem.mockResolvedValue(null);
    mockAsyncStorage.setItem.mockResolvedValue(undefined);
    queue = new SyncQueue();
  });

  describe("enqueue()", () => {
    it("adds an item and persists to AsyncStorage", async () => {
      await queue.enqueue("upsert_profile", "user-1", { name: "test" });

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "sync-queue",
        expect.any(String)
      );

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({
        id: "user-1",
        operation: "upsert_profile",
        payload: { name: "test" },
        status: "pending",
        retryCount: 0,
      });
    });

    it("deduplicates by id + operation using last-write-wins", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      await queue.enqueue("upsert_profile", "user-1", { v: "old" });

      jest.spyOn(Date, "now").mockReturnValueOnce(now + 1000);
      await queue.enqueue("upsert_profile", "user-1", { v: "new" });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].payload).toEqual({ v: "new" });
    });

    it("keeps the existing item if it has a later updatedAt", async () => {
      const now = Date.now();
      jest.spyOn(Date, "now").mockReturnValueOnce(now + 1000);
      await queue.enqueue("upsert_profile", "user-1", { v: "first" });

      jest.spyOn(Date, "now").mockReturnValueOnce(now);
      await queue.enqueue("upsert_profile", "user-1", { v: "stale" });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(1);
      expect(stored[0].payload).toEqual({ v: "first" });
    });

    it("allows different operations for the same id", async () => {
      await queue.enqueue("upsert_profile", "user-1", { a: 1 });
      await queue.enqueue("delete_profile", "user-1", { b: 2 });

      const stored = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[1][1] as string
      );
      expect(stored).toHaveLength(2);
    });
  });

  describe("processQueue()", () => {
    it("calls the registered handler and removes item on success", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("upsert_profile", handler);

      await queue.enqueue("upsert_profile", "user-1", { name: "test" });
      await queue.processQueue();

      expect(handler).toHaveBeenCalledWith({ name: "test" });
      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored).toHaveLength(0);
    });

    it("increments retryCount and computes backoff on failure", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("network"));
      queue.registerHandler("upsert_profile", handler);

      await queue.enqueue("upsert_profile", "user-1", { name: "test" });
      await queue.processQueue();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored).toHaveLength(1);
      expect(stored[0].retryCount).toBe(1);
      expect(stored[0].status).toBe("pending");
      expect(mockReportHandledOperationalError).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCode: "sync_delivery_failed",
          operation: "upsert_profile",
          retryCount: 1,
        })
      );
    });

    it("moves item to dead status after 15 retries", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("fail"));
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});

      for (let i = 0; i < 15; i++) {
        const lastSetCall =
          mockAsyncStorage.setItem.mock.calls[
            mockAsyncStorage.setItem.mock.calls.length - 1
          ];
        const items = JSON.parse(lastSetCall[1] as string);
        items[0].nextRetryAt = 0;
        mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));
        queue = new SyncQueue();
        queue.registerHandler("op", handler);
        await queue.processQueue();
      }

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored[0].status).toBe("dead");
      expect(stored[0].retryCount).toBe(15);
      expect(mockReportHandledOperationalError).toHaveBeenCalledWith(
        expect.objectContaining({
          failureCode: "sync_dead_letter",
          operation: "op",
          retryCount: 15,
        })
      );
    });

    it("reports recovery after a retried item succeeds", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      const item = {
        id: "id-1",
        operation: "save_workout",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 2,
        nextRetryAt: 0,
        createdAt: Date.now() - 5_000,
        status: "pending",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([item]));
      queue = new SyncQueue();
      queue.registerHandler("save_workout", handler);

      await queue.processQueue();

      expect(mockReportOperationalMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          operation: "save_workout",
          outcome: "recovered",
          retryCount: 2,
        })
      );
    });

    it("skips items whose nextRetryAt is in the future", async () => {
      const handler = jest.fn().mockResolvedValue(undefined);
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});
      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const items = JSON.parse(lastCall[1] as string);
      items[0].nextRetryAt = Date.now() + 999999;
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(items));
      queue = new SyncQueue();
      queue.registerHandler("op", handler);

      await queue.processQueue();

      expect(handler).not.toHaveBeenCalled();
    });

    it("skips items with no registered handler", async () => {
      await queue.enqueue("unknown_op", "id-1", {});
      await queue.processQueue();
    });

    it("prevents concurrent processQueue calls", async () => {
      let resolveHandler: () => void;
      const handler = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveHandler = resolve;
          })
      );
      queue.registerHandler("op", handler);

      await queue.enqueue("op", "id-1", {});

      const p1 = queue.processQueue();
      const p2 = queue.processQueue();

      resolveHandler!();
      await Promise.all([p1, p2]);

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("flush()", () => {
    it("clears all items from storage", async () => {
      await queue.enqueue("op", "id-1", {});
      await queue.flush();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith("sync-queue");
    });
  });

  describe("getDeadItems()", () => {
    it("returns only dead items", async () => {
      const deadItem = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 15,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "dead",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify([deadItem])
      );
      queue = new SyncQueue();

      const dead = await queue.getDeadItems();
      expect(dead).toHaveLength(1);
      expect(dead[0].status).toBe("dead");
    });
  });

  describe("retryDeadItems()", () => {
    it("resets dead items to pending with retryCount 0", async () => {
      const deadItem = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 15,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "dead",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(
        JSON.stringify([deadItem])
      );
      queue = new SyncQueue();

      await queue.retryDeadItems();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored[0].status).toBe("pending");
      expect(stored[0].retryCount).toBe(0);
      expect(stored[0].nextRetryAt).toBe(0);
    });
  });

  describe("backoff calculation", () => {
    it("caps backoff at 60 seconds", async () => {
      const handler = jest.fn().mockRejectedValue(new Error("fail"));
      queue.registerHandler("op", handler);

      const item = {
        id: "id-1",
        operation: "op",
        payload: {},
        updatedAt: Date.now(),
        retryCount: 10,
        nextRetryAt: 0,
        createdAt: Date.now(),
        status: "pending",
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify([item]));
      queue = new SyncQueue();
      queue.registerHandler("op", handler);

      const before = Date.now();
      await queue.processQueue();

      const lastCall =
        mockAsyncStorage.setItem.mock.calls[
          mockAsyncStorage.setItem.mock.calls.length - 1
        ];
      const stored = JSON.parse(lastCall[1] as string);
      expect(stored[0].nextRetryAt).toBeLessThanOrEqual(before + 60001);
      expect(stored[0].retryCount).toBe(11);
    });
  });
});
