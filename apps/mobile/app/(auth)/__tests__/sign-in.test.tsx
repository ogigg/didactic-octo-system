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
import SignInScreen from "../sign-in";

const mockSignIn = supabase.auth.signInWithPassword as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
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
});
