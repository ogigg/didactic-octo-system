import {
  getMissingQueueCount,
  getTargetQueueCount,
} from "../pending-workout-queue";

describe("pending workout queue helpers", () => {
  it("derives the target queue count from weekly frequency", () => {
    expect(getTargetQueueCount(null)).toBe(3);
    expect(getTargetQueueCount("2")).toBe(2);
    expect(getTargetQueueCount("4")).toBe(4);
    expect(getTargetQueueCount("5_plus")).toBe(5);
    expect(getTargetQueueCount("unexpected")).toBe(3);
  });

  it("calculates how many workouts need to be replenished", () => {
    expect(getMissingQueueCount(2, 3)).toBe(1);
    expect(getMissingQueueCount(0, 5)).toBe(5);
    expect(getMissingQueueCount(3, 3)).toBe(0);
    expect(getMissingQueueCount(6, 3)).toBe(0);
  });
});
