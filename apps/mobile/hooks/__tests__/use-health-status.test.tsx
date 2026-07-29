const mockGetCurrentHealthPermissionStatus = jest.fn();
const mockRequestHealthPermissions = jest.fn();
const mockSetCachedPermissionStatus = jest.fn();

jest.mock("@/lib/health", () => ({
  getCurrentHealthPermissionStatus: () =>
    mockGetCurrentHealthPermissionStatus(),
  isHealthSyncAvailable: () => true,
  requestHealthPermissions: () => mockRequestHealthPermissions(),
  setCachedPermissionStatus: (...args: unknown[]) =>
    mockSetCachedPermissionStatus(...args),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert, AppState, Linking, Platform } from "react-native";
import type { AppStateStatus } from "react-native";

import { useHealthStatus } from "@/hooks/use-health-status";

describe("useHealthStatus", () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "ios",
    });
    mockGetCurrentHealthPermissionStatus.mockResolvedValue("not-requested");
  });

  afterAll(() => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: originalPlatform,
    });
  });

  it("refreshes native authorization when the app returns to the foreground", async () => {
    let appStateListener: ((state: AppStateStatus) => void) | undefined;
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_event, listener) => {
        appStateListener = listener;
        return { remove: jest.fn() };
      });

    const { result } = renderHook(() => useHealthStatus());

    await waitFor(() => {
      expect(result.current.status).toBe("not-requested");
    });

    mockGetCurrentHealthPermissionStatus.mockResolvedValueOnce("denied");
    await act(async () => {
      appStateListener?.("active");
    });

    await waitFor(() => {
      expect(result.current.status).toBe("denied");
    });
    expect(mockGetCurrentHealthPermissionStatus).toHaveBeenCalledTimes(2);
  });

  it("shows precise Health-app recovery instructions instead of app settings", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    const settingsSpy = jest
      .spyOn(Linking, "openSettings")
      .mockResolvedValue(undefined);
    const { result } = renderHook(() => useHealthStatus());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.openSettings();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "settings.recoveryTitle",
      "settings.recoveryInstructions",
      [{ text: "settings.recoveryDismiss" }]
    );
    expect(settingsSpy).not.toHaveBeenCalled();
  });
});
