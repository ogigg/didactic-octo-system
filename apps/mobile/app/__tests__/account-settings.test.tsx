const mockNavigate = jest.fn();
const mockOpenSubscriptionManagement = jest.fn(() =>
  Promise.resolve("https://apps.apple.com/account/subscriptions")
);
const mockGetUser = jest.fn();
let mockIsProActive = false;
let mockRefocus: (() => void) | undefined;

jest.mock("expo-router", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const { useEffect } = jest.requireActual<typeof import("react")>("react");
    mockRefocus = () => void effect();
    useEffect(effect, [effect]);
  },
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
    t: (key: string, options?: { email?: string }) =>
      (
        ({
          "accessibility.back": "Go back",
          "deletion.accessibilityLabel": "Delete account, destructive action",
        }) as Record<string, string>
      )[key] ?? (options?.email ? `${key}: ${options.email}` : key),
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
  within,
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
        screen.getByRole("button", { name: /^password\.changeLabel/ })
      ).toBeTruthy()
    );
    fireEvent.press(
      screen.getByRole("button", { name: /^password\.changeLabel/ })
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
      await screen.findByRole("button", { name: /^password\.setLabel/ })
    ).toBeTruthy();
    expect(screen.getByText("signIn.status.notSetUp")).toBeTruthy();
  });

  it("shows the account email and every linked sign-in method", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email: "anna@example.com",
          identities: [
            { provider: "email", last_sign_in_at: "2026-09-24T10:00:00Z" },
            { provider: "google", last_sign_in_at: "2026-09-01T10:00:00Z" },
          ],
        },
      },
      error: null,
    });
    render(<AccountSettingsScreen />);

    expect(
      await screen.findByText("signIn.signedInAs: anna@example.com")
    ).toBeTruthy();
    expect(screen.getByText("signIn.providers.google")).toBeTruthy();
    expect(screen.getByText("signIn.status.linked")).toBeTruthy();
    expect(screen.queryByText("signIn.providers.apple")).toBeNull();

    const passwordRow = screen.getByRole("button", {
      name: "password.changeLabel, signIn.providers.email, signIn.status.lastUsed",
    });
    expect(
      within(passwordRow).getByText("signIn.status.lastUsed")
    ).toBeTruthy();
  });

  it("refreshes the sign-in methods when the screen regains focus", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { identities: [{ provider: "apple" }] } },
      error: null,
    });
    render(<AccountSettingsScreen />);
    expect(
      await screen.findByRole("button", { name: /^password\.setLabel/ })
    ).toBeTruthy();

    mockGetUser.mockResolvedValue({
      data: {
        user: { identities: [{ provider: "apple" }, { provider: "email" }] },
      },
      error: null,
    });
    await act(async () => mockRefocus?.());

    expect(
      await screen.findByRole("button", { name: /^password\.changeLabel/ })
    ).toBeTruthy();
  });

  it("labels an Apple hidden email instead of showing only the relay address", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email: "x7k2p9@privaterelay.appleid.com",
          identities: [{ provider: "apple" }],
        },
      },
      error: null,
    });
    render(<AccountSettingsScreen />);

    expect(
      await screen.findByText(
        "signIn.signedInAsHiddenApple: x7k2p9@privaterelay.appleid.com"
      )
    ).toBeTruthy();
    expect(screen.getByText("signIn.providers.apple")).toBeTruthy();
    expect(screen.queryByText("signIn.status.lastUsed")).toBeNull();
  });

  it("hides the email and methods while the account is still loading", async () => {
    mockGetUser.mockReturnValue(new Promise(() => {}));
    render(<AccountSettingsScreen />);

    await act(async () => {});

    expect(screen.getByRole("button", { name: "password.label" })).toBeTruthy();
    expect(screen.queryByText(/signIn\./)).toBeNull();
  });

  it.each([
    [
      "returns an error",
      () =>
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: new Error("offline"),
        }),
    ],
    ["rejects", () => mockGetUser.mockRejectedValue(new Error("offline"))],
  ])(
    "keeps a neutral password row when loading the account %s",
    async (_case, arrange) => {
      arrange();
      render(<AccountSettingsScreen />);

      await act(async () => {});

      fireEvent.press(screen.getByRole("button", { name: "password.label" }));
      expect(mockNavigate).toHaveBeenCalledWith("/change-password");
      expect(screen.queryByText(/signIn\./)).toBeNull();
    }
  );

  it("keeps subscription management separate from account deletion", () => {
    render(<AccountSettingsScreen />);

    fireEvent.press(screen.getByRole("button", { name: "subscription.label" }));
    expect(mockNavigate).toHaveBeenCalledWith("/subscription");

    expect(screen.getByText("difference.body")).toBeTruthy();
  });

  it("opens workout history export", () => {
    render(<AccountSettingsScreen />);

    fireEvent.press(screen.getByRole("button", { name: "export.label" }));

    expect(mockNavigate).toHaveBeenCalledWith("/export-history");
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
