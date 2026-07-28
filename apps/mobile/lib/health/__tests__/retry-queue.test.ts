import AsyncStorage from "@react-native-async-storage/async-storage";

import { cancelRetry, drainQueue, enqueueRetry } from "../retry-queue";

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("health retry queue", () => {
  it("cancels only the retry belonging to a deleted workout", async () => {
    await enqueueRetry("deleted-session", {
      startedAt: new Date("2026-07-28T10:00:00.000Z"),
      endedAt: new Date("2026-07-28T11:00:00.000Z"),
      type: "strength",
    });
    await enqueueRetry("retained-session", {
      startedAt: new Date("2026-07-27T10:00:00.000Z"),
      endedAt: new Date("2026-07-27T11:00:00.000Z"),
      type: "strength",
    });

    await cancelRetry("deleted-session");

    const remaining = await drainQueue();
    expect(remaining.map((entry) => entry.sessionId)).toEqual([
      "retained-session",
    ]);
  });
});
