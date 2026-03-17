jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: jest.fn(),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";
import FrequencyScreen from "../frequency";

const mockSetFrequency = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
    frequency: null,
    setFrequency: mockSetFrequency,
  });
});

describe("FrequencyScreen", () => {
  it("renders all four frequency options", () => {
    render(<FrequencyScreen />);
    expect(screen.getByText("2 days per week")).toBeTruthy();
    expect(screen.getByText("3 days per week")).toBeTruthy();
    expect(screen.getByText("4 days per week")).toBeTruthy();
    expect(screen.getByText("5+ days per week")).toBeTruthy();
  });

  it("Continue is disabled with no selection", () => {
    render(<FrequencyScreen />);
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("tapping 4 days calls setFrequency(4)", () => {
    render(<FrequencyScreen />);
    fireEvent.press(screen.getByText("4 days per week"));
    expect(mockSetFrequency).toHaveBeenCalledWith(4);
  });

  it("tapping 5+ calls setFrequency(5)", () => {
    render(<FrequencyScreen />);
    fireEvent.press(screen.getByText("5+ days per week"));
    expect(mockSetFrequency).toHaveBeenCalledWith(5);
  });

  it("Continue is enabled after selection", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      frequency: 3,
      setFrequency: mockSetFrequency,
    });
    render(<FrequencyScreen />);
    expect(
      screen.getByRole("button", { name: /continue/i })
    ).not.toBeDisabled();
  });

  it("Continue navigates to review", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      frequency: 3,
      setFrequency: mockSetFrequency,
    });
    render(<FrequencyScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/review");
  });

  it("in editMode, Continue calls router.back", () => {
    const { useLocalSearchParams } = require("expo-router");
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({
      editMode: "1",
    });
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      frequency: 4,
      setFrequency: mockSetFrequency,
    });
    render(<FrequencyScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.back).toHaveBeenCalled();
  });
});
