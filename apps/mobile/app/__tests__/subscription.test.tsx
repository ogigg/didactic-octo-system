const mockOpenSubscriptionManagement = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    back: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      key === "screen.backAccessibilityLabel" ? "Go back" : key,
  }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/hooks/use-subscription", () => ({
  useSubscription: () => ({
    tier: "pro",
    isProActive: true,
    weeklyUsage: 0,
    weeklyLimit: Infinity,
    isLoading: false,
  }),
}));

jest.mock("@/lib/subscription-management", () => ({
  openSubscriptionManagement: () => mockOpenSubscriptionManagement(),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import SubscriptionScreen from "../subscription";

const alertSpy = jest.spyOn(Alert, "alert");

describe("SubscriptionScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenSubscriptionManagement.mockResolvedValue(
      "https://apps.apple.com/account/subscriptions"
    );
  });

  it("offers active subscribers actionable store management", async () => {
    render(<SubscriptionScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "screen.management.accessibilityLabel",
      })
    );

    await waitFor(() =>
      expect(mockOpenSubscriptionManagement).toHaveBeenCalledTimes(1)
    );
  });

  it("shows a localized error when store management cannot open", async () => {
    mockOpenSubscriptionManagement.mockRejectedValue(new Error("unavailable"));
    render(<SubscriptionScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "screen.management.accessibilityLabel",
      })
    );

    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith(
        "screen.management.errorTitle",
        "screen.management.errorMessage"
      )
    );
  });

  it("uses a localized back accessibility label", () => {
    render(<SubscriptionScreen />);
    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
  });
});
