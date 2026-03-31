jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: jest.fn(),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";
import GenderScreen from "../gender";

const mockSetGender = jest.fn();
const mockSkipGender = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
    gender: null,
    genderSkipped: false,
    setGender: mockSetGender,
    skipGender: mockSkipGender,
  });
});

describe("GenderScreen", () => {
  it("renders all three gender options", () => {
    render(<GenderScreen />);
    expect(screen.getByText("Male")).toBeTruthy();
    expect(screen.getByText("Female")).toBeTruthy();
    expect(screen.getByText("Other")).toBeTruthy();
  });

  it("renders step label and title", () => {
    render(<GenderScreen />);
    expect(screen.getByText("STEP 1 OF 6")).toBeTruthy();
    expect(screen.getByText("About you")).toBeTruthy();
  });

  it("Continue button is enabled even with no selection (optional step)", () => {
    render(<GenderScreen />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it("tapping a gender option calls setGender", () => {
    render(<GenderScreen />);
    fireEvent.press(screen.getByText("Female"));
    expect(mockSetGender).toHaveBeenCalledWith("female");
  });

  it("tapping Skip calls skipGender", () => {
    render(<GenderScreen />);
    fireEvent.press(screen.getByRole("button", { name: /skip/i }));
    expect(mockSkipGender).toHaveBeenCalled();
  });

  it("tapping Continue navigates to goal", () => {
    render(<GenderScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/goal");
  });

  it("tapping Continue in editMode calls router.back", () => {
    const { useLocalSearchParams } = require("expo-router");
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({
      editMode: "1",
    });
    render(<GenderScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.back).toHaveBeenCalled();
  });
});
