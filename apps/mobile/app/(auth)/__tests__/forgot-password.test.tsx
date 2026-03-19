jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: jest.fn(),
    },
  },
}));
jest.mock("expo-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  router: { push: jest.fn() },
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
import ForgotPasswordScreen from "../forgot-password";

const mockReset = supabase.auth.resetPasswordForEmail as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ForgotPasswordScreen", () => {
  it("renders email field and submit button", () => {
    render(<ForgotPasswordScreen />);
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /send reset link/i })
    ).toBeTruthy();
  });

  it("shows validation error for invalid email", async () => {
    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "bad");
    fireEvent.press(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Enter a valid email address")).toBeTruthy();
    });
  });

  it("calls resetPasswordForEmail with valid email", async () => {
    mockReset.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.press(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith("user@example.com", {
        redirectTo: "mobile://reset-password",
      });
    });
  });

  it("shows success state after successful submission", async () => {
    mockReset.mockResolvedValue({ error: null });

    render(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByLabelText("Email"), "user@example.com");
    fireEvent.press(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeTruthy();
    });
  });
});
