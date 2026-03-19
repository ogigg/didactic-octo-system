jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
    },
  },
}));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
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
import SignUpScreen from "../sign-up";

const mockSignUp = supabase.auth.signUp as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SignUpScreen", () => {
  it("renders email, password, and confirm password fields", () => {
    render(<SignUpScreen />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm Password")).toBeTruthy();
  });

  it("shows validation error when passwords don't match", async () => {
    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.changeText(
      screen.getByLabelText("Confirm Password"),
      "different123"
    );
    fireEvent.press(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Passwords must match")).toBeTruthy();
    });
  });

  it("calls signUp with valid data", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.changeText(
      screen.getByLabelText("Confirm Password"),
      "password123"
    );
    fireEvent.press(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "user@example.com",
        password: "password123",
      });
    });
  });

  it("shows check email success state when no session returned", async () => {
    mockSignUp.mockResolvedValue({ data: { session: null }, error: null });

    render(<SignUpScreen />);

    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.changeText(screen.getByLabelText("Password"), "password123");
    fireEvent.changeText(
      screen.getByLabelText("Confirm Password"),
      "password123"
    );
    fireEvent.press(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeTruthy();
    });
  });
});
