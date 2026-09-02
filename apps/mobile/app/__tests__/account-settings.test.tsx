const mockNavigate = jest.fn();
const mockOpenSubscriptionManagement = jest.fn(() =>
  Promise.resolve("https://apps.apple.com/account/subscriptions")
);
const mockGetUser = jest.fn();
let mockIsProActive = false;

jest.mock("expo-router", () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    back: jest.fn(),
  }),
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      (
        ({
          "accessibility.back": "Go back",
          "deletion.accessibilityLabel": "Delete account, destructive action",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/hooks/use-subscription", () => ({
  useSubscription: () => ({
    isProActive: mockIsProActive,
  }),
}));

jest.mock("@/lib/subscription-management", () => ({
  openSubscriptionManagement: () => mockOpenSubscriptionManagement(),
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
  },
}));

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import AccountSettingsScreen from "../account-settings";

const alertSpy = jest.spyOn(Alert, "alert");

describe("AccountSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsProActive = false;
    mockOpenSubscriptionManagement.mockResolvedValue(
      "https://apps.apple.com/account/subscriptions"
    );
    mockGetUser.mockResolvedValue({
      data: {
        user: { identities: [{ provider: "email" }] },
      },
      error: null,
    });
  });

  it("opens password management with the account's current action", async () => {
    render(<AccountSettingsScreen />);

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "password.changeLabel" })
      ).toBeTruthy()
    );
    fireEvent.press(
      screen.getByRole("button", { name: "password.changeLabel" })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/change-password");
  });

  it("offers to set a password for an OAuth-only account", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { identities: [{ provider: "apple" }] } },
      error: null,
    });
    render(<AccountSettingsScreen />);

    expect(
      await screen.findByRole("button", { name: "password.setLabel" })
    ).toBeTruthy();
  });

  it("keeps subscription management separate from account deletion", () => {
    render(<AccountSettingsScreen />);

    fireEvent.press(screen.getByRole("button", { name: "subscription.label" }));
    expect(mockNavigate).toHaveBeenCalledWith("/subscription");

    expect(screen.getByText("difference.body")).toBeTruthy();
  });

  it("identifies deletion as destructive and requires a secondary navigation step", () => {
    render(<AccountSettingsScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Delete account, destructive action",
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/delete-account");
  });

  it("localizes the back button accessibility label", () => {
    render(<AccountSettingsScreen />);

    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
  });

  it("warns active subscribers before deletion and offers store management", async () => {
    mockIsProActive = true;
    render(<AccountSettingsScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Delete account, destructive action",
      })
    );

    expect(mockNavigate).not.toHaveBeenCalledWith("/delete-account");
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as {
      text: string;
      style?: string;
      onPress?: () => void;
    }[];

    buttons.find((button) => button.style === "cancel")?.onPress?.();
    expect(mockNavigate).not.toHaveBeenCalledWith("/delete-account");

    await act(async () => {
      buttons
        .find((button) => button.text === "deletion.subscriptionWarning.manage")
        ?.onPress?.();
    });
    expect(mockOpenSubscriptionManagement).toHaveBeenCalledTimes(1);

    buttons.find((button) => button.style === "destructive")?.onPress?.();
    expect(mockNavigate).toHaveBeenCalledWith("/delete-account");
  });

  it("shows a localized error when pre-deletion store management fails", async () => {
    mockIsProActive = true;
    mockOpenSubscriptionManagement.mockRejectedValue(new Error("unavailable"));
    render(<AccountSettingsScreen />);

    fireEvent.press(
      screen.getByRole("button", {
        name: "Delete account, destructive action",
      })
    );
    const buttons = alertSpy.mock.calls.at(-1)?.[2] as {
      text: string;
      onPress?: () => void;
    }[];

    await act(async () => {
      buttons
        .find((button) => button.text === "deletion.subscriptionWarning.manage")
        ?.onPress?.();
    });

    await waitFor(() =>
      expect(alertSpy).toHaveBeenLastCalledWith(
        "subscription.errorTitle",
        "subscription.errorMessage"
      )
    );
  });
});
