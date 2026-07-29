const mockNavigate = jest.fn();

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
      key === "deletion.accessibilityLabel"
        ? "Delete account, destructive action"
        : key,
  }),
}));

jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));

jest.mock("@/components/ambient-glow", () => ({
  AmbientGlow: () => null,
}));

import { fireEvent, render, screen } from "@testing-library/react-native";

import AccountSettingsScreen from "../account-settings";

describe("AccountSettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
