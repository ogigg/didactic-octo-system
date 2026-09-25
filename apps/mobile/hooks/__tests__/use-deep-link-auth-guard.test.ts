const mockDismissAll = jest.fn();
const mockReplace = jest.fn();
let mockSegments: string[];
let mockRootStack: string[];
let mockAuth: {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isPasswordRecovery: boolean;
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ dismissAll: mockDismissAll, replace: mockReplace }),
  useSegments: () => mockSegments,
  // Shaped like expo-router's root state: the root stack sits in `__root`.
  useRootNavigationState: () => ({
    routes: [
      {
        name: "__root",
        state: { routes: mockRootStack.map((name) => ({ name })) },
      },
    ],
  }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

import { renderHook } from "@testing-library/react-native";

import { useDeepLinkAuthGuard } from "../use-deep-link-auth-guard";

describe("useDeepLinkAuthGuard", () => {
  beforeEach(() => {
    mockDismissAll.mockClear();
    mockReplace.mockClear();
    mockSegments = ["workout-preview"];
    mockRootStack = ["(tabs)", "workout-preview"];
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
  ])(
    "pops the root stack for signed-out users on %s, leaving nothing below sign-in",
    (route) => {
      mockSegments = [route];
      mockRootStack = ["(tabs)", "account-settings", route];
      renderHook(() => useDeepLinkAuthGuard());

      expect(mockDismissAll).toHaveBeenCalledTimes(1);
      expect(mockReplace).not.toHaveBeenCalled();
    }
  );

  it("replaces a protected screen that is alone in the root stack", () => {
    mockRootStack = ["workout-preview"];
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockReplace).toHaveBeenCalledWith("/(auth)/sign-in");
    expect(mockDismissAll).not.toHaveBeenCalled();
  });

  it("waits until the root stack has rendered", () => {
    mockRootStack = [];
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("leaves signed-in users on the linked screen", () => {
    mockAuth.isAuthenticated = true;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("waits until auth has initialized", () => {
    mockAuth.isInitialized = false;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("does not interrupt password recovery", () => {
    mockAuth.isPasswordRecovery = true;
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each(["(auth)", "(tabs)", "(onboarding)", "auth-link-error"])(
    "leaves signed-out users on %s, which handles auth itself or is public",
    (route) => {
      mockSegments = [route];
      renderHook(() => useDeepLinkAuthGuard());

      expect(mockDismissAll).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
    }
  );

  it("leaves the index route to its own redirect", () => {
    mockSegments = [];
    renderHook(() => useDeepLinkAuthGuard());

    expect(mockDismissAll).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
