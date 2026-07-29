import { createMeasurementSyncIdentity } from "../sync-identities";

describe("createMeasurementSyncIdentity", () => {
  it("keeps measurements from different dates as separate queued writes", () => {
    const first = createMeasurementSyncIdentity("user-1", {
      loggedAt: "2026-07-01T08:00:00.000Z",
    });
    const second = createMeasurementSyncIdentity("user-1", {
      loggedAt: "2026-07-02T08:00:00.000Z",
    });

    expect(first).not.toBe(second);
  });

  it("coalesces successive edits to the same original measurement", () => {
    const firstEdit = createMeasurementSyncIdentity("user-1", {
      loggedAt: "2026-07-03T08:00:00.000Z",
      originalLoggedAt: "2026-07-01T08:00:00.000Z",
    });
    const secondEdit = createMeasurementSyncIdentity("user-1", {
      loggedAt: "2026-07-04T08:00:00.000Z",
      originalLoggedAt: "2026-07-01T08:00:00.000Z",
    });

    expect(firstEdit).toBe(secondEdit);
  });

  it("keeps different users isolated", () => {
    const first = createMeasurementSyncIdentity("user-1", {
      loggedAt: "2026-07-01T08:00:00.000Z",
    });
    const second = createMeasurementSyncIdentity("user-2", {
      loggedAt: "2026-07-01T08:00:00.000Z",
    });

    expect(first).not.toBe(second);
  });
});
