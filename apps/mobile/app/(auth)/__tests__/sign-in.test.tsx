jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));
jest.mock("@/lib/api/login-provider-hint", () => ({
  fetchLoginProviderHint: jest.fn(),
}));
jest.mock("@/components/auth/apple-sign-in-button", () => ({
  AppleSignInButton: () => null,
}));
jest.mock("@/components/auth/google-sign-in-button", () => ({
  GoogleSignInButton: () => null,
}));
jest.mock("expo-router", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) =>
    children,
  router: { push: jest.fn(), replace: jest.fn() },
}));

import "@/i18n";
import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { supabase } from "@/lib/supabase";
import { fetchLoginProviderHint } from "@/lib/api/login-provider-hint";
import SignInScreen from "../sign-in";

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;
const mockFetchHint = fetchLoginProviderHint as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockFetchHint.mockResolvedValue(null);
});

describe("SignInScreen", () => {
  it("renders email and password fields", () => {
    render(<SignInScreen />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
  });

  it("renders sign in button", () => {
    render(<SignInScreen />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeTruthy();
  });

  it("shows validation error for invalid email", async () => {
    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "bad-email");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    });
  });

  it("shows validation error for short password", async () => {
    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "short");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 8 characters")
      ).toBeTruthy();
    });
  });

  it("calls signInWithPassword with valid credentials", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("shows error banner on invalid credentials", async () => {
    mockSignIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrongpassword");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeTruthy();
    });
  });

  it("shows Apple hint when account has no password", async () => {
    mockSignIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    mockFetchHint.mockResolvedValue({
      providers: ["apple"],
      hasPassword: false,
    });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrongpassword");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/previously used to log in with Apple/)
      ).toBeTruthy();
    });
    expect(screen.queryByText("Invalid email or password")).toBeNull();
  });

  it("shows generic error when account also has a password", async () => {
    mockSignIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    mockFetchHint.mockResolvedValue({
      providers: ["apple"],
      hasPassword: true,
    });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrongpassword");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeTruthy();
    });
  });

  it("falls back to generic error when hint lookup fails", async () => {
    mockSignIn.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });
    mockFetchHint.mockRejectedValue(new Error("network down"));

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrongpassword");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeTruthy();
    });
  });

  it("does not call hint lookup on successful sign in", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    render(<SignInScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.press(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalled();
    });
    expect(mockFetchHint).not.toHaveBeenCalled();
  });
});
