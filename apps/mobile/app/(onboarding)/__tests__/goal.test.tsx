jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: jest.fn(),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
jest.mock("@/lib/profanity", () => ({
  containsProfanity: jest.fn(() => false),
  MAX_CUSTOM_GOAL_LENGTH: 120,
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/stores/onboarding-store";
import GoalScreen from "../goal";

const mockSetGoal = jest.fn();
const mockSetCustomGoal = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
    goal: null,
    customGoal: null,
    setGoal: mockSetGoal,
    setCustomGoal: mockSetCustomGoal,
  });
});

describe("GoalScreen", () => {
  it("renders all three goal options", () => {
    render(<GoalScreen />);
    expect(screen.getByText("Build Strength")).toBeTruthy();
    expect(screen.getByText("Lose Weight")).toBeTruthy();
    expect(screen.getByText("Improve Fitness")).toBeTruthy();
  });

  it("Continue button is disabled with no selection", () => {
    render(<GoalScreen />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it("Continue button is enabled after selecting a goal", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      goal: "build_strength",
      customGoal: null,
      setGoal: mockSetGoal,
      setCustomGoal: mockSetCustomGoal,
    });
    render(<GoalScreen />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it("tapping a goal calls setGoal", () => {
    render(<GoalScreen />);
    fireEvent.press(screen.getByText("Lose Weight"));
    expect(mockSetGoal).toHaveBeenCalledWith("lose_weight");
  });

  it("typing in custom goal calls setCustomGoal", () => {
    render(<GoalScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText("Or type your own goal..."),
      "do a muscle-up"
    );
    expect(mockSetCustomGoal).toHaveBeenCalledWith("do a muscle-up");
  });

  it("Continue is disabled when custom goal is fewer than 5 chars", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      goal: null,
      customGoal: "ab",
      setGoal: mockSetGoal,
      setCustomGoal: mockSetCustomGoal,
    });
    render(<GoalScreen />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).toBeDisabled();
  });

  it("Continue is enabled when custom goal is 5+ chars and not profane", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      goal: null,
      customGoal: "muscle up in 6 months",
      setGoal: mockSetGoal,
      setCustomGoal: mockSetCustomGoal,
    });
    render(<GoalScreen />);
    const btn = screen.getByRole("button", { name: /continue/i });
    expect(btn).not.toBeDisabled();
  });

  it("Continue navigates to frequency", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      goal: "improve_fitness",
      customGoal: null,
      setGoal: mockSetGoal,
      setCustomGoal: mockSetCustomGoal,
    });
    render(<GoalScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.push).toHaveBeenCalledWith("/(onboarding)/frequency");
  });

  it("in editMode, Continue calls router.back", () => {
    const { useLocalSearchParams } = require("expo-router");
    (useLocalSearchParams as unknown as jest.Mock).mockReturnValue({
      editMode: "1",
    });
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      goal: "build_strength",
      customGoal: null,
      setGoal: mockSetGoal,
      setCustomGoal: mockSetCustomGoal,
    });
    render(<GoalScreen />);
    fireEvent.press(screen.getByRole("button", { name: /continue/i }));
    expect(router.back).toHaveBeenCalled();
  });
});
