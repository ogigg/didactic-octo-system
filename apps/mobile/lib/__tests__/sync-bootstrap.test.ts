import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { bootstrapSyncQueue } from "../sync-bootstrap";
import { SyncQueue } from "../sync-queue";

jest.mock("@/lib/track-event", () => ({
  trackEvent: jest.fn(),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));
jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: {
    fetch: jest.fn(),
  },
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockNetInfo = NetInfo as jest.Mocked<typeof NetInfo>;

describe("bootstrapSyncQueue", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("hydrates AsyncStorage on a cold offline launch and surfaces device-only state", async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify([
        {
          id: "session-1",
          operation: "save_workout",
          payload: { locallyPreserved: true },
          updatedAt: 1,
          retryCount: 0,
          nextRetryAt: 0,
          createdAt: 1,
          status: "pending",
        },
      ])
    );
    mockNetInfo.fetch.mockResolvedValueOnce({
      isConnected: false,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    const queue = new SyncQueue();
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.registerHandler("save_workout", handler);

    await bootstrapSyncQueue({ queue });

    expect(mockNetInfo.fetch).toHaveBeenCalledTimes(1);
    expect(mockAsyncStorage.getItem).toHaveBeenCalledWith("sync-queue");
    expect(handler).not.toHaveBeenCalled();
    expect(queue.getHealthSnapshot()).toMatchObject({
      state: "offline",
      pendingCount: 1,
    });
    queue.setActive(false);
  });

  it("drains hydrated work immediately on a cold online launch", async () => {
    mockAsyncStorage.getItem.mockResolvedValueOnce(
      JSON.stringify([
        {
          id: "session-1",
          operation: "save_workout",
          payload: { locallyPreserved: true },
          updatedAt: 1,
          retryCount: 0,
          nextRetryAt: 0,
          createdAt: 1,
          status: "pending",
        },
      ])
    );
    mockNetInfo.fetch.mockResolvedValueOnce({
      isConnected: true,
    } as Awaited<ReturnType<typeof NetInfo.fetch>>);
    const queue = new SyncQueue();
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.registerHandler("save_workout", handler);

    await bootstrapSyncQueue({ queue });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(queue.getHealthSnapshot().state).toBe("saved");
    queue.setActive(false);
  });
});
