jest.mock("@/hooks/use-theme-color", () => ({
  useThemeColor: jest.fn(() => "#000000"),
}));
jest.mock("@/stores/onboarding-store", () => ({
  useOnboardingStore: jest.fn(),
}));
jest.mock("@/lib/track-event", () => ({ trackEvent: jest.fn() }));
jest.mock("expo-router", () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: jest.fn((cb) => cb()),
}));

import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { trackEvent } from "@/lib/track-event";
import { useOnboardingStore } from "@/stores/onboarding-store";
import ReviewScreen from "../review";

const mockComplete = jest.fn();

const fullStore = {
  gender: "male" as const,
  genderSkipped: false,
  goal: "lose_weight" as const,
  customGoal: null,
  frequency: 4 as const,
  complete: mockComplete,
};

beforeEach(() => {
  jest.clearAllMocks();
  (useOnboardingStore as unknown as jest.Mock).mockReturnValue(fullStore);
});

describe("ReviewScreen", () => {
  it("displays all answered values", () => {
    render(<ReviewScreen />);
    expect(screen.getByText("Male")).toBeTruthy();
    expect(screen.getByText("Lose Weight")).toBeTruthy();
    expect(screen.getByText("4 days per week")).toBeTruthy();
  });

  it("does not show gender card when gender is null and not skipped", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      gender: null,
      genderSkipped: false,
    });
    render(<ReviewScreen />);
    expect(screen.queryByText(/gender/i)).toBeNull();
  });

  it("does not show gender card when explicitly skipped", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      gender: null,
      genderSkipped: true,
    });
    render(<ReviewScreen />);
    expect(screen.queryByText(/GENDER/i)).toBeNull();
  });

  it("shows custom goal text when set", () => {
    (useOnboardingStore as unknown as jest.Mock).mockReturnValue({
      ...fullStore,
      goal: null,
      customGoal: "do a muscle-up",
    });
    render(<ReviewScreen />);
    expect(screen.getByText("do a muscle-up")).toBeTruthy();
  });

  it("tapping Edit on gender navigates to gender with editMode", () => {
    render(<ReviewScreen />);
    const editBtns = screen.getAllByText("Edit");
    fireEvent.press(editBtns[0]); // first Edit is for gender
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/(onboarding)/gender",
      params: { editMode: "1" },
    });
  });

  it("tapping submit calls complete and fires analytics", () => {
    render(<ReviewScreen />);
    fireEvent.press(screen.getByRole("button", { name: /start working out/i }));
    expect(mockComplete).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith("onboarding_completed", {});
  });

  it("tapping submit navigates to tabs", () => {
    render(<ReviewScreen />);
    fireEvent.press(screen.getByRole("button", { name: /start working out/i }));
    expect(router.replace).toHaveBeenCalledWith("/(tabs)");
  });
});
