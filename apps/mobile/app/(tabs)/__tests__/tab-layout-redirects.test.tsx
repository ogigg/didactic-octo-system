const mockRedirects: string[] = [];
let mockAuth: {
  isAuthenticated: boolean;
  isInitialized: boolean;
  profileStatus: "loading" | "ready" | "error";
  isPasswordRecovery: boolean;
};

jest.mock("expo-router", () => ({
  Redirect: ({ href }: { href: string }) => {
    mockRedirects.push(href);
    return null;
  },
}));

jest.mock("expo-router/unstable-native-tabs", () => {
  const Stub = ({ children }: { children?: unknown }) => children ?? null;
  const NativeTabs = Object.assign(Stub, { Trigger: Stub });
  return { NativeTabs, Icon: Stub, Label: Stub, VectorIcon: Stub };
});

jest.mock("@expo/vector-icons/MaterialIcons", () => () => null);

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: (
    select: (s: {
      isCompleted: boolean;
      getNextUnfinishedStep: () => string | null;
    }) => unknown
  ) => select({ isCompleted: true, getNextUnfinishedStep: () => null }),
}));

jest.mock("@/components/auth/profile-gate", () => ({
  ProfileGate: () => null,
}));

import { render } from "@testing-library/react-native";

import TabLayout from "../_layout";

describe("tab layout redirects", () => {
  beforeEach(() => {
    mockRedirects.length = 0;
    mockAuth = {
      isAuthenticated: true,
      isInitialized: true,
      profileStatus: "ready",
      isPasswordRecovery: false,
    };
  });

  it("sends password recovery to reset-password before the profile has loaded", () => {
    // The index route pops back to this layout on a cold start, so it has to
    // route recovery as early as index did.
    mockAuth = {
      ...mockAuth,
      profileStatus: "loading",
      isPasswordRecovery: true,
    };
    render(<TabLayout />);

    expect(mockRedirects).toEqual(["/(auth)/reset-password"]);
  });

  it("sends signed-out users to sign-in", () => {
    mockAuth.isAuthenticated = false;
    render(<TabLayout />);

    expect(mockRedirects).toEqual(["/(auth)/sign-in"]);
  });
});
