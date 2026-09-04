const mockWriteWorkoutIOS = jest.fn();
const mockUpdateWorkoutSession = jest.fn();

jest.mock("@/lib/health/ios", () => ({
  writeWorkoutIOS: (...args: unknown[]) => mockWriteWorkoutIOS(...args),
}));

jest.mock("@/lib/api/workouts", () => ({
  updateWorkoutSession: (...args: unknown[]) =>
    mockUpdateWorkoutSession(...args),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  isHealthSyncEnabled,
  setCachedPermissionStatus,
  setHealthSyncEnabled,
  syncWorkoutToHealth,
} from "@/lib/health";

const payload = {
  startedAt: new Date("2026-07-29T10:00:00.000Z"),
  endedAt: new Date("2026-07-29T11:00:00.000Z"),
  type: "strength" as const,
};

describe("Health sync preference", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    await setCachedPermissionStatus("granted");
    mockWriteWorkoutIOS.mockResolvedValue({
      ok: true,
      externalId: "health-workout-1",
    });
  });

  it("suppresses workout sync after disconnect even while HealthKit stays granted", async () => {
    await setHealthSyncEnabled(false);

    await syncWorkoutToHealth("session-1", payload);

    expect(mockWriteWorkoutIOS).not.toHaveBeenCalled();
    expect(mockUpdateWorkoutSession).not.toHaveBeenCalled();
  });

  it("restores the sync preference after explicit reconnect", async () => {
    await setHealthSyncEnabled(false);
    await setHealthSyncEnabled(true);

    await expect(isHealthSyncEnabled()).resolves.toBe(true);
  });
});
