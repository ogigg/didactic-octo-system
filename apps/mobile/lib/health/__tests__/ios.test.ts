const mockIsAvailable = jest.fn();
const mockGetAuthStatus = jest.fn();
const mockInitHealthKit = jest.fn();

jest.mock("react-native-health", () => ({
  __esModule: true,
  default: {
    Constants: {
      Permissions: {
        HeartRate: "HeartRate",
        Workout: "Workout",
      },
      Activities: {
        TraditionalStrengthTraining: "TraditionalStrengthTraining",
      },
      Units: {
        bpm: "bpm",
      },
    },
    isAvailable: (...args: unknown[]) => mockIsAvailable(...args),
    getAuthStatus: (...args: unknown[]) => mockGetAuthStatus(...args),
    initHealthKit: (...args: unknown[]) => mockInitHealthKit(...args),
  },
}));

import {
  getPermissionStatusIOS,
  requestPermissionsIOS,
} from "@/lib/health/ios";

interface AvailabilityCallback {
  (error: object | null, available: boolean): void;
}

interface AuthorizationCallback {
  (
    error: string | null,
    result: { permissions: { read: number[]; write: number[] } }
  ): void;
}

describe("Apple Health authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAvailable.mockImplementation((callback: AvailabilityCallback) => {
      callback(null, true);
    });
  });

  it("returns unavailable without querying authorization on unsupported devices", async () => {
    mockIsAvailable.mockImplementation((callback: AvailabilityCallback) => {
      callback(null, false);
    });

    await expect(getPermissionStatusIOS()).resolves.toBe("unavailable");
    expect(mockGetAuthStatus).not.toHaveBeenCalled();
  });

  it.each([
    [0, "not-requested"],
    [1, "denied"],
    [2, "granted"],
  ] as const)("maps native write status %s to %s", async (code, expected) => {
    mockGetAuthStatus.mockImplementation(
      (_permissions: unknown, callback: AuthorizationCallback) => {
        callback(null, { permissions: { read: [2], write: [code] } });
      }
    );

    await expect(getPermissionStatusIOS()).resolves.toBe(expected);
  });

  it("reports a managed-device HealthKit restriction", async () => {
    mockGetAuthStatus.mockImplementation(
      (_permissions: unknown, callback: AuthorizationCallback) => {
        callback("Error with HealthKit authorization: health data restricted", {
          permissions: { read: [], write: [] },
        });
      }
    );

    await expect(getPermissionStatusIOS()).resolves.toBe("restricted");
  });

  it("requests native access and then returns the resulting authorization", async () => {
    mockInitHealthKit.mockImplementation(
      (_permissions: unknown, callback: (error: string | null) => void) => {
        callback(null);
      }
    );
    mockGetAuthStatus.mockImplementation(
      (_permissions: unknown, callback: AuthorizationCallback) => {
        callback(null, { permissions: { read: [2], write: [1] } });
      }
    );

    await expect(requestPermissionsIOS()).resolves.toBe("denied");
    expect(mockInitHealthKit).toHaveBeenCalledTimes(1);
    expect(mockGetAuthStatus).toHaveBeenCalledTimes(1);
  });
});
