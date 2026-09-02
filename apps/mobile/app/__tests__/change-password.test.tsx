const mockReplace = jest.fn();
const mockRedirect = jest.fn((_props: unknown) => null);
const mockGetUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockReauthenticate = jest.fn();
const mockSignInWithIdToken = jest.fn();
const mockAppleSignIn = jest.fn();
const mockShowSuccess = jest.fn();

let mockAuth = { isAuthenticated: true, isInitialized: true };

jest.mock("expo-router", () => ({
  Redirect: (props: unknown) => mockRedirect(props),
  useRouter: () => ({ replace: mockReplace }),
  useNavigation: () => ({ goBack: jest.fn() }),
}));

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { EMAIL: 0 },
  signInAsync: () => mockAppleSignIn(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock("@/hooks/use-auth", () => ({
  useAuth: () => mockAuth,
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser(),
      reauthenticate: () => mockReauthenticate(),
      signInWithIdToken: (attributes: unknown) =>
        mockSignInWithIdToken(attributes),
      updateUser: (attributes: unknown) => mockUpdateUser(attributes),
    },
  },
}));

jest.mock("@/stores/toast-store", () => ({
  useToastStore: (selector: (state: unknown) => unknown) =>
    selector({ showSuccess: mockShowSuccess }),
}));

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import ChangePasswordScreen from "../change-password";

function userWith(providers: string[]) {
  return {
    email: "relay@privaterelay.appleid.com",
    id: "user-1",
    identities: providers.map((provider) => ({ provider })),
  };
}

async function renderLoaded(providers: string[]) {
  mockGetUser.mockResolvedValue({
    data: { user: userWith(providers) },
    error: null,
  });
  render(<ChangePasswordScreen />);
  await screen.findByText("relay@privaterelay.appleid.com");
}

function enterValidPassword() {
  fireEvent.changeText(
    screen.getByLabelText("password.newPasswordLabel"),
    "strong-password-123"
  );
  fireEvent.changeText(
    screen.getByLabelText("password.confirmPasswordLabel"),
    "strong-password-123"
  );
}

describe("ChangePasswordScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth = { isAuthenticated: true, isInitialized: true };
    mockUpdateUser.mockResolvedValue({
      data: { user: userWith(["apple"]) },
      error: null,
    });
    mockReauthenticate.mockResolvedValue({ error: null });
  });

  it("sets a password on the existing Apple account", async () => {
    await renderLoaded(["apple"]);

    expect(screen.getByText("password.setTitle")).toBeTruthy();
    expect(screen.getByText("password.appleNote")).toBeTruthy();
    enterValidPassword();
    fireEvent.press(screen.getByRole("button", { name: "password.setButton" }));

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenCalledWith({
        password: "strong-password-123",
      })
    );
    expect(mockShowSuccess).toHaveBeenCalledWith("password.successSet");
    expect(mockReplace).toHaveBeenCalledWith("/account-settings");
  });

  it("changes a password account and rejects mismatched confirmation", async () => {
    await renderLoaded(["email"]);

    expect(screen.getByText("password.changeTitle")).toBeTruthy();
    fireEvent.changeText(
      screen.getByLabelText("password.newPasswordLabel"),
      "strong-password-123"
    );
    fireEvent.changeText(
      screen.getByLabelText("password.confirmPasswordLabel"),
      "different-password"
    );
    fireEvent.press(
      screen.getByRole("button", { name: "password.changeButton" })
    );

    expect(await screen.findByText("errors.passwordsMustMatch")).toBeTruthy();
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("maps weak-password errors without exposing the Supabase message", async () => {
    mockUpdateUser.mockResolvedValueOnce({
      data: { user: null },
      error: {
        code: "weak_password",
        message: "raw backend policy details",
        name: "AuthApiError",
      },
    });
    await renderLoaded(["email"]);
    enterValidPassword();
    fireEvent.press(
      screen.getByRole("button", { name: "password.changeButton" })
    );

    expect(await screen.findByText("password.errors.weak")).toBeTruthy();
    expect(screen.queryByText("raw backend policy details")).toBeNull();
  });

  it("reauthenticates an Apple account and retries the same update", async () => {
    mockUpdateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: "reauthentication_needed",
          name: "AuthApiError",
        },
      })
      .mockResolvedValueOnce({
        data: { user: userWith(["apple"]) },
        error: null,
      });
    mockAppleSignIn.mockResolvedValue({ identityToken: "apple-token" });
    mockSignInWithIdToken.mockResolvedValue({
      data: { user: userWith(["apple"]) },
      error: null,
    });
    await renderLoaded(["apple"]);
    enterValidPassword();
    fireEvent.press(screen.getByRole("button", { name: "password.setButton" }));

    const reauthButton = await screen.findByRole("button", {
      name: "password.reauthAppleButton",
    });
    fireEvent.press(reauthButton);

    await waitFor(() =>
      expect(mockSignInWithIdToken).toHaveBeenCalledWith({
        provider: "apple",
        token: "apple-token",
      })
    );
    expect(mockUpdateUser).toHaveBeenCalledTimes(2);
    expect(mockUpdateUser).toHaveBeenLastCalledWith({
      password: "strong-password-123",
    });
  });

  it("uses Supabase's reauthentication nonce for non-Apple accounts", async () => {
    mockUpdateUser
      .mockResolvedValueOnce({
        data: { user: null },
        error: {
          code: "reauthentication_needed",
          name: "AuthApiError",
        },
      })
      .mockResolvedValueOnce({
        data: { user: userWith(["email"]) },
        error: null,
      });
    await renderLoaded(["email"]);
    enterValidPassword();
    fireEvent.press(
      screen.getByRole("button", { name: "password.changeButton" })
    );

    await waitFor(() => expect(mockReauthenticate).toHaveBeenCalledTimes(1));
    fireEvent.changeText(
      screen.getByLabelText("password.reauthCodeLabel"),
      "123456"
    );
    fireEvent.press(
      screen.getByRole("button", { name: "password.changeButton" })
    );

    await waitFor(() =>
      expect(mockUpdateUser).toHaveBeenLastCalledWith({
        nonce: "123456",
        password: "strong-password-123",
      })
    );
  });

  it("redirects unauthenticated access", () => {
    mockAuth = { isAuthenticated: false, isInitialized: true };
    render(<ChangePasswordScreen />);

    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith({ href: "/(auth)/sign-in" });
  });
});
