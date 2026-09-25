const mockReplace = jest.fn();
const mockDispatch = jest.fn();
let mockCanGoBack: boolean;
let mockAuth: {
  isAuthenticated: boolean;
  isInitialized: boolean;
  profileStatus: "loading" | "ready" | "error";
  isPasswordRecovery: boolean;
};
let mockOnboarding: {
  isCompleted: boolean;
  getNextUnfinishedStep: () => string | null;
};

jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useFocusEffect: (effect: () => void) => {
    const { useEffect } = jest.requireActual<typeof import("react")>("react");
    useEffect(effect, [effect]);
  },
}));

jest.mock("@react-navigation/native", () => ({
  StackActions: { popToTop: () => ({ type: "POP_TO_TOP" }) },
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    dispatch: mockDispatch,
  }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: () => mockOnboarding,
}));

jest.mock("@/components/auth/profile-gate", () => ({
  ProfileGate: () => null,
}));

import { render } from "@testing-library/react-native";

import Index from "../index";

describe("index route", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockDispatch.mockClear();
    mockCanGoBack = true;
    mockAuth = {
      isAuthenticated: true,
      isInitialized: true,
      profileStatus: "ready",
      isPasswordRecovery: false,
    };
    mockOnboarding = {
      isCompleted: true,
      getNextUnfinishedStep: () => null,
    };
  });

  it("pops back to the (tabs) anchor on a cold start instead of stacking a second home", () => {
    render(<Index />);

    expect(mockDispatch).toHaveBeenCalledWith({ type: "POP_TO_TOP" });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("also pops for signed-out users, so sign-in has nothing below it", () => {
    mockAuth.isAuthenticated = false;
    render(<Index />);

    expect(mockDispatch).toHaveBeenCalledWith({ type: "POP_TO_TOP" });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it.each<[string, () => void, string]>([
    ["a signed-in user", () => {}, "/(tabs)"],
    [
      "a signed-out user",
      () => {
        mockAuth.isAuthenticated = false;
      },
      "/(auth)/sign-in",
    ],
    [
      "unfinished onboarding",
      () => {
        mockOnboarding = {
          isCompleted: false,
          getNextUnfinishedStep: () => "goals",
        };
      },
      "/(onboarding)/goals",
    ],
    [
      "password recovery",
      () => {
        mockAuth.isPasswordRecovery = true;
      },
      "/(auth)/reset-password",
    ],
  ])(
    "replaces index for %s when nothing is below it",
    (_label, arrange, href) => {
      mockCanGoBack = false;
      arrange();
      render(<Index />);

      expect(mockReplace).toHaveBeenCalledWith(href);
      expect(mockDispatch).not.toHaveBeenCalled();
    }
  );

  it("waits while auth is still initializing", () => {
    mockAuth = { ...mockAuth, isAuthenticated: false, isInitialized: false };
    render(<Index />);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("waits on the profile gate while a signed-in profile loads", () => {
    mockAuth.profileStatus = "loading";
    render(<Index />);

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
