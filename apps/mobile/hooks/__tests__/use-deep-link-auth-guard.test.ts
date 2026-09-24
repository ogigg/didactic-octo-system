const mockDismissTo = jest.fn();
let mockSegments: string[];
let mockAuth: {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isPasswordRecovery: boolean;
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ dismissTo: mockDismissTo }),
  useSegments: () => mockSegments,
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

import { renderHook } from "@testing-library/react-native";

import { useDeepLinkAuthGuard } from "../use-deep-link-auth-guard";

describe("useDeepLinkAuthGuard", () => {
  beforeEach(() => {
    mockDismissTo.mockClear();
    mockSegments = ["workout-preview"];
    mockAuth = {
      isAuthenticated: false,
      isInitialized: true,
      isPasswordRecovery: false,
    };
  });

  it.each([
    "workout",
    "workout-preview",
    "history",
    "statistics",
    "workout-detail",
    "delete-account",
  ])("sends signed-out users from %s to sign-in", (route) => {
    mockSegments = [route];
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissTo).toHaveBeenCalledWith("/(auth)/sign-in");
  });

  it("leaves signed-in users on the linked screen", () => {
    mockAuth.isAuthenticated = true;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it("waits until auth has initialized", () => {
    mockAuth.isInitialized = false;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it("does not interrupt password recovery", () => {
    mockAuth.isPasswordRecovery = true;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissTo).not.toHaveBeenCalled();
  });

  it.each(["(auth)", "(tabs)", "(onboarding)", "auth-link-error"])(
    "leaves signed-out users on %s, which handles auth itself or is public",
    (route) => {
      mockSegments = [route];
      renderHook(() => useDeepLinkAuthGuard());

      expect(mockDismissTo).not.toHaveBeenCalled();
    }
  );

  it("leaves the index route to its own redirect", () => {
    mockSegments = [];
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissTo).not.toHaveBeenCalled();
  });
});
